(function () {
  const api = window.pixelApi, L = window.PixelLogic, A = window.PixelAppearance;
  let state = null, clockId = null, bubbleId = null, sentence = 0;
  const $ = id => document.getElementById(id);
  function tick() {
    if (!state) return;
    const t = state.timer, label = {idle:'待开始', focus:'专注中', paused:'已暂停', break:'休息中'}[t.phase];
    const ms = t.phase === 'idle' ? 1500000 : t.phase === 'paused' ? t.pausedLeftMs : Math.max(0,t.endAt-Date.now());
    $('clock').textContent = label + ' · ' + L.formatClock(ms);
  }
  function speak() {
    if (!state) return;
    const tasks = L.sortTasks(state.tasks.filter(t => !t.done && t.deletedAt == null));
    const messages = state.timer.phase === 'break' ? ['休息一下吧。','要不要起来走走？'] : tasks.length ? ['还剩 '+tasks.length+' 件，先做一件就好。', '接下来是“'+L.truncateText(tasks[0].text,10)+'”。','专心一小会儿，我在这里陪你。'] : ['今天的待办都完成啦。','今天也辛苦啦。'];
    $('bubble').textContent = messages[sentence++ % messages.length];
  }
  function sync() {
    const visible = !document.hidden;
    const run = visible && state && ['focus','break'].includes(state.timer.phase);
    if (run && clockId === null) clockId = setInterval(tick,1000);
    if (!run && clockId !== null) { clearInterval(clockId); clockId=null; }
    const chat = visible && state && state.prefs.buddy && state.prefs.animate && A.isActive();
    if (chat && bubbleId === null) bubbleId = setInterval(speak,12000);
    if (!chat && bubbleId !== null) { clearInterval(bubbleId); bubbleId=null; }
  }
  function render(next) {
    state=next; A.apply(next.prefs); $('buddyRow').hidden=!next.prefs.buddy;
    const tasks=L.sortTasks(next.tasks.filter(t=>!t.done&&t.deletedAt==null)); $('count').textContent=tasks.length+' 件';
    $('list').replaceChildren();
    tasks.slice(0,2).forEach(t=>{const row=document.createElement('div'); row.className='task'; const title=document.createElement('span'); title.textContent='▫ '+t.text; row.title=t.text; const due=document.createElement('small'); due.textContent=L.dueLabel(t.dueDate,L.todayString(new Date())); row.append(title,due); $('list').append(row);});
    if(!tasks.length){const p=document.createElement('div');p.className='empty';p.textContent='暂无待办';$('list').append(p);}
    $('buddy').classList.toggle('focus',next.timer.phase==='focus');$('buddy').classList.toggle('break',next.timer.phase==='break');
    document.dispatchEvent(new Event('pixel-prefs')); tick();speak();sync();
  }
  $('hide').onclick=e=>{e.stopPropagation();api.hideWidget();}; $('widget').onclick=e=>{if(!e.target.closest('.dragmark'))api.openApp();};
  A.startBuddy($('buddy'),()=>state&&state.prefs);
  document.addEventListener('visibilitychange',()=>{tick();sync();}); api.onActivityChanged(sync);
  api.onStateChanged(render);api.getState().then(render);
})();
