// 番茄钟页与统计页检查。用把 endAt 改到过去再 tick() 的办法模拟时间流逝。
module.exports = async function ({ js, wait, store, timer }) {
  const check = (name, ok, extra) => console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : ''));
  const q = (sel, prop) => js(`document.querySelector('${sel}').${prop}`);
  const click = (id) => js(`document.getElementById('${id}').click()`);
  const setTopic = (v) => js('(function(){var i=document.getElementById("pomo-topic");i.value=' + JSON.stringify(v) + ';i.dispatchEvent(new Event("input"));})()');
  const tab = (name) => js(`document.querySelector('[data-view="${name}"]').click()`);

  await tab('pomodoro');
  await wait(100);
  check('番茄钟页可见', !(await q('#view-pomodoro', 'hidden')));
  check('待办页已隐藏', await q('#view-todo', 'hidden'));
  check('空内容时「开始」不可用', await q('#pomo-start', 'disabled'));
  check('初始显示 25:00', (await q('#pomo-clock', 'textContent')) === '25:00');

  await setTopic('   ');
  check('只有空白时「开始」仍不可用', await q('#pomo-start', 'disabled'));

  await setTopic('高数');
  check('填了内容后「开始」可用', !(await q('#pomo-start', 'disabled')));
  await click('pomo-start');
  await wait(300);
  check('开始后进入学习中', (await q('#pomo-phase', 'textContent')) === '学习中');
  const clock = await q('#pomo-clock', 'textContent');
  check('倒计时从 25:00 附近开始', clock === '25:00' || clock === '24:59', clock);
  check('学习内容框被锁定', await q('#pomo-topic', 'disabled'));
  check('学习中只显示 暂停/放弃', !(await q('#pomo-pause', 'hidden')) && !(await q('#pomo-abandon', 'hidden')) &&
    (await q('#pomo-start', 'hidden')) && (await q('#pomo-skip', 'hidden')));

  // 暂停 / 继续
  await click('pomo-pause');
  await wait(300);
  check('暂停后显示已暂停', (await q('#pomo-phase', 'textContent')) === '已暂停');
  check('暂停后出现「继续」', !(await q('#pomo-resume', 'hidden')));
  const frozen = await q('#pomo-clock', 'textContent');
  await wait(1300);
  check('暂停期间时间不走', (await q('#pomo-clock', 'textContent')) === frozen, frozen);
  await click('pomo-resume');
  await wait(300);
  check('继续后回到学习中', (await q('#pomo-phase', 'textContent')) === '学习中');

  // 放弃:不记数
  await click('pomo-abandon');
  await wait(300);
  check('放弃后回到待开始', (await q('#pomo-phase', 'textContent')) === '待开始');
  check('放弃不计番茄钟', store.get().pomodoros.length === 0);

  // 最近用过的内容可一键填入
  check('最近内容按钮出现', (await js(`document.getElementById('pomo-recent').innerText`)).includes('高数'));
  await js(`document.querySelector('#pomo-recent .btn').click()`);
  check('点最近内容后填入输入框', (await q('#pomo-topic', 'value')) === '高数');

  // 完整走完一个学习段 -> 记录 + 休息
  await click('pomo-start');
  await wait(200);
  store.update((s) => { s.timer.endAt = Date.now() - 1000; });
  timer.tick();
  await wait(400);
  check('学习段到点后记 1 个番茄钟', store.get().pomodoros.length === 1);
  check('进入休息中', (await q('#pomo-phase', 'textContent')) === '休息中');
  check('休息只显示「跳过休息」', !(await q('#pomo-skip', 'hidden')) && (await q('#pomo-pause', 'hidden')));
  const left = await q('#pomo-clock', 'textContent');
  check('休息倒计时在 5 分钟以内', /^0[0-5]:\d\d$/.test(left), left);

  // 统计页
  await tab('stats');
  await wait(150);
  check('统计页可见', !(await q('#view-stats', 'hidden')));
  check('今天=1 本周=1 全部=1', (await js(`['stat-today','stat-week','stat-total'].map(i => document.getElementById(i).textContent).join(',')`)) === '1,1,1');
  check('按内容列出 高数 1', (await js(`document.getElementById('stat-topics').innerText`)).replace(/\s+/g, ' ').includes('高数 1'));
  check('最近记录里有 高数', (await js(`document.getElementById('stat-recent').innerText`)).includes('高数'));

  // 跳过休息;再来一个不同内容的番茄钟
  await tab('pomodoro');
  await click('pomo-skip');
  await wait(300);
  check('跳过休息后待开始', (await q('#pomo-phase', 'textContent')) === '待开始');
  check('回到待开始后内容框已清空', (await q('#pomo-topic', 'value')) === '');
  await setTopic('<b>英语</b>');
  await click('pomo-start');
  await wait(200);
  store.update((s) => { s.timer.endAt = Date.now() - 500; });
  timer.tick();
  await wait(400);
  await tab('stats');
  await wait(150);
  const topics = (await js(`document.getElementById('stat-topics').innerText`)).replace(/\s+/g, ' ');
  check('统计按内容分别计数', topics.includes('高数 1') && topics.includes('<b>英语</b> 1'), topics);
  check('统计页没有解析出 <b> 元素', (await js(`document.querySelectorAll('#view-stats b').length`)) === 0);
  check('全部=2', (await q('#stat-total', 'textContent')) === '2');
};
