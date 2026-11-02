// 数据文件读写。主进程是唯一写入者,所有修改都经过 update。
const fs = require('node:fs');
const path = require('node:path');

const FILE = 'pixel-todo.json';
const TRASH_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

function emptyState() {
  return {
    version: 3,
    tasks: [],
    pomodoros: [],
    timer: { phase: 'idle', topic: '', endAt: null, pausedLeftMs: null },
    prefs: { alwaysOnTop: false, widgetCount: 4, recentTopics: [] },
  };
}

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

// 缺失的字段用默认值补齐,多余的字段保留。
function normalize(raw) {
  const base = emptyState();
  return {
    version: 3,
    tasks: Array.isArray(raw.tasks) ? raw.tasks : base.tasks,
    pomodoros: Array.isArray(raw.pomodoros) ? raw.pomodoros : base.pomodoros,
    timer: Object.assign(base.timer, raw.timer),
    prefs: Object.assign(base.prefs, raw.prefs),
  };
}

function createStore(dir, now) {
  const clock = now || Date.now;
  const file = path.join(dir, FILE);
  let state;

  function writeFile(s) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
    fs.renameSync(tmp, file);
  }

  function load() {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      return emptyState();
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = null;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      fs.renameSync(file, file + '.corrupt-' + clock());
      return emptyState();
    }
    return normalize(parsed);
  }

  fs.mkdirSync(dir, { recursive: true });
  state = load();
  const cutoff = clock() - TRASH_KEEP_MS;
  state.tasks = state.tasks.filter((t) => t.deletedAt === null || t.deletedAt === undefined || t.deletedAt >= cutoff);
  writeFile(state);

  return {
    get() {
      return clone(state);
    },
    // fn 抛错或写盘失败时,内存状态和磁盘文件都保持原样。
    update(fn) {
      const draft = clone(state);
      fn(draft);
      writeFile(draft);
      state = draft;
      return clone(state);
    },
    flush() {
      writeFile(state);
    },
  };
}

module.exports = { createStore, emptyState, FILE };
