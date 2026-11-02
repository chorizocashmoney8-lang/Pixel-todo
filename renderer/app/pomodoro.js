(() => {
  'use strict';
  const A = window.PixelApp, { $, element: el, L } = A;
  let previousPhase = 'idle';
  const methods = { pomoPause: 'pausePomodoro', pomoResume: 'resumePomodoro', pomoFinish: 'finishPomodoro', pomoAbandon: 'abandonPomodoro', pomoSkip: 'skipBreak' };
  function start() {
    if (!A.state || A.state.timer.phase !== 'idle') return;
    const topic = $('pomoTopic').value.trim();
    if (!topic) { $('pomoTopic').focus(); return; }
    return A.action($('pomoStart'), () => A.mutate('startPomodoro', topic), '无法开始专注。');
  }
  function render(state) {
    const phase = state.timer.phase, idle = phase === 'idle';
    $('view-pomodoro').dataset.phase = phase;
    if (!idle) $('pomoTopic').value = state.timer.topic || '';
    else if (previousPhase !== 'idle') $('pomoTopic').value = '';
    previousPhase = phase;
    $('pomoTopic').disabled = !idle;
    for (const [id, visible] of Object.entries({ pomoStart: idle, pomoPause: phase === 'focus', pomoResume: phase === 'paused', pomoFinish: phase === 'focus' || phase === 'paused', pomoAbandon: phase === 'focus' || phase === 'paused', pomoSkip: phase === 'break' })) {
      $(id).hidden = !visible;
      $(id).disabled = Boolean($(id).dataset.busy);
    }
    $('pomoStart').disabled ||= !$('pomoTopic').value.trim();
    const recents = $('recentTopics');
    const topics = Array.from(new Set(state.prefs.recentTopics || [])).slice(0, 8);
    const key = JSON.stringify([topics, idle]);
    if (recents.dataset.key !== key) {
      recents.dataset.key = key; recents.replaceChildren();
      topics.forEach(topic => {
        const button = el('button', 'topic-chip', topic); button.type = 'button'; button.disabled = !idle;
        button.onclick = () => { $('pomoTopic').value = topic; $('pomoTopic').dispatchEvent(new Event('input')); $('pomoTopic').focus(); };
        recents.append(button);
      });
    }
    $('pomoToday').textContent = L.countPomodoros(state.pomodoros, new Date()).today;
    clock(state);
  }
  function clock(state) {
    const t = state.timer;
    $('pomoClock').textContent = A.clockText();
    $('pomoStatus').textContent = ({ idle: '准备开始', focus: '学习中', paused: '已暂停', break: '休息中' })[t.phase] || '准备开始';
    $('pomoCaption').textContent = t.phase === 'idle' ? '准备好了，就开始吧。' : t.phase === 'break' ? '歇一会儿，休息结束后再开始。' : (t.topic || '专心学习');
    const total = t.phase === 'break' ? 300000 : 1500000;
    const left = t.phase === 'idle' ? total : t.phase === 'paused' ? t.pausedLeftMs : (t.endAt || Date.now()) - Date.now();
    const pct = Math.max(0, Math.min(100, (1 - left / total) * 100));
    $('pomoProgress').style.width = pct + '%';
    $('pomoProgress').parentElement.setAttribute('aria-valuenow', Math.round(pct));
  }
  A.views.pomodoro = {
    init() {
      $('pomoStart').onclick = start;
      $('pomoTopic').oninput = () => { $('pomoStart').disabled = Boolean($('pomoStart').dataset.busy) || !$('pomoTopic').value.trim(); };
      $('pomoTopic').onkeydown = event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); start(); } };
      for (const [id, method] of Object.entries(methods)) $(id).onclick = () => A.action($(id), async () => {
        await A.mutate(method);
        if (method === 'finishPomodoro') A.toast('已记 1 次手动完成。歇一会儿吧。');
      }, '计时操作没有成功。');
    }, render, clock
  };
})();
