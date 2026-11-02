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

test('手动立即完成学习段记实际开始时间和 manual,进入休息且重复调用不重复计数', () => {
  const { clock, store, timer } = setup();
  const startedAt = clock.t;
  const alerts = [];
  const alertedTimer = createTimer(store, () => clock.t, () => {}, (kind) => alerts.push(kind));
  alertedTimer.start('高数');
  clock.t += 7 * MIN;

  assert.strictEqual(alertedTimer.finishNow(), true);
  const state = store.get();
  assert.deepStrictEqual(state.pomodoros, [{ id: 'p_' + clock.t, topic: '高数', startedAt,
    endedAt: clock.t, completion: 'manual' }]);
  assert.strictEqual(state.timer.phase, 'break');
  assert.strictEqual(state.timer.endAt, clock.t + 5 * MIN);
  assert.deepStrictEqual(alerts, []);
  assert.strictEqual(alertedTimer.finishNow(), false);
  assert.strictEqual(store.get().pomodoros.length, 1);
});

test('手动立即完成暂停段沿用真实 startedAt,不从暂停时长重算', () => {
  const { clock, store, timer } = setup();
  const startedAt = clock.t;
  timer.start('英语');
  clock.t += 4 * MIN;
  timer.pause();
  clock.t += 20 * MIN;

  assert.strictEqual(timer.finishNow(), true);
  assert.strictEqual(store.get().pomodoros[0].startedAt, startedAt);
  assert.strictEqual(store.get().pomodoros[0].endedAt, clock.t);
  assert.strictEqual(store.get().pomodoros[0].completion, 'manual');
  assert.strictEqual(store.get().timer.endAt, clock.t + 5 * MIN);
});

test('学习段自然结束标记 completion timer', () => {
  const { clock, store, timer } = setup();
  timer.start('物理');
  clock.t += 25 * MIN;
  timer.tick();
  assert.strictEqual(store.get().pomodoros[0].completion, 'timer');
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
  assert.strictEqual(s.startedAt, 10 * 60 * MIN);
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


test('暂停和继续后自然完成及重启补记都保留最初 startedAt', () => {
  for (const recovery of [false, true]) {
    const { dir, clock, store, timer } = setup();
    const startedAt = clock.t;
    timer.start('真实时间');
    assert.strictEqual(store.get().timer.startedAt, startedAt);
    clock.t += 10 * MIN;
    timer.pause();
    assert.strictEqual(store.get().timer.startedAt, startedAt);
    clock.t += 60 * MIN;
    timer.resume();
    assert.strictEqual(store.get().timer.startedAt, startedAt);
    clock.t += 15 * MIN;
    let finalStore = store;
    if (recovery) {
      finalStore = createStore(dir, () => clock.t);
      const restored = createTimer(finalStore, () => clock.t, () => {});
      restored.init();
      restored.init();
    } else {
      timer.tick();
      timer.tick();
    }
    assert.strictEqual(finalStore.get().pomodoros.length, 1);
    assert.strictEqual(finalStore.get().pomodoros[0].startedAt, startedAt);
    assert.strictEqual(finalStore.get().pomodoros[0].completion, 'timer');
  }
});

test('旧计时无 startedAt 时根据计划结束时间或暂停余量合理回退', () => {
  for (const phase of ['focus', 'paused']) {
    const { clock, store, timer } = setup();
    const estimatedStart = clock.t - 7 * MIN;
    store.update(s => {
      s.timer = { phase, topic: '旧计时', endAt: phase === 'focus' ? clock.t + 18 * MIN : null,
        pausedLeftMs: phase === 'paused' ? 18 * MIN : null };
    });
    timer.finishNow();
    assert.strictEqual(store.get().pomodoros[0].startedAt, estimatedStart);
    assert.strictEqual(store.get().pomodoros[0].completion, 'manual');
  }
});

test('旧 focus 暂停后继续仍沿用回退开始时间', () => {
  const { clock, store, timer } = setup();
  const estimatedStart = clock.t - 7 * MIN;
  store.update(s => { s.timer = { phase: 'focus', topic: '旧计时', endAt: clock.t + 18 * MIN, pausedLeftMs: null }; });
  timer.pause();
  clock.t += 60 * MIN;
  timer.resume();
  timer.finishNow();
  assert.strictEqual(store.get().pomodoros[0].startedAt, estimatedStart);
});

test('idle 立即完成无操作,手动完成写盘失败不计数不提醒且可以重试', () => {
  let state = { timer: { phase: 'idle' }, pomodoros: [], prefs: { recentTopics: [] } };
  let failWrite = false;
  const store = {
    get: () => structuredClone(state),
    update(fn) {
      const draft = structuredClone(state);
      fn(draft);
      if (failWrite) throw new Error('disk full');
      state = draft;
    },
  };
  let changes = 0;
  const alerts = [];
  const timer = createTimer(store, () => 100000, () => { changes += 1; }, k => alerts.push(k));
  assert.strictEqual(timer.finishNow(), false);
  assert.strictEqual(changes, 0);
  timer.start('retry');
  failWrite = true;
  assert.throws(() => timer.finishNow(), /disk full/);
  assert.strictEqual(state.timer.phase, 'focus');
  assert.strictEqual(state.pomodoros.length, 0);
  assert.strictEqual(changes, 1);
  assert.deepStrictEqual(alerts, []);
  failWrite = false;
  assert.strictEqual(timer.finishNow(), true);
  assert.strictEqual(state.pomodoros.length, 1);
  assert.strictEqual(changes, 2);
});

test('同一毫秒内完成两段独立学习都计数,每段重复完成仍不计数', () => {
  const { store, timer } = setup();
  timer.start('第一段');
  timer.finishNow();
  assert.strictEqual(timer.finishNow(), false);
  timer.skipBreak();
  timer.start('第二段');
  timer.finishNow();
  assert.strictEqual(timer.finishNow(), false);
  const records = store.get().pomodoros;
  assert.strictEqual(records.length, 2);
  assert.deepStrictEqual(records.map(p => p.topic), ['第一段', '第二段']);
  assert.strictEqual(new Set(records.map(p => p.id)).size, 2);
});

test('自然完成提醒异常与数据写盘错误分开记录,完成数据仍只保存一次', () => {
  const { clock, store, timer } = setup();
  const messages=[]; const original=console.error;
  console.error=(message)=>messages.push(String(message));
  try {
    const failing=createTimer(store,()=>clock.t,()=>{},()=>{throw new Error('reminder failed');});
    failing.start('提醒异常'); clock.t+=25*MIN; failing.tick();
  } finally { console.error=original; }
  assert.equal(store.get().pomodoros.length,1);
  assert.equal(store.get().timer.phase,'break');
  assert.ok(messages.some(message=>message.includes('提醒失败')));
  assert.ok(!messages.some(message=>message.includes('写盘失败')));
});
