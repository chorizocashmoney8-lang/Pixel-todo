const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../main/store.js');
const { createTimer } = require('../main/timer.js');
const { createHandlers } = require('../main/ipc.js');

const DAY = 24 * 60 * 60 * 1000;

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-handlers-'));
  const clock = { t: 100 * DAY };
  const now = () => clock.t;
  const store = createStore(dir, now);
  let notified = 0;
  const notify = () => { notified += 1; };
  const timer = createTimer(store, now, notify);
  const h = createHandlers(store, timer, now, notify);
  return { clock, store, timer, h, notified: () => notified };
}

test('addTask:默认中优先级、无截止日期,文字去掉首尾空白', () => {
  const { store, h, clock } = setup();
  const task = h.addTask({ text: '  交周报  ' });
  assert.strictEqual(task.text, '交周报');
  assert.strictEqual(task.priority, 'mid');
  assert.strictEqual(task.dueDate, null);
  assert.strictEqual(task.done, false);
  assert.strictEqual(task.createdAt, clock.t);
  assert.strictEqual(task.deletedAt, null);
  assert.strictEqual(store.get().tasks.length, 1);
});

test('addTask:空白文字被拒绝,不写入也不通知', () => {
  const { store, h, notified } = setup();
  assert.strictEqual(h.addTask({ text: '   ' }), null);
  assert.strictEqual(h.addTask({ text: '' }), null);
  assert.strictEqual(store.get().tasks.length, 0);
  assert.strictEqual(notified(), 0);
});

test('addTask:含 HTML 标签的文字原样保存为纯文本', () => {
  const { h } = setup();
  assert.strictEqual(h.addTask({ text: '<script>alert(1)</script>' }).text, '<script>alert(1)</script>');
});

test('addTask:非法的优先级和日期回退为默认值', () => {
  const { h } = setup();
  const task = h.addTask({ text: 'x', priority: 'urgent', dueDate: '10月12日' });
  assert.strictEqual(task.priority, 'mid');
  assert.strictEqual(task.dueDate, null);
});

test('addTask:接受合法的优先级和日期', () => {
  const { h } = setup();
  const task = h.addTask({ text: 'x', priority: 'high', dueDate: '2026-10-12' });
  assert.strictEqual(task.priority, 'high');
  assert.strictEqual(task.dueDate, '2026-10-12');
});

test('updateTask:修改文字、优先级、截止日期,可清空截止日期', () => {
  const { store, h } = setup();
  const { id } = h.addTask({ text: 'a', dueDate: '2026-10-12' });
  h.updateTask(id, { text: ' b ', priority: 'low', dueDate: null });
  const t = store.get().tasks[0];
  assert.strictEqual(t.text, 'b');
  assert.strictEqual(t.priority, 'low');
  assert.strictEqual(t.dueDate, null);
});

test('updateTask:改成空白文字时拒绝,原文字保留', () => {
  const { store, h } = setup();
  const { id } = h.addTask({ text: 'a' });
  h.updateTask(id, { text: '   ' });
  assert.strictEqual(store.get().tasks[0].text, 'a');
});

test('updateTask:勾选完成记 doneAt,取消勾选清空', () => {
  const { store, h, clock } = setup();
  const { id } = h.addTask({ text: 'a' });
  h.updateTask(id, { done: true });
  assert.strictEqual(store.get().tasks[0].done, true);
  assert.strictEqual(store.get().tasks[0].doneAt, clock.t);
  h.updateTask(id, { done: false });
  assert.strictEqual(store.get().tasks[0].done, false);
  assert.strictEqual(store.get().tasks[0].doneAt, null);
});

test('deleteTask 放入回收站,restoreTask 取回', () => {
  const { store, h, clock } = setup();
  const { id } = h.addTask({ text: 'a' });
  h.deleteTask(id);
  assert.strictEqual(store.get().tasks[0].deletedAt, clock.t);
  h.restoreTask(id);
  assert.strictEqual(store.get().tasks[0].deletedAt, null);
});

test('clearDone 只把已完成且未删除的任务放入回收站', () => {
  const { store, h } = setup();
  const a = h.addTask({ text: 'a' });
  const b = h.addTask({ text: 'b' });
  h.updateTask(a.id, { done: true });
  h.clearDone();
  const byId = Object.fromEntries(store.get().tasks.map((t) => [t.id, t]));
  assert.notStrictEqual(byId[a.id].deletedAt, null);
  assert.strictEqual(byId[b.id].deletedAt, null);
});

test('purgeTask 彻底删除一条,emptyTrash 只清空回收站里的', () => {
  const { store, h } = setup();
  const a = h.addTask({ text: 'a' });
  const b = h.addTask({ text: 'b' });
  const c = h.addTask({ text: 'c' });
  h.deleteTask(a.id); h.deleteTask(b.id);
  h.purgeTask(a.id);
  assert.deepStrictEqual(store.get().tasks.map((t) => t.id), [b.id, c.id]);
  h.emptyTrash();
  assert.deepStrictEqual(store.get().tasks.map((t) => t.id), [c.id]);
});

test('操作不存在的任务 id 不报错也不通知', () => {
  const { h, notified } = setup();
  h.updateTask('nope', { text: 'x' });
  h.deleteTask('nope');
  h.restoreTask('nope');
  h.purgeTask('nope');
  assert.strictEqual(notified(), 0);
});

test('setPrefs 只接受白名单字段并校验取值', () => {
  const { store, h } = setup();
  h.setPrefs({ theme: 6, font: 'system', buddy: false, idleMode: 'random', face: 3, pose: 1, animate: false, sound: 'custom', volume: 100, autoStart: false, alwaysOnTop: true, widgetCount: 3, widgetPos: { x: 10, y: 20 }, recentTopics: ['hack'], customSoundName: 'C:/private.wav', evil: 1 });
  const p = store.get().prefs;
  assert.strictEqual(p.alwaysOnTop, true);
  assert.strictEqual(p.theme, 6);
  assert.strictEqual(p.font, 'system');
  assert.strictEqual(p.buddy, false);
  assert.strictEqual(p.idleMode, 'random');
  assert.strictEqual(p.face, 3);
  assert.strictEqual(p.pose, 1);
  assert.strictEqual(p.animate, false);
  assert.strictEqual(p.sound, 'custom');
  assert.strictEqual(p.volume, 100);
  assert.strictEqual(p.autoStart, false);
  assert.strictEqual(p.widgetCount, 3);
  assert.deepStrictEqual(p.widgetPos, { x: 10, y: 20 });
  assert.deepStrictEqual(p.recentTopics, []);
  assert.strictEqual(p.customSoundName, undefined);
  assert.strictEqual(p.evil, undefined);
});

test('setPrefs 拒绝越界的小窗口条数和非法类型', () => {
  const { store, h } = setup();
  h.setPrefs({ widgetCount: 0 });
  h.setPrefs({ widgetCount: 99 });
  h.setPrefs({ widgetCount: 'many' });
  h.setPrefs({ alwaysOnTop: 'yes' });
  const p = store.get().prefs;
  assert.strictEqual(p.widgetCount, 4);
  assert.strictEqual(p.alwaysOnTop, false);
});

test('setPrefs 严格拒绝所有超范围或错误类型的 v4 偏好', () => {
  const { store, h } = setup();
  h.setPrefs({ theme: 7, font: 'comic', buddy: 1, idleMode: 'sometimes', face: 4,
    pose: -1, animate: 'false', sound: 'file:///private.wav', volume: 101,
    autoStart: 0, widgetPos: { x: Infinity, y: 20 } });
  const prefs = store.get().prefs;
  assert.strictEqual(prefs.theme, 0);
  assert.strictEqual(prefs.font, 'pixel');
  assert.strictEqual(prefs.buddy, true);
  assert.strictEqual(prefs.idleMode, 'fixed');
  assert.strictEqual(prefs.face, 0);
  assert.strictEqual(prefs.pose, 0);
  assert.strictEqual(prefs.animate, true);
  assert.strictEqual(prefs.sound, 'clear-extended');
  assert.strictEqual(prefs.volume, 25);
  assert.strictEqual(prefs.autoStart, true);
  assert.strictEqual(prefs.widgetPos, undefined);
});

test('finishPomodoro handler 调用 timer.finishNow', () => {
  const { timer, h } = setup();
  let finished = 0;
  timer.finishNow = () => { finished += 1; return true; };
  assert.strictEqual(h.finishPomodoro(), true);
  assert.strictEqual(finished, 1);
});

test('register 将 pomodoro:finish 接到 finishPomodoro', () => {
  const { h } = setup();
  const { register } = require('../main/ipc.js');
  const routes = new Map();
  register({ handle: (channel, fn) => routes.set(channel, fn) }, h);
  assert.ok(routes.has('pomodoro:finish'));
  h.startPomodoro('IPC finish');
  assert.strictEqual(routes.get('pomodoro:finish')({}), true);
  assert.strictEqual(h.getState().pomodoros[0].completion, 'manual');
  assert.strictEqual(routes.get('pomodoro:finish')({}), false);
});

test('getState 返回当前完整状态', () => {
  const { h } = setup();
  h.addTask({ text: 'a' });
  assert.strictEqual(h.getState().tasks.length, 1);
});


test('setPrefs 验证所有新字段的边界,拒绝非对象及继承属性', () => {
  const { store, h } = setup();
  const allowed = {
    theme: [0, 6], face: [0, 3], pose: [0, 1], font: ['pixel', 'system'],
    buddy: [false, true], idleMode: ['fixed', 'random'], animate: [false, true],
    sound: ['soft-pixel', 'clear-extended', 'bubble-response', 'custom'],
    volume: [0, 12.5, 100], autoStart: [false, true],
  };
  for (const [key, values] of Object.entries(allowed)) {
    for (const value of values) {
      h.setPrefs({ [key]: value });
      assert.strictEqual(store.get().prefs[key], value, key);
    }
  }
  const before = store.get().prefs;
  const invalid = {
    theme: [-1, 7, 1.5, '1', null], face: [-1, 4, 1.5, '1', null],
    pose: [-1, 2, 0.5, '1', null], font: ['other', 1, null],
    buddy: [0, 'true', null], idleMode: ['other', 1, null],
    animate: [0, 'false', null], sound: ['other', '/tmp/file.wav', 1, null],
    volume: [-1, 101, NaN, Infinity, '50', null], autoStart: [0, 'true', null],
  };
  for (const [key, values] of Object.entries(invalid)) {
    for (const value of values) {
      h.setPrefs({ [key]: value });
      assert.deepStrictEqual(store.get().prefs, before, key + ': ' + value);
    }
  }
  for (const patch of [undefined, null, 1, 'bad', [], Object.assign([], { theme: 0 })]) {
    assert.doesNotThrow(() => h.setPrefs(patch));
    assert.deepStrictEqual(store.get().prefs, before);
  }
  h.setPrefs(Object.create({ theme: 0, alwaysOnTop: true }));
  assert.deepStrictEqual(store.get().prefs, before);
});

test('prefs:set 无法覆盖音频 handler 已保存的名称及任意路径', () => {
  const { store, h } = setup();
  store.update(s => { s.prefs.customSoundName = 'trusted.wav'; });
  h.setPrefs(JSON.parse('{"customSoundName":"C:/other.wav","customSoundPath":"C:/other.wav","soundPath":"C:/other.wav","__proto__":{"theme":6}}'));
  assert.strictEqual(store.get().prefs.customSoundName, 'trusted.wav');
  assert.strictEqual(store.get().prefs.customSoundPath, undefined);
  assert.strictEqual(store.get().prefs.soundPath, undefined);
  assert.strictEqual(store.get().prefs.theme, 0);
});
