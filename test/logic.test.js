const test = require('node:test');
const assert = require('node:assert');
const L = require('../renderer/shared/logic.js');

const MIN = 60 * 1000;

test('parseLocalDate 按本地零点解析,不会因 UTC 错位一天', () => {
  const d = L.parseLocalDate('2026-10-12');
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 9);
  assert.strictEqual(d.getDate(), 12);
  assert.strictEqual(d.getHours(), 0);
});

test('todayString 返回本地日期,午夜前后分属两天', () => {
  assert.strictEqual(L.todayString(new Date(2026, 9, 12, 23, 59, 59)), '2026-10-12');
  assert.strictEqual(L.todayString(new Date(2026, 9, 13, 0, 0, 0)), '2026-10-13');
});

test('dueLabel 按天给出文案', () => {
  const t = '2026-10-12';
  assert.strictEqual(L.dueLabel('2026-10-12', t), '今天截止');
  assert.strictEqual(L.dueLabel('2026-10-13', t), '明天');
  assert.strictEqual(L.dueLabel('2026-10-15', t), '还有 3 天');
  assert.strictEqual(L.dueLabel('2026-10-11', t), '已过期 1 天');
  assert.strictEqual(L.dueLabel('2026-10-09', t), '已过期 3 天');
  assert.strictEqual(L.dueLabel(null, t), '');
});

test('dueLabel 跨月、跨年也按天数算', () => {
  assert.strictEqual(L.dueLabel('2026-11-01', '2026-10-31'), '明天');
  assert.strictEqual(L.dueLabel('2027-01-01', '2026-12-31'), '明天');
  assert.strictEqual(L.dueLabel('2026-12-30', '2027-01-02'), '已过期 3 天');
});

test('sortTasks 先按优先级,再按有日期在前并按日期升序,最后按创建顺序', () => {
  const mk = (id, priority, dueDate, createdAt) => ({ id, priority, dueDate, createdAt });
  const input = [
    mk('a', 'low', '2026-10-01', 1),
    mk('b', 'high', null, 2),
    mk('c', 'high', '2026-10-20', 3),
    mk('e', 'mid', null, 5),
    mk('d', 'high', '2026-10-15', 4),
    mk('f', 'mid', null, 0),
    mk('g', 'high', null, 1),
  ];
  const ids = L.sortTasks(input).map((t) => t.id);
  assert.deepStrictEqual(ids, ['d', 'c', 'g', 'b', 'f', 'e', 'a']);
  assert.deepStrictEqual(input.map((t) => t.id), ['a', 'b', 'c', 'e', 'd', 'f', 'g']);
});

test('countPomodoros 以周一为一周起点,并按学习内容分组', () => {
  const now = new Date(2026, 9, 14, 12, 0, 0); // 周三
  const at = (y, m, d, h, mi, s) => new Date(y, m, d, h, mi, s || 0).getTime();
  const list = [
    { topic: '高数', endedAt: at(2026, 9, 14, 9, 0) },
    { topic: '高数', endedAt: at(2026, 9, 12, 0, 0, 0) },
    { topic: '英语', endedAt: at(2026, 9, 11, 23, 59, 59) },
    { topic: '英语', endedAt: at(2026, 8, 1, 10, 0) },
  ];
  const c = L.countPomodoros(list, now);
  assert.strictEqual(c.today, 1);
  assert.strictEqual(c.week, 2);
  assert.strictEqual(c.total, 4);
  assert.deepStrictEqual(c.byTopic, { 高数: 2, 英语: 2 });
});

test('countPomodoros 空列表全为 0', () => {
  const c = L.countPomodoros([], new Date(2026, 9, 14));
  assert.deepStrictEqual(c, { today: 0, week: 0, total: 0, byTopic: {} });
});

test('recoverTimer:学习段已过点,补记一个番茄钟并回到 idle', () => {
  const endAt = 1000000;
  const timer = { phase: 'focus', topic: '高数', endAt, pausedLeftMs: null };
  const r = L.recoverTimer(timer, endAt + 5 * MIN);
  assert.strictEqual(r.timer.phase, 'idle');
  assert.strictEqual(r.timer.endAt, null);
  assert.strictEqual(r.completed.topic, '高数');
  assert.strictEqual(r.completed.endedAt, endAt);
  assert.strictEqual(r.completed.startedAt, endAt - 25 * MIN);
});

test('recoverTimer:休息段已过点回到 idle,不记番茄钟', () => {
  const timer = { phase: 'break', topic: '高数', endAt: 1000000, pausedLeftMs: null };
  const r = L.recoverTimer(timer, 2000000);
  assert.strictEqual(r.timer.phase, 'idle');
  assert.strictEqual(r.completed, null);
});

test('recoverTimer:未到点和暂停中的计时原样保留', () => {
  const running = { phase: 'focus', topic: '高数', endAt: 5000000, pausedLeftMs: null };
  assert.deepStrictEqual(L.recoverTimer(running, 4000000), { timer: running, completed: null });
  const paused = { phase: 'paused', topic: '高数', endAt: null, pausedLeftMs: 600000 };
  assert.deepStrictEqual(L.recoverTimer(paused, 9999999), { timer: paused, completed: null });
});

test('isBlankText 拒绝空白,接受含标签的普通文字', () => {
  assert.strictEqual(L.isBlankText(''), true);
  assert.strictEqual(L.isBlankText('   '), true);
  assert.strictEqual(L.isBlankText('\t\n'), true);
  assert.strictEqual(L.isBlankText('<b>x</b>'), false);
  assert.strictEqual(L.isBlankText(' 交周报 '), false);
});

test('truncateText 超过上限才截断并加省略号,按字符而不是字节', () => {
  assert.strictEqual(L.truncateText('交周报', 12), '交周报');
  assert.strictEqual(L.truncateText('一二三四五六七八九十甲乙', 12), '一二三四五六七八九十甲乙');
  assert.strictEqual(L.truncateText('一二三四五六七八九十甲乙丙', 12), '一二三四五六七八九十甲乙…');
  assert.strictEqual(L.truncateText('😀😀😀', 2), '😀😀…');
});

test('widgetLines 只取未完成且不在回收站的任务,按排序取前 N 条', () => {
  const mk = (id, text, priority, dueDate, extra) => Object.assign(
    { id, text, priority, dueDate, createdAt: 1, done: false, deletedAt: null }, extra);
  const tasks = [
    mk('a', '低优先', 'low', null),
    mk('b', '已完成', 'high', null, { done: true }),
    mk('c', '已删除', 'high', null, { deletedAt: 5 }),
    mk('d', '交周报', 'high', '2026-10-12'),
    mk('e', '读书', 'mid', null),
  ];
  assert.deepStrictEqual(L.widgetLines(tasks, 2), ['交周报 · 10-12', '读书']);
  assert.deepStrictEqual(L.widgetLines(tasks, 8), ['交周报 · 10-12', '读书', '低优先']);
});

test('widgetLines 长任务名先截断再拼日期;没有待办返回空数组', () => {
  const t = { id: 'a', text: '一二三四五六七八九十甲乙丙', priority: 'mid', dueDate: '2026-01-05',
    createdAt: 1, done: false, deletedAt: null };
  assert.deepStrictEqual(L.widgetLines([t], 4), ['一二三四五六七八九十甲乙… · 01-05']);
  assert.deepStrictEqual(L.widgetLines([], 4), []);
});

test('formatClock 把毫秒格式化成 MM:SS,向上取整到秒,负数按 0', () => {
  assert.strictEqual(L.formatClock(25 * 60 * 1000), '25:00');
  assert.strictEqual(L.formatClock(61 * 1000), '01:01');
  assert.strictEqual(L.formatClock(1), '00:01');
  assert.strictEqual(L.formatClock(0), '00:00');
  assert.strictEqual(L.formatClock(-5000), '00:00');
});

test('formatDateTime 输出本地时间的 月-日 时:分,个位补零', () => {
  assert.strictEqual(L.formatDateTime(new Date(2026, 9, 5, 9, 7).getTime()), '10-05 09:07');
  assert.strictEqual(L.formatDateTime(new Date(2026, 11, 31, 23, 59).getTime()), '12-31 23:59');
  assert.strictEqual(L.formatDateTime(new Date(2027, 0, 1, 0, 0).getTime()), '01-01 00:00');
});
