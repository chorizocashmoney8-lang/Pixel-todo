// 只向页面暴露有限的方法,页面拿不到 Node 和 Electron 本身。
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pixelApi', {
  getState: () => ipcRenderer.invoke('state:get'),
  addTask: (input) => ipcRenderer.invoke('task:add', input),
  updateTask: (id, patch) => ipcRenderer.invoke('task:update', id, patch),
  deleteTask: (id) => ipcRenderer.invoke('task:delete', id),
  restoreTask: (id) => ipcRenderer.invoke('task:restore', id),
  purgeTask: (id) => ipcRenderer.invoke('task:purge', id),
  clearDone: () => ipcRenderer.invoke('task:clearDone'),
  emptyTrash: () => ipcRenderer.invoke('trash:empty'),
  startPomodoro: (topic) => ipcRenderer.invoke('pomodoro:start', topic),
  pausePomodoro: () => ipcRenderer.invoke('pomodoro:pause'),
  resumePomodoro: () => ipcRenderer.invoke('pomodoro:resume'),
  abandonPomodoro: () => ipcRenderer.invoke('pomodoro:abandon'),
  skipBreak: () => ipcRenderer.invoke('pomodoro:skipBreak'),
  setPrefs: (patch) => ipcRenderer.invoke('prefs:set', patch),
  openApp: () => ipcRenderer.invoke('window:openApp'),
  onPomodoroAlert: (cb) => {
    const listener = (_event, kind) => cb(kind);
    ipcRenderer.on('pomodoro:alert', listener);
    return () => ipcRenderer.removeListener('pomodoro:alert', listener);
  },
  onStateChanged: (cb) => {
    const listener = (_event, state) => cb(state);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  },
});
