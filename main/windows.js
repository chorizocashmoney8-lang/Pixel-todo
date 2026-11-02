// 角落小窗口与完整窗口。
const path = require('node:path');
const { BrowserWindow, screen } = require('electron');
const { clampToDisplays } = require('./position.js');

const WIDGET_SIZE = { w: 320, h: 200 };
const ROOT = path.join(__dirname, '..');

function baseWebPrefs() {
  return {
    preload: path.join(ROOT, 'preload', 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  };
}

function displayRects() {
  const primary = screen.getPrimaryDisplay();
  const others = screen.getAllDisplays().filter((d) => d.id !== primary.id);
  return [primary].concat(others).map((d) => d.workArea);
}

function createWidget(store) {
  const pos = clampToDisplays(store.get().prefs.widgetPos, WIDGET_SIZE, displayRects());
  const win = new BrowserWindow({
    x: pos.x,
    y: pos.y,
    width: WIDGET_SIZE.w,
    height: WIDGET_SIZE.h,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: store.get().prefs.alwaysOnTop,
    show: false,
    webPreferences: baseWebPrefs(),
  });
  win.loadFile(path.join(ROOT, 'renderer', 'widget', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('moved', () => {
    const [x, y] = win.getPosition();
    try {
      store.update((s) => { s.prefs.widgetPos = { x: x, y: y }; });
    } catch (e) {
      console.error('保存小窗口位置失败:', e.message); // 位置丢了无所谓,不能让它变成未捕获异常
    }
  });
  return win;
}

// 关闭完整窗口只是隐藏;真正退出走托盘菜单,把 quitting 置为 true。
function createAppWindow(state) {
  const win = new BrowserWindow({
    width: 880,
    height: 680,
    minWidth: 480,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    webPreferences: baseWebPrefs(),
  });
  win.loadFile(path.join(ROOT, 'renderer', 'app', 'index.html'));
  win.on('close', (e) => {
    if (!state.quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  return win;
}

function showAppWindow(win) {
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

module.exports = { createWidget, createAppWindow, showAppWindow };
