(() => {
  'use strict';
  const A = window.PixelApp, { $, element: el, L } = A;
  let filter = 'all', editingId = null, renderKey = '', lastState;
  const priorities = { high: '高优先', mid: '中优先', low: '低优先' };
  function taskAction(text, title, fn) {
    const button = el('button', '', text);
    button.type = 'button'; button.title = title; button.setAttribute('aria-label', title);
    button.onclick = () => A.action(button, fn);
    return button;
  }
  function undoDelete(ids) {
    return async () => {
      for (const id of ids) await A.mutate('restoreTask', id);
      A.toast('已恢复到待办列表。');
    };
  }
  function edit(task) {
    editingId = task.id;
    $('editText').value = task.text;
    $('editPriority').value = task.priority;
    $('editDue').value = task.dueDate || '';
    $('editDialog').showModal();
    $('editText').focus(); $('editText').select();
  }
  function render(state) {
    lastState = state;
    const live = state.tasks.filter(t => t.deletedAt == null);
    const trash = state.tasks.filter(t => t.deletedAt != null);
    const done = live.filter(t => t.done);
    $('taskProgress').textContent = `${done.length} / ${live.length}`;
    const counts = { all: live.length, open: live.length - done.length, done: done.length, trash: trash.length };
    for (const [name, total] of Object.entries(counts)) $('count' + name[0].toUpperCase() + name.slice(1)).textContent = total;
    document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
    const clear = $('clearDone');
    clear.textContent = filter === 'trash' ? '清空回收站' : '清除已完成';
    clear.disabled = Boolean(clear.dataset.busy) || (filter === 'trash' ? !trash.length : !done.length);
    const key = JSON.stringify([filter, state.tasks, L.todayString(new Date())]);
    if (key === renderKey) {
      // Reconcile a checkbox if the host rejected its update without broadcasting state.
      document.querySelectorAll('.task-row .task-check').forEach(check => {
        const task = state.tasks.find(t => t.id === check.closest('.task-row').dataset.id);
        if (task) check.checked = task.done;
      });
      return;
    }
    renderKey = key;
    const tasks = L.sortTasks(filter === 'trash' ? trash : live.filter(t => filter === 'all' || (filter === 'done' ? t.done : !t.done)));
    const list = $('taskList'); list.replaceChildren();
    $('taskEmpty').hidden = tasks.length > 0;
    $('taskEmpty').textContent = ({ all: '还没有任务，写下今天想完成的一件事吧。', open: '未完成的事都做完啦，歇一会儿吧。', done: '还没有完成的任务，先从一件小事开始。', trash: '回收站是空的。删除的任务会保留 7 天。' })[filter];
    if (filter === 'trash' && tasks.length) list.append(el('p', 'trash-note', '删除的任务保留 7 天；恢复后会回到原来的完成状态。'));
    tasks.forEach(task => {
      const row = el('article', 'task-row' + (task.done ? ' done' : ''));
      row.dataset.id = task.id;
      row.style.setProperty('--priority', `var(--priority-${task.priority}, var(--muted))`);
      if (filter !== 'trash') {
        const check = el('input', 'task-check'); check.type = 'checkbox'; check.checked = task.done;
        check.setAttribute('aria-label', (task.done ? '标为未完成：' : '完成：') + task.text);
        check.onchange = () => A.action(check, async () => {
          await A.mutate('updateTask', task.id, { done: check.checked });
          if (check.checked) A.toast('又完成一件，做得很好。');
        });
        row.append(check);
      }
      const detail = el('div', 'task-detail');
      const title = el('div', 'task-title', task.text);
      const meta = el('div', 'task-meta');
      meta.append(el('span', 'priority', priorities[task.priority] || '中优先'));
      if (task.dueDate) {
        const due = el('span', '', task.dueDate + ' · ' + L.dueLabel(task.dueDate, L.todayString(new Date())));
        meta.append(due);
      } else meta.append(el('span', '', '不设日期'));
      detail.append(title, meta); row.append(detail);
      const actions = el('div', 'task-actions');
      if (filter === 'trash') {
        actions.append(taskAction('恢复', '恢复：' + task.text, async () => { await A.mutate('restoreTask', task.id); A.toast('已恢复到待办列表。'); }));
        actions.append(taskAction('彻底删除', '彻底删除：' + task.text, async () => {
          if (window.confirm('彻底删除这件事？删除后无法恢复。')) { await A.mutate('purgeTask', task.id); A.toast('已彻底删除。'); }
        }));
      } else {
        actions.append(taskAction('编辑', '编辑：' + task.text, () => edit(task)));
        actions.append(taskAction('×', '删除：' + task.text, async () => { await A.mutate('deleteTask', task.id); A.toast('已移到回收站。', undoDelete([task.id])); }));
        title.ondblclick = () => edit(task);
      }
      row.append(actions); list.append(row);
    });
  }
  A.views.todo = {
    init() {
      document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { filter = button.dataset.filter; if (A.state) render(A.state); });
      $('addForm').onsubmit = event => {
        event.preventDefault();
        const text = $('taskInput').value.trim(); if (!text) { $('taskInput').focus(); return; }
        const button = $('addForm').querySelector('[type=submit]');
        const input = { text, priority: $('newPriority').value, dueDate: $('newDue').value || null };
        A.action(button, async () => {
          await A.mutate('addTask', input);
          if ($('taskInput').value.trim() === text) $('taskInput').value = '';
          filter = 'all'; render(A.state); $('taskInput').focus();
        }, '添加失败。');
      };
      $('clearDone').onclick = () => A.action($('clearDone'), async () => {
        if (filter === 'trash') {
          if (window.confirm('清空回收站？其中的任务将无法恢复。')) { await A.mutate('emptyTrash'); A.toast('回收站已清空。'); }
        } else {
          const ids = lastState.tasks.filter(t => t.deletedAt == null && t.done).map(t => t.id);
          await A.mutate('clearDone'); A.toast(`已将 ${ids.length} 件已完成任务移到回收站。`, undoDelete(ids));
        }
      });
      $('editCancel').onclick = () => $('editDialog').close();
      $('editDialog').addEventListener('close', () => { editingId = null; });
      $('editForm').onsubmit = event => {
        event.preventDefault();
        const text = $('editText').value.trim(); if (!text || !editingId) return;
        const id = editingId;
        if (!A.state.tasks.some(t => t.id === id && t.deletedAt == null)) { $('editDialog').close(); A.toast('这件事已被删除，请到回收站查看。'); return; }
        A.action($('editForm').querySelector('[type=submit]'), async () => {
          await A.mutate('updateTask', id, { text, priority: $('editPriority').value, dueDate: $('editDue').value || null });
          $('editDialog').close(); A.toast('修改已保存。');
        }, '保存失败。');
      };
    }, render
  };
})();
