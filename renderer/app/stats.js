// 完整窗口 · 统计页:今天/本周/全部的番茄钟数,按学习内容汇总,最近 20 条记录。
(function () {
  var L = window.PixelLogic;
  var RECENT_MAX = 20;

  function $(id) { return document.getElementById(id); }

  function cell(tag, text) {
    var e = document.createElement(tag);
    e.textContent = text;
    return e;
  }

  function render(state) {
    var c = L.countPomodoros(state.pomodoros, new Date());
    $('stat-today').textContent = String(c.today);
    $('stat-week').textContent = String(c.week);
    $('stat-total').textContent = String(c.total);

    var topics = Object.keys(c.byTopic).sort(function (a, b) {
      return c.byTopic[b] - c.byTopic[a] || (a < b ? -1 : 1);
    });
    var tbody = $('stat-topics');
    tbody.textContent = '';
    topics.forEach(function (name) {
      var tr = document.createElement('tr');
      tr.appendChild(cell('td', name));
      tr.appendChild(cell('td', String(c.byTopic[name])));
      tbody.appendChild(tr);
    });
    $('stat-topics-empty').hidden = topics.length > 0;

    var recent = state.pomodoros.slice().sort(function (a, b) { return b.endedAt - a.endedAt; }).slice(0, RECENT_MAX);
    var list = $('stat-recent');
    list.textContent = '';
    recent.forEach(function (p) {
      var li = document.createElement('li');
      li.appendChild(cell('span', L.formatDateTime(p.endedAt)));
      li.appendChild(cell('span', p.topic));
      list.appendChild(li);
    });
    $('stat-recent-empty').hidden = recent.length > 0;
  }

  window.PixelViews = window.PixelViews || {};
  window.PixelViews.stats = { render: render };
})();
