// 完整窗口 · 番茄钟页。倒计时只按主进程给的 endAt 显示,窗口隐藏时不留定时器。
(function () {
  var L = window.PixelLogic;
  var api = window.pixelApi;
  var PHASE_LABEL = { idle: '待开始', focus: '学习中', break: '休息中', paused: '已暂停' };
  var TOTAL_MS = { focus: 25 * 60 * 1000, break: 5 * 60 * 1000 };
  var CELLS = 20;

  var state = null;
  var timerId = null;
  var lastCount = null;

  function $(id) { return document.getElementById(id); }

  function leftMs() {
    var t = state.timer;
    if (t.phase === 'paused') return t.pausedLeftMs;
    if (t.endAt === null) return 0;
    return Math.max(0, t.endAt - Date.now());
  }

  // 暂停时无法区分暂停的是学习段,所以暂停只可能来自学习段。
  function totalFor(phase) {
    return TOTAL_MS[phase === 'paused' ? 'focus' : phase] || 0;
  }

  function renderBar(phase, left) {
    var bar = $('pomo-bar');
    var total = totalFor(phase);
    var filled = total === 0 ? 0 : Math.round((1 - left / total) * CELLS);
    if (bar.childElementCount !== CELLS) {
      bar.textContent = '';
      for (var i = 0; i < CELLS; i++) bar.appendChild(document.createElement('span'));
    }
    Array.prototype.forEach.call(bar.children, function (c, i) {
      c.className = i < filled ? (i === filled - 1 ? 'on head' : 'on') : '';
    });
  }

  function renderClock() {
    var t = state.timer;
    var left = leftMs();
    $('pomo-clock').textContent = t.phase === 'idle' ? '25:00' : L.formatClock(left);
    renderBar(t.phase, left);
  }

  function setButtons() {
    var p = state.timer.phase;
    $('pomo-start').hidden = p !== 'idle';
    $('pomo-pause').hidden = p !== 'focus';
    $('pomo-resume').hidden = p !== 'paused';
    $('pomo-abandon').hidden = p !== 'focus' && p !== 'paused';
    $('pomo-skip').hidden = p !== 'break';
    $('pomo-topic').disabled = p !== 'idle';
  }

  function renderRecent() {
    var box = $('pomo-recent');
    box.textContent = '';
    state.prefs.recentTopics.forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small';
      b.textContent = name;
      b.addEventListener('click', function () { $('pomo-topic').value = name; updateStartEnabled(); });
      box.appendChild(b);
    });
  }

  function updateStartEnabled() {
    $('pomo-start').disabled = L.isBlankText($('pomo-topic').value);
  }

  // 只在计时进行且窗口可见时才每秒刷新。
  function syncTicker() {
    var run = state && (state.timer.phase === 'focus' || state.timer.phase === 'break') && !document.hidden;
    if (run && timerId === null) {
      timerId = setInterval(renderClock, 250);
    } else if (!run && timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function flash() {
    var card = document.querySelector(".pomo-card");
    card.classList.remove("flash");
    void card.offsetWidth;
    card.classList.add("flash");
  }

  function render(next) {
    var wasPhase = state && state.timer.phase;
    state = next;
    if (lastCount !== null && state.pomodoros.length > lastCount) flash();
    lastCount = state.pomodoros.length;
    var t = state.timer;
    $('pomo-phase').textContent = PHASE_LABEL[t.phase];
    $('view-pomodoro').dataset.phase = t.phase;
    if (t.phase !== 'idle') $('pomo-topic').value = t.topic;
    else if (wasPhase && wasPhase !== 'idle') $('pomo-topic').value = '';
    setButtons();
    renderRecent();
    updateStartEnabled();
    renderClock();
    syncTicker();
  }

  function start() {
    if (L.isBlankText($('pomo-topic').value)) return;
    api.startPomodoro($('pomo-topic').value);
  }

  $('pomo-start').addEventListener('click', start);
  $('pomo-topic').addEventListener('input', updateStartEnabled);
  $('pomo-topic').addEventListener('keydown', function (e) { if (e.key === 'Enter') start(); });
  $('pomo-pause').addEventListener('click', function () { api.pausePomodoro(); });
  $('pomo-resume').addEventListener('click', function () { api.resumePomodoro(); });
  $('pomo-abandon').addEventListener('click', function () { api.abandonPomodoro(); });
  $('pomo-skip').addEventListener('click', function () { api.skipBreak(); });
  document.addEventListener('visibilitychange', function () {
    if (state) { renderClock(); syncTicker(); }
  });

  window.PixelViews = window.PixelViews || {};
  window.PixelViews.pomodoro = { render: render };
})();
