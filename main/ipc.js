// 渲染进程能做的所有操作都从这里进入。createHandlers 是纯逻辑(可测试),register 只负责挂到通道上。
const crypto = require('node:crypto');
const { isBlankText, parseLocalDate, todayString } = require('../renderer/shared/logic.js');

const PRIORITIES = ['high', 'mid', 'low'];
const WIDGET_COUNT_MIN = 1;
const WIDGET_COUNT_MAX = 8;

const isBoolean = (value) => typeof value === 'boolean';
const integerIn = (min, max) => (value) => Number.isInteger(value) && value >= min && value <= max;
const oneOf = (values) => (value) => values.includes(value);
const PREF_VALIDATORS = {
  theme: integerIn(0, 6),
  font: oneOf(['pixel', 'system']),
  buddy: isBoolean,
  idleMode: oneOf(['fixed', 'random']),
  face: integerIn(0, 3),
  pose: integerIn(0, 1),
  animate: isBoolean,
  sound: oneOf(['soft-pixel', 'clear-extended', 'bubble-response', 'custom']),
  volume: (value) => Number.isFinite(value) && value >= 0 && value <= 100,
  autoStart: isBoolean,
  alwaysOnTop: isBoolean,
  widgetCount: integerIn(WIDGET_COUNT_MIN, WIDGET_COUNT_MAX),
  widgetPos: (value) => value && typeof value === 'object' && !Array.isArray(value) &&
    Object.hasOwn(value, 'x') && Object.hasOwn(value, 'y') &&
    Number.isFinite(value.x) && Number.isFinite(value.y),
};

function validPriority(p) {
  return PRIORITIES.indexOf(p) !== -1;
}

// 只接受真实存在的 YYYY-MM-DD 日期(2026-02-31 会被拒绝)。
function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return todayString(parseLocalDate(s)) === s;
}

function createHandlers(store, timer, now, notify) {
  function exists(id, pred) {
    return store.get().tasks.some((t) => t.id === id && (!pred || pred(t)));
  }

  function change(fn) {
    store.update(fn);
    notify();
  }

  function findIn(draft, id) {
    return draft.tasks.find((t) => t.id === id);
  }

  return {
    getState() {
      return store.get();
    },

    addTask(input) {
      if (isBlankText(input.text)) return null;
      const task = {
        id: 't_' + crypto.randomUUID(),
        text: String(input.text).trim(),
        done: false,
        priority: validPriority(input.priority) ? input.priority : 'mid',
        dueDate: validDate(input.dueDate) ? input.dueDate : null,
        createdAt: now(),
        doneAt: null,
        deletedAt: null,
      };
      change((s) => { s.tasks.push(task); });
      return task;
    },

    updateTask(id, patch) {
      if (!exists(id)) return;
      change((s) => {
        const t = findIn(s, id);
        if (typeof patch.text === 'string' && !isBlankText(patch.text)) t.text = patch.text.trim();
        if (validPriority(patch.priority)) t.priority = patch.priority;
        if (patch.dueDate === null || validDate(patch.dueDate)) t.dueDate = patch.dueDate;
        if (typeof patch.done === 'boolean' && patch.done !== t.done) {
          t.done = patch.done;
          t.doneAt = patch.done ? now() : null;
        }
      });
    },

    deleteTask(id) {
      if (!exists(id, (t) => t.deletedAt === null)) return;
      change((s) => { findIn(s, id).deletedAt = now(); });
    },

    restoreTask(id) {
      if (!exists(id, (t) => t.deletedAt !== null)) return;
      change((s) => { findIn(s, id).deletedAt = null; });
    },

    purgeTask(id) {
      if (!exists(id)) return;
      change((s) => { s.tasks = s.tasks.filter((t) => t.id !== id); });
    },

    clearDone() {
      change((s) => {
        s.tasks.forEach((t) => {
          if (t.done && t.deletedAt === null) t.deletedAt = now();
        });
      });
    },

    emptyTrash() {
      change((s) => { s.tasks = s.tasks.filter((t) => t.deletedAt === null); });
    },

    setPrefs(patch) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return;
      const accepted = {};
      for (const [key, validate] of Object.entries(PREF_VALIDATORS)) {
        if (!Object.hasOwn(patch, key) || !validate(patch[key])) continue;
        const value = patch[key];
        accepted[key] = key === 'widgetPos' ? { x: value.x, y: value.y } : value;
      }
      // customSoundName 及文件路径仅由主进程音频导入 handler 写入。
      if (Object.keys(accepted).length === 0) return;
      change((s) => { Object.assign(s.prefs, accepted); });
    },

    startPomodoro: (topic) => timer.start(topic),
    pausePomodoro: () => timer.pause(),
    resumePomodoro: () => timer.resume(),
    abandonPomodoro: () => timer.abandon(),
    finishPomodoro: () => timer.finishNow(),
    skipBreak: () => timer.skipBreak(),
  };
}

// 通道名与 preload.js 暴露的方法一一对应。
function register(ipcMain, h) {
  const routes = {
    'state:get': () => h.getState(),
    'task:add': (input) => h.addTask(input),
    'task:update': (id, patch) => h.updateTask(id, patch),
    'task:delete': (id) => h.deleteTask(id),
    'task:restore': (id) => h.restoreTask(id),
    'task:purge': (id) => h.purgeTask(id),
    'task:clearDone': () => h.clearDone(),
    'trash:empty': () => h.emptyTrash(),
    'pomodoro:start': (topic) => h.startPomodoro(topic),
    'pomodoro:pause': () => h.pausePomodoro(),
    'pomodoro:resume': () => h.resumePomodoro(),
    'pomodoro:abandon': () => h.abandonPomodoro(),
    'pomodoro:finish': () => h.finishPomodoro(),
    'pomodoro:skipBreak': () => h.skipBreak(),
    'prefs:set': (patch) => h.setPrefs(patch),
  };
  Object.keys(routes).forEach((channel) => {
    ipcMain.handle(channel, (_event, ...args) => routes[channel](...args));
  });
}

module.exports = { createHandlers, register };
