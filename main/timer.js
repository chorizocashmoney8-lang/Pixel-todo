// 番茄钟状态机。以结束时间戳 endAt 为准,不靠逐秒累加,所以睡眠、退出重启后依然准确。
const { recoverTimer } = require('../renderer/shared/logic.js');

const MIN = 60 * 1000;
const FOCUS_MS = 25 * MIN;
const BREAK_MS = 5 * MIN;
const RECENT_MAX = 8;

function idleTimer() {
  return { phase: 'idle', topic: '', endAt: null, pausedLeftMs: null };
}

// onAlert(kind) 只在计时自然走完时调用:kind 为 focus-done 或 break-done。
function createTimer(store, now, onChange, onAlert) {
  const alert = onAlert || function () {};
  function deliverAlert(kind) {
    try { alert(kind); }
    catch (e) { console.error('番茄钟提醒失败,计数已保存:', e.message); }
  }
  function apply(fn) {
    store.update(fn);
    onChange();
  }

  function startedAt(t, observedAt) {
    if (Number.isFinite(t.startedAt)) return t.startedAt;
    // v3 没有开始时间:学习段由 endAt 推算,暂停段由已用专注时间推算。
    // 旧暂停时长无法还原,这里只使用已知时间,不把手动完成伪装成25分钟。
    if (t.phase === 'focus' && Number.isFinite(t.endAt)) {
      return Math.min(observedAt, t.endAt - FOCUS_MS);
    }
    const left = Number.isFinite(t.pausedLeftMs) ? t.pausedLeftMs : FOCUS_MS;
    return observedAt - Math.max(0, Math.min(FOCUS_MS, FOCUS_MS - left));
  }

  function pushPomodoro(draft, t, endedAt, completion) {
    const baseId = 'p_' + endedAt;
    let id = baseId;
    let suffix = 1;
    while (draft.pomodoros.some((p) => p.id === id)) {
      id = baseId + '_' + suffix;
      suffix += 1;
    }
    draft.pomodoros.push({ id: id, topic: t.topic, startedAt: startedAt(t, endedAt), endedAt: endedAt, completion });
  }

  return {
    start(topic) {
      const name = String(topic).trim();
      if (name === '' || store.get().timer.phase !== 'idle') return false;
      const startTime = now();
      apply((s) => {
        s.timer = { phase: 'focus', topic: name, startedAt: startTime, endAt: startTime + FOCUS_MS, pausedLeftMs: null };
        const rest = s.prefs.recentTopics.filter((t) => t !== name);
        s.prefs.recentTopics = [name].concat(rest).slice(0, RECENT_MAX);
      });
      return true;
    },

    pause() {
      const t = store.get().timer;
      if (t.phase !== 'focus') return;
      const pausedAt = now();
      apply((s) => {
        s.timer.startedAt = startedAt(s.timer, pausedAt);
        s.timer.pausedLeftMs = Math.max(0, s.timer.endAt - pausedAt);
        s.timer.endAt = null;
        s.timer.phase = 'paused';
      });
    },

    resume() {
      if (store.get().timer.phase !== 'paused') return;
      const resumedAt = now();
      apply((s) => {
        s.timer.startedAt = startedAt(s.timer, resumedAt);
        s.timer.endAt = resumedAt + s.timer.pausedLeftMs;
        s.timer.pausedLeftMs = null;
        s.timer.phase = 'focus';
      });
    },

    abandon() {
      const phase = store.get().timer.phase;
      if (phase !== 'focus' && phase !== 'paused') return;
      apply((s) => { s.timer = idleTimer(); });
    },

    finishNow() {
      const t = store.get().timer;
      if (t.phase !== 'focus' && t.phase !== 'paused') return false;
      const endedAt = now();
      apply((s) => {
        pushPomodoro(s, t, endedAt, 'manual');
        s.timer = { phase: 'break', topic: t.topic, endAt: endedAt + BREAK_MS, pausedLeftMs: null };
      });
      return true;
    },

    skipBreak() {
      if (store.get().timer.phase !== 'break') return;
      apply((s) => { s.timer = idleTimer(); });
    },

    // 主进程每秒调用一次;没到点就什么都不做,也不通知。
    // 写盘失败(磁盘满、文件被占用)时吞掉异常,状态保持原样,下一秒再试,
    // 否则每秒都会抛出未捕获异常,弹出错误框。
    tick() {
      const t = store.get().timer;
      if (t.endAt === null || t.endAt > now()) return;
      try {
        if (t.phase === 'focus') {
          apply((s) => {
            pushPomodoro(s, t, t.endAt, 'timer');
            s.timer = { phase: 'break', topic: t.topic, endAt: t.endAt + BREAK_MS, pausedLeftMs: null };
          });
          deliverAlert('focus-done');
        } else if (t.phase === 'break') {
          apply((s) => { s.timer = idleTimer(); });
          deliverAlert('break-done');
        }
      } catch (e) {
        console.error('番茄钟计时写盘失败,下一秒重试:', e.message);
      }
    },

    // 软件启动时调用:退出期间已过点的学习段补记番茄钟。
    init() {
      const t = store.get().timer;
      const r = recoverTimer(t, now());
      if (r.timer === t) return;
      apply((s) => {
        if (r.completed) pushPomodoro(s, t, r.completed.endedAt, 'timer');
        s.timer = r.timer;
      });
    },
  };
}

module.exports = { createTimer };
