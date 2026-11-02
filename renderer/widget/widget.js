// 角落小窗口:只读展示最前几条待办,番茄钟运行时多显示一行剩余时间。
(function () {
  var L = window.PixelLogic;
  var listEl = document.getElementById('list');
  var emptyEl = document.getElementById('empty');
  var pomoEl = document.getElementById('pomodoro');
  var state = null;
  var clockTimer = null;

  function renderList() {
    var lines = L.widgetLines(state.tasks, state.prefs.widgetCount);
    listEl.textContent = '';
    lines.forEach(function (line) {
      var li = document.createElement('li');
      li.textContent = line; // 任务名只当纯文本写入
      listEl.appendChild(li);
    });
    emptyEl.hidden = lines.length > 0;
  }

  function renderPomodoro() {
    var t = state.timer;
    var label = { focus: '学习中', break: '休息中', paused: '已暂停' }[t.phase];
    if (!label) {
      pomoEl.hidden = true;
      return;
    }
    var left = t.phase === 'paused' ? t.pausedLeftMs : t.endAt - Date.now();
    pomoEl.textContent = L.formatClock(left) + ' ' + label;
    pomoEl.classList.toggle('running', t.phase === 'focus' || t.phase === 'break');
    pomoEl.hidden = false;
  }

  // 只在番茄钟运行且窗口可见时才每秒刷新,否则不留任何定时器。
  function syncClock() {
    var running = state && state.timer.phase !== 'idle' && !document.hidden;
    if (running && clockTimer === null) {
      clockTimer = setInterval(renderPomodoro, 1000);
    } else if (!running && clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  }

  function render(next) {
    state = next;
    renderList();
    renderPomodoro();
    syncClock();
  }

  // 过了午夜,"明天"变成"今天"等文案需要重算;这里的行只带月-日,所以只需在唤醒时重画。
  document.addEventListener('visibilitychange', function () {
    if (state) render(state);
  });

  document.getElementById('open').addEventListener('click', function () {
    window.pixelApi.openApp();
  });

  // 番茄钟自然走完:窗口整体闪几下,让只开着小窗口学习的人也能注意到。
  window.pixelApi.onPomodoroAlert(function () {
    var root = document.querySelector('.inner');
    root.classList.remove('alert');
    void root.offsetWidth;
    root.classList.add('alert');
  });

  window.pixelApi.onStateChanged(render);
  window.pixelApi.getState().then(render);
})();
