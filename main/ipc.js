// 渲染进程能做的所有操作都从这里进入。createHandlers 是纯逻辑(可测试),register 只负责挂到通道上。
const crypto = require('node:crypto');
const { isBlankText, parseLocalDate, todayString } = require('../renderer/shared/logic.js');

const PRIORITIES = ['high', 'mid', 'low'];
const WIDGET_COUNT_MIN = 1;
const WIDGET_COUNT_MAX = 8;

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
      change((s) => {
        if (typeof patch.alwaysOnTop === 'boolean') s.prefs.alwaysOnTop = patch.alwaysOnTop;
        if (Number.isInteger(patch.widgetCount) &&
            patch.widgetCount >= WIDGET_COUNT_MIN && patch.widgetCount <= WIDGET_COUNT_MAX) {
          s.prefs.widgetCount = patch.widgetCount;
        }
        const pos = patch.widgetPos;
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
          s.prefs.widgetPos = { x: pos.x, y: pos.y };
        }
      });
    },

    startPomodoro: (topic) => timer.start(topic),
    pausePomodoro: () => timer.pause(),
    resumePomodoro: () => timer.resume(),
    abandonPomodoro: () => timer.abandon(),
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
    'pomodoro:skipBreak': () => h.skipBreak(),
    'prefs:set': (patch) => h.setPrefs(patch),
  };
  Object.keys(routes).forEach((channel) => {
    ipcMain.handle(channel, (_event, ...args) => routes[channel](...args));
  });
}

module.exports = { createHandlers, register };
