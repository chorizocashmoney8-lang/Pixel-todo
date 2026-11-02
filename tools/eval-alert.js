// 小窗口提醒检查:主进程发 pomodoro:alert,页面应该进入闪烁。
module.exports = async function ({ js, wait, win }) {
  const check = (name, ok, extra) => console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : ''));
  check('提醒前没有 alert 类', !(await js(`document.querySelector('.inner').classList.contains('alert')`)));
  win.webContents.send('pomodoro:alert', 'focus-done');
  await wait(200);
  check('收到提醒后进入 alert 状态', await js(`document.querySelector('.inner').classList.contains('alert')`));
  check('alert 状态正在播放闪烁动画', (await js(`getComputedStyle(document.querySelector('.inner')).animationName`)) === 'alert-flash');
  await wait(3300);
  check('3 秒后回到正常配色', (await js(`getComputedStyle(document.querySelector('.inner')).backgroundColor`)) === 'rgb(255, 255, 255)');
};
