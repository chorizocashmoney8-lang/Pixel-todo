const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore, emptyState } = require('../main/store.js');

const DAY = 24 * 60 * 60 * 1000;
const FILE = 'pixel-todo.json';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-todo-'));
}

test('文件不存在时得到空状态,并在磁盘上生成文件', () => {
  const dir = tmpDir();
  const store = createStore(dir);
  assert.deepStrictEqual(store.get(), emptyState());
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, FILE), 'utf8')).version, 3);
});

test('emptyState 的初始值', () => {
  const s = emptyState();
  assert.strictEqual(s.version, 3);
  assert.deepStrictEqual(s.tasks, []);
  assert.deepStrictEqual(s.pomodoros, []);
  assert.deepStrictEqual(s.timer, { phase: 'idle', topic: '', endAt: null, pausedLeftMs: null });
  assert.deepStrictEqual(s.prefs, { alwaysOnTop: false, widgetCount: 4, recentTopics: [] });
});

test('update 之后新建同目录的 store 能读回', () => {
  const dir = tmpDir();
  createStore(dir).update((s) => {
    s.tasks.push({ id: 't1', text: '交周报', done: false, priority: 'high',
      dueDate: '2026-10-12', createdAt: 1, doneAt: null, deletedAt: null });
  });
  const again = createStore(dir).get();
  assert.strictEqual(again.tasks.length, 1);
  assert.strictEqual(again.tasks[0].text, '交周报');
});

test('update 抛错时,内存状态和磁盘文件都保持原样', () => {
  const dir = tmpDir();
  const store = createStore(dir);
  store.update((s) => { s.tasks.push({ id: 't1', text: 'a', deletedAt: null }); });
  const before = fs.readFileSync(path.join(dir, FILE), 'utf8');
  assert.throws(() => store.update((s) => { s.tasks.length = 0; throw new Error('boom'); }), /boom/);
  assert.strictEqual(store.get().tasks.length, 1);
  assert.strictEqual(fs.readFileSync(path.join(dir, FILE), 'utf8'), before);
  assert.deepStrictEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')), []);
});

test('get 返回的是副本,直接改它不会影响存储', () => {
  const store = createStore(tmpDir());
  store.get().tasks.push({ id: 'x' });
  assert.strictEqual(store.get().tasks.length, 0);
});

test('文件内容损坏时改名备份并用空状态启动', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, FILE), '{bad');
  const store = createStore(dir, () => 123456);
  assert.deepStrictEqual(store.get(), emptyState());
  assert.ok(fs.existsSync(path.join(dir, FILE + '.corrupt-123456')));
  assert.strictEqual(fs.readFileSync(path.join(dir, FILE + '.corrupt-123456'), 'utf8'), '{bad');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, FILE), 'utf8')).version, 3);
});

test('空文件同样按损坏处理', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, FILE), '');
  const store = createStore(dir, () => 9);
  assert.deepStrictEqual(store.get(), emptyState());
  assert.ok(fs.existsSync(path.join(dir, FILE + '.corrupt-9')));
});

test('JSON 合法但缺少必要字段时,缺的字段用默认值补齐', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, FILE), JSON.stringify({ version: 3, tasks: [{ id: 't1', text: 'a', deletedAt: null }] }));
  const s = createStore(dir).get();
  assert.strictEqual(s.tasks.length, 1);
  assert.deepStrictEqual(s.pomodoros, []);
  assert.strictEqual(s.timer.phase, 'idle');
  assert.strictEqual(s.prefs.widgetCount, 4);
});

test('启动时清理回收站里超过 7 天的任务,保留 6 天的', () => {
  const dir = tmpDir();
  const now = 1000 * DAY;
  fs.writeFileSync(path.join(dir, FILE), JSON.stringify({
    version: 3,
    tasks: [
      { id: 'old', text: 'a', deletedAt: now - 8 * DAY },
      { id: 'recent', text: 'b', deletedAt: now - 6 * DAY },
      { id: 'live', text: 'c', deletedAt: null },
    ],
  }));
  const ids = createStore(dir, () => now).get().tasks.map((t) => t.id);
  assert.deepStrictEqual(ids, ['recent', 'live']);
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, FILE), 'utf8'));
  assert.deepStrictEqual(onDisk.tasks.map((t) => t.id), ['recent', 'live']);
});
