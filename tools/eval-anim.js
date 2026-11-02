// 动画检查:读真实页面的计算样式,不靠肉眼。
module.exports = async function ({ js, wait, store, timer, handlers }) {
  const check = (name, ok, extra) => console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : ''));
  const anim = (sel) => js(`(function(){var e=document.querySelector('${sel}');return e?getComputedStyle(e).animationName:'(无元素)';})()`);
  const tab = (n) => js(`document.querySelector('[data-view="${n}"]').click()`);
  const setTopic = (v) => js('(function(){var i=document.getElementById("pomo-topic");i.value=' + JSON.stringify(v) + ';i.dispatchEvent(new Event("input"));})()');

  // 勾选弹跳:点击后(重新渲染之后)复选框上还能看到动画
  handlers.addTask({ text: '弹跳测试' });
  await wait(200);
  await js(`document.querySelector('#task-list .check').click()`);
  await wait(60);
  check('勾选后复选框正在播放 pop 动画', (await anim('#task-list .check.pop')) === 'pop');

  // 番茄钟:学习段进度条末格闪烁
  await tab('pomodoro');
  await setTopic('高数');
  await js(`document.getElementById('pomo-start').click()`);
  await wait(200);
  store.update((s) => { s.timer.endAt = Date.now() + 20 * 60 * 1000; }); // 已走过 5 分钟
  handlers.setPrefs({}); // 直接改了 store,要广播一次页面才会拿到新的 endAt
  await wait(1500);
  check('学习段进度条有已走过的格子', (await js(`document.querySelectorAll('#pomo-bar .on').length`)) > 0);
  check('学习段进度条末格在闪烁', (await anim('#pomo-bar .on.head')) === 'blink');
  check('学习段不显示休息小图案', (await js(`getComputedStyle(document.querySelector('.nap')).display`)) === 'none');

  // 窗口隐藏 -> 动画暂停
  await js(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            document.dispatchEvent(new Event('visibilitychange'));`);
  await wait(100);
  check('窗口隐藏后根元素带 paused', await js(`document.documentElement.classList.contains('paused')`));
  check('隐藏后动画处于暂停', (await js(`getComputedStyle(document.querySelector('#pomo-bar .on.head')).animationPlayState`)) === 'paused');
  check('隐藏后倒计时刷新定时器被清除(时钟不再变化)', await (async () => {
    const a = await js(`document.getElementById('pomo-clock').textContent`);
    await wait(1400);
    return a === (await js(`document.getElementById('pomo-clock').textContent`));
  })());
  await js(`delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));`);
  await wait(100);
  check('窗口重新可见后恢复', !(await js(`document.documentElement.classList.contains('paused')`)));

  // 完成 -> 卡片闪烁 + 休息小图案
  store.update((s) => { s.timer.endAt = Date.now() - 500; });
  timer.tick();
  await wait(150);
  check('完成番茄钟时卡片闪烁', (await anim('.pomo-card.flash')) === 'flash');
  check('休息段显示小图案并循环', (await anim('.nap')) === 'nap' &&
    (await js(`getComputedStyle(document.querySelector('.nap')).display`)) === 'block');
};
