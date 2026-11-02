const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../main/store.js');
const { createTimer } = require('../main/timer.js');

const MIN = 60 * 1000;

function setup(startAt) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-timer-'));
  const clock = { t: startAt || 10 * 60 * MIN };
  const now = () => clock.t;
  const store = createStore(dir, now);
  let changes = 0;
  const timer = createTimer(store, now, () => { changes += 1; });
  return { dir, clock, store, timer, changes: () => changes };
}

test('start 进入学习段,25 分钟后到点,并记录学习内容', () => {
  const { clock, store, timer } = setup();
  const t0 = clock.t;
  assert.strictEqual(timer.start('高数'), true);
  const s = store.get().timer;
  assert.strictEqual(s.phase, 'focus');
  assert.strictEqual(s.topic, '高数');
  assert.strictEqual(s.endAt, t0 + 25 * MIN);
});

test('学习段到点后 tick 记一个番茄钟并转入 5 分钟休息', () => {
  const { clock, store, timer } = setup();
  const t0 = clock.t;
  timer.start('高数');
  clock.t = t0 + 25 * MIN;
  timer.tick();
  const s = store.get();
  assert.strictEqual(s.pomodoros.length, 1);
  assert.strictEqual(s.pomodoros[0].topic, '高数');
  assert.strictEqual(s.pomodoros[0].startedAt, t0);
  assert.strictEqual(s.pomodoros[0].endedAt, t0 + 25 * MIN);
  assert.strictEqual(s.timer.phase, 'break');
  assert.strictEqual(s.timer.endAt, t0 + 30 * MIN);
});

test('学习段没到点时 tick 不记录', () => {
  const { clock, store, timer } = setup();
  const t0 = clock.t;
  timer.start('高数');
  clock.t = t0 + 25 * MIN - 1;
  timer.tick();
  assert.strictEqual(store.get().pomodoros.length, 0);
  assert.strictEqual(store.get().timer.phase, 'focus');
});

test('休息段到点后回到 idle,不再新增番茄钟', () => {
  const { clock, store, timer } = setup();
  const t0 = clock.t;
  timer.start('高数');
  clock.t = t0 + 25 * MIN; timer.tick();
  clock.t = t0 + 30 * MIN; timer.tick();
  const s = store.get();
  assert.strictEqual(s.timer.phase, 'idle');
  assert.strictEqual(s.timer.endAt, null);
  assert.strictEqual(s.pomodoros.length, 1);
});

test('abandon 放弃学习段:回到 idle,不记番茄钟', () => {
  const { clock, store, timer } = setup();
  timer.start('高数');
  clock.t += 10 * MIN;
  timer.abandon();
  assert.strictEqual(store.get().timer.phase, 'idle');
  clock.t += 30 * MIN;
  timer.tick();
  assert.strictEqual(store.get().pomodoros.length, 0);
});

test('pause 记下剩余时间,resume 后从剩余时间继续', () => {
  const { clock, store, timer } = setup();
  timer.start('高数');
  clock.t += 10 * MIN;
  timer.pause();
  let s = store.get().timer;
  assert.strictEqual(s.phase, 'paused');
  assert.strictEqual(s.pausedLeftMs, 15 * MIN);
  assert.strictEqual(s.endAt, null);
  clock.t += 60 * MIN; // 暂停期间时间照常流逝
  timer.tick();
  assert.strictEqual(store.get().pomodoros.length, 0);
  const resumedAt = clock.t;
  timer.resume();
  s = store.get().timer;
  assert.strictEqual(s.phase, 'focus');
  assert.strictEqual(s.endAt, resumedAt + 15 * MIN);
  assert.strictEqual(s.topic, '高数');
});

test('skipBreak 在休息段直接回到 idle', () => {
  const { clock, store, timer } = setup();
  timer.start('高数');
  clock.t += 25 * MIN; timer.tick();
  timer.skipBreak();
  assert.strictEqual(store.get().timer.phase, 'idle');
});

test('空白的学习内容被拒绝,状态不变', () => {
  const { store, timer, changes } = setup();
  assert.strictEqual(timer.start('   '), false);
  assert.strictEqual(timer.start(''), false);
  assert.strictEqual(store.get().timer.phase, 'idle');
  assert.strictEqual(changes(), 0);
});

test('学习段进行中再次 start 被拒绝,不会重置倒计时', () => {
  const { clock, store, timer } = setup();
  timer.start('高数');
  const endAt = store.get().timer.endAt;
  clock.t += 5 * MIN;
  assert.strictEqual(timer.start('英语'), false);
  assert.strictEqual(store.get().timer.endAt, endAt);
  assert.strictEqual(store.get().timer.topic, '高数');
});

test('学习内容首尾空白被去掉,最近用过的内容去重、最近的在前、最多 8 个', () => {
  const { clock, store, timer } = setup();
  const topics = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'a'];
  topics.forEach((name) => {
    timer.start('  ' + name + '  ');
    assert.strictEqual(store.get().timer.topic, name);
    timer.abandon();
    clock.t += MIN;
  });
  assert.deepStrictEqual(store.get().prefs.recentTopics, ['a', 'i', 'h', 'g', 'f', 'e', 'd', 'c']);
});

test('软件重启时 init:学习段已过点补记番茄钟并回到 idle', () => {
  const { dir, clock, timer } = setup();
  const t0 = clock.t;
  timer.start('高数');
  // 模拟:软件退出,3 小时后重新启动
  clock.t = t0 + 180 * MIN;
  const now = () => clock.t;
  const store2 = createStore(dir, now);
  const timer2 = createTimer(store2, now, () => {});
  timer2.init();
  const s = store2.get();
  assert.strictEqual(s.timer.phase, 'idle');
  assert.strictEqual(s.pomodoros.length, 1);
  assert.strictEqual(s.pomodoros[0].topic, '高数');
  assert.strictEqual(s.pomodoros[0].endedAt, t0 + 25 * MIN);
});

test('软件重启时 init:学习段没到点则继续倒计时', () => {
  const { dir, clock, timer } = setup();
  const t0 = clock.t;
  timer.start('高数');
  clock.t = t0 + 10 * MIN;
  const now = () => clock.t;
  const store2 = createStore(dir, now);
  const timer2 = createTimer(store2, now, () => {});
  timer2.init();
  const s = store2.get();
  assert.strictEqual(s.timer.phase, 'focus');
  assert.strictEqual(s.timer.endAt, t0 + 25 * MIN);
  assert.strictEqual(s.pomodoros.length, 0);
});

test('每次改变状态都会通知,未改变则不通知', () => {
  const { clock, timer, changes } = setup();
  timer.start('高数');
  assert.strictEqual(changes(), 1);
  timer.tick(); // 没到点,什么都没变
  assert.strictEqual(changes(), 1);
  clock.t += 25 * MIN;
  timer.tick();
  assert.strictEqual(changes(), 2);
});

test('tick 写盘失败时不抛错,存储恢复后下一秒补记成功', () => {
  const { dir, clock, store, timer } = setup();
  const t0 = clock.t;
  timer.start('高数');
  clock.t = t0 + 25 * MIN;
  // 让数据文件的位置变成目录,rename 覆盖它会真实失败
  const file = path.join(dir, 'pixel-todo.json');
  fs.rmSync(file);
  fs.mkdirSync(file);
  assert.doesNotThrow(() => timer.tick());
  assert.strictEqual(store.get().pomodoros.length, 0);
  assert.strictEqual(store.get().timer.phase, 'focus');
  fs.rmdirSync(file);
  timer.tick();
  assert.strictEqual(store.get().pomodoros.length, 1);
  assert.strictEqual(store.get().timer.phase, 'break');
});

function setupAlerts() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-alert-'));
  const clock = { t: 10 * 60 * MIN };
  const now = () => clock.t;
  const store = createStore(dir, now);
  const alerts = [];
  const timer = createTimer(store, now, () => {}, (kind) => alerts.push(kind));
  return { dir, clock, store, timer, alerts };
}

test('学习段到点提醒 focus-done,休息段到点提醒 break-done', () => {
  const { clock, timer, alerts } = setupAlerts();
  const t0 = clock.t;
  timer.start('高数');
  clock.t = t0 + 25 * MIN - 1; timer.tick();
  assert.deepStrictEqual(alerts, []);
  clock.t = t0 + 25 * MIN; timer.tick();
  assert.deepStrictEqual(alerts, ['focus-done']);
  clock.t = t0 + 30 * MIN; timer.tick();
  assert.deepStrictEqual(alerts, ['focus-done', 'break-done']);
});

test('用户主动放弃、暂停、跳过休息不触发提醒', () => {
  const { clock, timer, alerts } = setupAlerts();
  timer.start('高数'); timer.pause(); timer.resume(); timer.abandon();
  assert.deepStrictEqual(alerts, []);
  timer.start('英语');
  clock.t += 25 * MIN; timer.tick();
  timer.skipBreak();
  assert.deepStrictEqual(alerts, ['focus-done']);
});

test('软件重启时补记已过点的学习段不触发提醒', () => {
  const { dir, clock, timer, alerts } = setupAlerts();
  timer.start('高数');
  clock.t += 180 * MIN;
  const now = () => clock.t;
  const timer2 = createTimer(createStore(dir, now), now, () => {}, (k) => alerts.push(k));
  timer2.init();
  assert.deepStrictEqual(alerts, []);
});
