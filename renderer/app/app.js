/* Main window: state remains owned by the host; this renderer contains no demo data. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const defaults = { theme: 0, font: 'pixel', buddy: true, idleMode: 'fixed', face: 0, pose: 0, animate: true, sound: 'clear-extended', volume: 25, autoStart: true, alwaysOnTop: false, recentTopics: [] };
  let state = null, view = 'todo', activity = false, revision = 0;
  let toastTimer, toastAction, ticker, buddyCleanup, bubbleTicker, bubbleIndex = 0;
  const disposers = [];
  const views = {};
  const api = window.pixelApi;
  const L = window.PixelLogic;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  function toast(text, action) {
    clearTimeout(toastTimer);
    toastAction = action || null;
    $('toastText').textContent = text;
    $('toastUndo').hidden = !action;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; toastAction = null; }, action ? 10000 : 6500);
  }
  function report(error, fallback = '操作没有成功，请重试。') {
    console.error(error);
    toast(error?.message ? `${fallback} ${error.message}` : fallback);
  }
  function normalize(raw) {
    return { ...raw, tasks: raw.tasks || [], pomodoros: raw.pomodoros || [], timer: raw.timer || { phase: 'idle', topic: '', endAt: null, pausedLeftMs: null }, prefs: { ...defaults, ...raw.prefs } };
  }
  function applyAppearance() {
    if (!state) return;
    window.PixelAppearance?.apply(state.prefs);
    document.dispatchEvent(new Event('pixel-prefs'));
    document.getElementById('footerBuddy').classList.toggle('focus', state.timer.phase === 'focus');
    document.getElementById('footerBuddy').classList.toggle('break', state.timer.phase === 'break');
    document.body.classList.toggle('system-font', state.prefs.font === 'system');
    document.body.classList.toggle('reduce-motion', !state.prefs.animate);
    document.documentElement.classList.toggle('activity-paused', !isActive());
    $('footerBuddy').hidden = $('footerBubble').hidden = !state.prefs.buddy;
    if (!buddyCleanup && window.PixelAppearance?.startBuddy) {
      buddyCleanup = window.PixelAppearance.startBuddy($('footerBuddy'), () => state.prefs);
    }
    // startBuddy owns random changes and activity pauses. Fixed settings update immediately.
    if (state.prefs.idleMode === 'fixed' && window.PixelAppearance?.sprite) {
      $('footerBuddy').innerHTML = window.PixelAppearance.sprite(state.prefs);
    }
  }
  function render(raw) {
    if (!raw) return;
    state = normalize(raw);
    applyAppearance();
    for (const page of Object.values(views)) page.render(state);
    const counts = L.countPomodoros(state.pomodoros, new Date());
    $('footerCount').textContent = `${counts.today} 个番茄钟`;
    renderBubble();
    updateClock();
    syncActivity();
  }
  async function refresh() {
    const startRevision = revision;
    const next = await api.getState();
    if (revision === startRevision) render(next);
  }
  async function invoke(method, ...args) {
    if (typeof api?.[method] !== 'function') throw new Error('此功能尚未连接，请更新后重试。');
    return await api[method](...args);
  }
  async function mutate(method, ...args) {
    const result = await invoke(method, ...args);
    if (result === false) throw new Error('当前状态不允许此操作，请重试。');
    await refresh();
    return result;
  }
  async function action(button, fn, fallback) {
    if (button?.dataset.busy) return;
    if (button) { button.dataset.busy = 'true'; button.disabled = true; }
    try { return await fn(); }
    catch (error) { report(error, fallback); }
    finally {
      if (button) { delete button.dataset.busy; button.disabled = false; }
      if (state) for (const page of Object.values(views)) page.render(state);
    }
  }
  function showView(name) {
    if (!views[name]) return;
    view = name;
    document.querySelectorAll('.view').forEach(page => { page.hidden = page.id !== `view-${name}`; });
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
    document.querySelector('.app-content').scrollTop = 0;
    if (name !== 'settings') views.settings?.stopAudio();
    if (state) views[name].render(state);
  }
  function isActive() { return activity && !document.hidden; }
  function clockText() {
    if (!state) return '25:00';
    const t = state.timer;
    const ms = t.phase === 'idle' ? 1500000 : t.phase === 'paused' ? (t.pausedLeftMs || 0) : Math.max(0, (t.endAt || Date.now()) - Date.now());
    return L.formatClock(ms);
  }
  function updateClock() {
    if (!state) return;
    const phase = state.timer.phase;
    $('headerPhase').textContent = phase === 'idle' ? '等你开始' : `${({ focus: '专注', paused: '已暂停', break: '休息' })[phase] || '待开始'} · ${clockText()}`;
    views.pomodoro?.clock(state);
  }
  function renderBubble() {
    if (!state) return;
    const remaining = state.tasks.filter(t => t.deletedAt == null && !t.done).length;
    const phase = state.timer.phase;
    const lines = phase === 'focus' ? ['慢慢来，我陪你专心做。', '先把眼前这一小段做好。'] : phase === 'paused' ? ['歇口气，准备好了再继续。', '没关系，按你的节奏来。'] : phase === 'break' ? ['起来活动一下，喝口水吧。', '这一小关完成了，歇一会儿。'] : remaining ? [`还剩 ${remaining} 件，先做一件就好。`, '不用着急，我在这里陪你。'] : ['写下想做的事，我们慢慢来。', '今天也辛苦啦，记得照顾自己。'];
    $('footerBubble').textContent = lines[bubbleIndex % lines.length];
  }
  function syncActivity() {
    const active = isActive();
    const timed = state && ['focus', 'break'].includes(state.timer.phase);
    document.documentElement.classList.toggle('activity-paused', !active);
    if (active && timed && !ticker) ticker = setInterval(updateClock, 250);
    else if ((!active || !timed) && ticker) { clearInterval(ticker); ticker = null; }
    if (active && state?.prefs.buddy && !bubbleTicker) bubbleTicker = setInterval(() => { bubbleIndex++; renderBubble(); }, 10000);
    else if ((!active || !state?.prefs.buddy) && bubbleTicker) { clearInterval(bubbleTicker); bubbleTicker = null; }
    if (!active) views.settings?.stopAudio();
  }
  window.PixelApp = { $, element, views, L, toast, report, invoke, mutate, action, showView, clockText, get state() { return state; }, get view() { return view; }, isActive };
  document.addEventListener('DOMContentLoaded', async () => {
    for (const page of Object.values(views)) page.init();
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
    $('minimizeApp').onclick = () => action($('minimizeApp'), () => invoke('minimizeApp'), '无法收起窗口。');
    $('hideApp').onclick = () => action($('hideApp'), () => invoke('hideApp'), '无法隐藏窗口。');
    $('toastUndo').onclick = () => { const undo = toastAction; if (undo) action($('toastUndo'), undo, '撤销失败。'); };
    document.addEventListener('visibilitychange', () => { updateClock(); syncActivity(); });
    document.addEventListener('keydown', event => {
      if (event.isComposing) return;
      const typing = event.target.matches('input,textarea,select,[contenteditable=true]');
      if (event.key === '/' && !typing && !$('editDialog').open) { event.preventDefault(); showView('todo'); $('taskInput').focus(); }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && $('editDialog').open) { event.preventDefault(); $('editForm').requestSubmit(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !typing && !$('editDialog').open && toastAction) { event.preventDefault(); $('toastUndo').click(); }
      if (event.key === 'Escape' && !$('editDialog').open) { $('toast').hidden = true; toastAction = null; }
    });
    if (!api || !L) { toast('无法读取本机数据，请重新打开 Pixel Todo。'); return; }
    if (api.onActivityChanged) disposers.push(api.onActivityChanged(value => { activity = Boolean(value); updateClock(); syncActivity(); }));
    disposers.push(api.onStateChanged(next => { revision++; render(next); }));
    showView('todo');
    try { await refresh(); }
    catch (error) { report(error, '读取本机数据失败，请重新打开窗口。'); }
  });
  window.addEventListener('beforeunload', () => {
    clearTimeout(toastTimer); clearInterval(ticker); clearInterval(bubbleTicker);
    buddyCleanup?.();
    views.settings?.stopAudio();
    disposers.forEach(dispose => { if (typeof dispose === 'function') dispose(); });
  });
})();



