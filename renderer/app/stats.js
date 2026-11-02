(() => {
  'use strict';
  const A = window.PixelApp, { $, element: el, L } = A;
  let renderKey = '';
  function render(state) {
    const key = JSON.stringify([state.pomodoros, L.todayString(new Date())]);
    if (key === renderKey) return;
    renderKey = key;
    const counts = L.countPomodoros(state.pomodoros, new Date());
    $('statCards').replaceChildren(...['today', 'week', 'total'].map((name, index) => {
      const card = el('div', 'stat-card'); card.append(el('strong', '', counts[name]), el('span', '', ['今天', '本周', '全部'][index])); return card;
    }));
    const topics = new Map();
    state.pomodoros.forEach(record => { const name = record.topic || '未命名专注'; topics.set(name, (topics.get(name) || 0) + 1); });
    $('topicStats').replaceChildren(...Array.from(topics).sort((a, b) => b[1] - a[1]).map(([topic, count]) => {
      const row = el('div', 'stat-line'); row.append(el('span', '', topic), el('span', '', `${count} 个`)); return row;
    }));
    $('topicStatsEmpty').hidden = topics.size > 0;
    const recent = state.pomodoros.slice().sort((a, b) => b.endedAt - a.endedAt).slice(0, 20);
    $('recentStats').replaceChildren(...recent.map(record => {
      const row = el('div', 'recent-line'); const info = el('div', '');
      info.append(el('div', '', record.topic || '未命名专注'), el('small', '', record.completion === 'manual' ? '手动完成 · 1 次' : '自然完成 · 25 分钟'));
      row.append(info, el('small', '', L.formatDateTime(record.endedAt))); return row;
    }));
    $('recentStatsEmpty').hidden = recent.length > 0;
  }
  A.views.stats = { init() {}, render };
})();
