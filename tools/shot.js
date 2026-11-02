// 验证用:在临时数据目录里放入测试数据,加载真实页面,截图并打印页面文字。
// 用法: node tools/shot.js <widget|app> <输出.png> [宽 高]
const { spawn } = require('node:child_process');
const electron = require('electron');

if (process.versions.electron) {
  const { app, BrowserWindow, ipcMain } = require('electron');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const { createStore } = require(path.join(root, 'main/store.js'));
  const { createTimer } = require(path.join(root, 'main/timer.js'));
  const { createHandlers, register } = require(path.join(root, 'main/ipc.js'));
  const [page, out, w, h] = process.argv.slice(2);

  app.whenReady().then(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-shot-'));
    const store = createStore(dir);
    let win = null;
    // 和 main.js 一样:状态改变后向页面广播,否则页面不会刷新。
    const notify = () => { if (win && !win.isDestroyed()) win.webContents.send('state:changed', store.get()); };
    const timer = createTimer(store, Date.now, notify);
    const handlers = createHandlers(store, timer, Date.now, notify);
    register(ipcMain, handlers);
    ipcMain.handle('window:openApp', () => {});
    const seed = process.env.SHOT_SEED ? require(path.resolve(process.env.SHOT_SEED)) : () => {};
    seed(handlers, timer);

    win = new BrowserWindow({
      width: Number(w || 260), height: Number(h || 200), show: false, frame: false,
      webPreferences: { preload: path.join(root, 'preload/preload.js'), contextIsolation: true, nodeIntegration: false },
    });
    win.webContents.on('console-message', (_e, level, msg) => console.log('[console]', msg));
    await win.loadFile(path.join(root, 'renderer', page, 'index.html'));
    await new Promise((r) => setTimeout(r, 700));
    if (process.env.SHOT_EVAL) {
      win.showInactive(); // 隐藏窗口不会绘制新帧,截图会停在加载时的画面
      await new Promise((r) => setTimeout(r, 300));
      const run = require(path.resolve(process.env.SHOT_EVAL));
      const js = (code) => win.webContents.executeJavaScript(code);
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      await run({ js, wait, store, handlers, timer, win });
    }
    const text = await win.webContents.executeJavaScript('document.body.innerText');
    console.log('--- 页面文字 ---\n' + text);
    win.webContents.invalidate();
    await new Promise((r) => setTimeout(r, 500));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(out, img.toPNG());
    console.log('截图已保存: ' + out);
    app.quit();
  });
} else {
  const env = Object.assign({}, process.env);
  delete env.ELECTRON_RUN_AS_NODE;
  spawn(electron, [__filename].concat(process.argv.slice(2)), { env, stdio: 'inherit' })
    .on('exit', (code) => process.exit(code || 0));
}
