// 诊断:可见性相关的真实状态与时钟变化。
module.exports = async function ({ js, wait, store, handlers, win }) {
  const p = (k, v) => console.log('DIAG ' + k + ' = ' + JSON.stringify(v));
  const clock = () => js(`document.getElementById('pomo-clock').textContent`);
  p('win.isVisible', win.isVisible());
  p('初始 document.hidden', await js(`document.hidden`));
  p('初始 visibilityState', await js(`document.visibilityState`));
  p('初始 root class', await js(`document.documentElement.className`));

  await js(`document.querySelector('[data-view="pomodoro"]').click()`);
  await js('(function(){var i=document.getElementById("pomo-topic");i.value="高数";i.dispatchEvent(new Event("input"));})()');
  await js(`document.getElementById('pomo-start').click()`);
  await wait(300);
  const c1 = await clock(); await wait(1200); const c2 = await clock();
  p('可见时 1.2 秒前后时钟', [c1, c2]);

  await js(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            document.dispatchEvent(new Event('visibilitychange'));`);
  await wait(150);
  p('覆盖后 document.hidden', await js(`document.hidden`));
  p('覆盖后 root class', await js(`document.documentElement.className`));
  const h1 = await clock(); await wait(1500); const h2 = await clock();
  p('隐藏时 1.5 秒前后时钟', [h1, h2]);

  await js(`delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));`);
  await wait(150);
  p('还原后 document.hidden', await js(`document.hidden`));
  p('还原后 root class', await js(`document.documentElement.className`));
  const r1 = await clock(); await wait(1200); const r2 = await clock();
  p('还原后 1.2 秒前后时钟', [r1, r2]);
};
