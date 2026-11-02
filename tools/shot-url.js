// 验证用:打开一个网址截图,并检查指定字体是否真的加载上了。
const { spawn } = require('node:child_process');
if (process.versions.electron) {
  const { app, BrowserWindow } = require('electron');
  const fs = require('node:fs');
  const [urlArg, out, fontName] = process.argv.slice(2);
  const url = urlArg.startsWith('@') ? fs.readFileSync(urlArg.slice(1), 'utf8').trim() : urlArg;
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ width: 1200, height: Number(process.env.SHOT_H || 1000), show: false });
    await win.loadURL(url);
    await new Promise((r) => setTimeout(r, 1500));
    if (process.env.SHOT_SCROLL) await win.webContents.executeJavaScript('[document.scrollingElement, ...document.querySelectorAll("*")].filter(e => e && e.scrollHeight > e.clientHeight + 10).forEach(e => { e.scrollTop = ' + Number(process.env.SHOT_SCROLL) + '; })');
    await new Promise((r) => setTimeout(r, 300));
    await new Promise((r) => setTimeout(r, 500));
    const loaded = await win.webContents.executeJavaScript(
      `document.fonts.ready.then(() => [...document.fonts].filter(f => f.family.includes(${JSON.stringify(fontName)})).map(f => f.status).join(','))`);
    const check = await win.webContents.executeJavaScript(`document.fonts.check('12px ${fontName}', '交周报')`);
    console.log('字体状态: ' + (loaded || '(未声明)') + '  中文可用: ' + check);
    fs.writeFileSync(out, (await win.webContents.capturePage()).toPNG());
    console.log('截图已保存');
    app.quit();
  });
} else {
  const env = Object.assign({}, process.env);
  delete env.ELECTRON_RUN_AS_NODE;
  spawn(require('electron'), [__filename].concat(process.argv.slice(2)), { env, stdio: 'inherit' })
    .on('exit', (code) => process.exit(code || 0));
}
