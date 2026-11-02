// 应用入口:单实例、开机自启、数据与计时、窗口与托盘。
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { createStore } = require('./store.js');
const { createTimer } = require('./timer.js');
const { createHandlers, register } = require('./ipc.js');
const { createWidget, createAppWindow, showAppWindow } = require('./windows.js');
const { createTray } = require('./tray.js');

const state = { quitting: false };

// 模块级引用:窗口和托盘必须在整个进程生命周期内被持有,否则可能被垃圾回收。
let appWindow = null;
let widget = null;
let trayCtl = null;

const ALERT_TEXT = {
  'focus-done': '学习结束,该休息了',
  'break-done': '休息结束',
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  start();
}

// 数据文件读不了(被杀毒软件、同步工具占用等)时,不能留下一个没有界面又占着单实例锁的僵死进程。
function fatal(error) {
  dialog.showErrorBox('Pixel Todo 无法启动',
    '读写数据文件失败,请稍后重试。\n\n' + (error && error.message ? error.message : String(error)));
  app.exit(1);
}

function openApp() {
  if (!appWindow || appWindow.isDestroyed()) return;
  showAppWindow(appWindow);
  appWindow.flashFrame(false);
  if (trayCtl) trayCtl.clearAlert();
}

function start() {
  app.on('second-instance', openApp);

  app.whenReady().then(() => {
    // 开发模式下运行的是 node_modules 里的裸 electron.exe,不能登记成开机启动项。
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });

    const store = createStore(app.getPath('userData'));
    // 状态每次改变后,把完整状态广播给所有窗口。
    const notify = () => {
      const snapshot = store.get();
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('state:changed', snapshot);
      });
      if (widget && !widget.isDestroyed()) widget.setAlwaysOnTop(snapshot.prefs.alwaysOnTop);
    };
    // 番茄钟自然走完:托盘图标反色、小窗口闪一下并浮到最上、完整窗口可见时任务栏闪烁。
    const onAlert = (kind) => {
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('pomodoro:alert', kind);
      });
      if (trayCtl) trayCtl.setAlert(ALERT_TEXT[kind]);
      if (widget && !widget.isDestroyed()) {
        widget.showInactive();
        widget.moveTop();
      }
      if (appWindow && !appWindow.isDestroyed() && appWindow.isVisible()) appWindow.flashFrame(true);
    };
    const timer = createTimer(store, Date.now, notify, onAlert);
    timer.init();
    register(ipcMain, createHandlers(store, timer, Date.now, notify));
    ipcMain.handle('window:openApp', openApp);

    widget = createWidget(store);
    appWindow = createAppWindow(state);
    trayCtl = createTray(openApp, () => {
      state.quitting = true;
      app.quit();
    });

    setInterval(() => timer.tick(), 1000);
  }).catch(fatal);

  // 所有窗口都隐藏时软件仍在后台运行,所以不响应 window-all-closed。
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => { state.quitting = true; });
}
