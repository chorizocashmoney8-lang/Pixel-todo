// 完整窗口入口:拿到状态后分发给各个页面,处理页签切换和设置。
(function () {
  var api = window.pixelApi;

  function $(id) { return document.getElementById(id); }

  function showView(name) {
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) {
      v.hidden = v.id !== 'view-' + name;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.setAttribute('aria-pressed', String(t.dataset.view === name));
    });
  }

  function renderSettings(state) {
    var live = state.tasks.filter(function (t) { return t.deletedAt === null; });
    var undone = live.filter(function (t) { return !t.done; }).length;
    $('pref-top').checked = state.prefs.alwaysOnTop;
    if (document.activeElement !== $('pref-count')) $('pref-count').value = state.prefs.widgetCount;
    $('data-summary').textContent = '任务 ' + live.length + ' 条(未完成 ' + undone + '),回收站 ' +
      (state.tasks.length - live.length) + ' 条,番茄钟 ' + state.pomodoros.length + ' 个。数据保存在本机文件中。';
  }

  function render(state) {
    Object.keys(window.PixelViews).forEach(function (k) { window.PixelViews[k].render(state); });
    renderSettings(state);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () { showView(t.dataset.view); });
  });

  $('settings-btn').addEventListener('click', function () { $('settings-dialog').showModal(); });
  $('settings-close').addEventListener('click', function () { $('settings-dialog').close(); });
  $('pref-top').addEventListener('change', function () { api.setPrefs({ alwaysOnTop: $('pref-top').checked }); });
  $('pref-count').addEventListener('change', function () { api.setPrefs({ widgetCount: Number($('pref-count').value) }); });

  showView('todo');
  api.onStateChanged(render);
  api.getState().then(render);
})();
