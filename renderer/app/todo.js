// 完整窗口 · 待办页。所有任务文字只用 textContent 写入。
(function () {
  var L = window.PixelLogic;
  var api = window.pixelApi;
  var PRI_LABEL = { high: '高', mid: '中', low: '低' };

  var state = null;
  var filter = 'all';
  var editingId = null;
  var editPriority = 'mid';
  var toastTimer = null;
  var undoFn = null;
  var popId = null; // 刚被勾选的任务:重绘后在新复选框上播放弹跳

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function iconButton(label, glyph, onClick) {
    var b = el('button', 'icon-btn', glyph);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    return b;
  }

  function shake(node) {
    node.classList.remove('shake');
    void node.offsetWidth; // 重新触发动画
    node.classList.add('shake');
  }

  function showToast(text, undo) {
    $('toast-text').textContent = text;
    undoFn = undo;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').hidden = true; }, 6000);
  }

  function taskRow(t, today) {
    var li = el('li', 'task pri-' + t.priority + (t.done ? ' done' : ''));
    var check = el('input', 'check');
    check.type = 'checkbox';
    check.checked = t.done;
    if (t.id === popId) check.classList.add('pop');
    check.setAttribute('aria-label', '完成:' + t.text);
    check.addEventListener('change', function () {
      popId = t.id;
      api.updateTask(t.id, { done: check.checked });
    });
    li.appendChild(check);

    var body = el('div', 'task-body');
    body.appendChild(el('span', 'task-text', t.text));
    var meta = el('span', 'task-meta');
    var tag = el('button', 'tag', PRI_LABEL[t.priority]);
    tag.type = 'button';
    tag.setAttribute('aria-label', '编辑优先级');
    tag.addEventListener('click', function () { openEdit(t); });
    meta.appendChild(tag);
    if (t.dueDate) {
      var label = L.dueLabel(t.dueDate, today);
      var overdue = !t.done && t.dueDate < today;
      meta.appendChild(el('span', 'due' + (overdue ? ' overdue' : ''), t.dueDate.slice(5) + ' · ' + label));
    }
    body.appendChild(meta);
    li.appendChild(body);

    li.appendChild(iconButton('编辑', '✎', function () { openEdit(t); }));
    li.appendChild(iconButton('删除', '×', function () {
      api.deleteTask(t.id);
      showToast('已删除「' + L.truncateText(t.text, 10) + '」', function () { api.restoreTask(t.id); });
    }));
    return li;
  }

  function renderList() {
    var today = L.todayString(new Date());
    var live = state.tasks.filter(function (t) { return t.deletedAt === null; });
    var doneCount = live.filter(function (t) { return t.done; }).length;
    $('counts').textContent = '未完成 ' + (live.length - doneCount) + '   已完成 ' + doneCount + '   全部 ' + live.length;

    var shown = live.filter(function (t) {
      return filter === 'all' || (filter === 'done' ? t.done : !t.done);
    });
    var list = $('task-list');
    list.textContent = '';
    L.sortTasks(shown).forEach(function (t) { list.appendChild(taskRow(t, today)); });
    $('task-empty').hidden = shown.length > 0;
    $('trash-count').textContent = String(state.tasks.length - live.length);
    popId = null;
  }

  function renderTrash() {
    var trashed = state.tasks.filter(function (t) { return t.deletedAt !== null; });
    var list = $('trash-list');
    list.textContent = '';
    trashed.forEach(function (t) {
      var li = el('li', 'task pri-' + t.priority);
      var body = el('div', 'task-body');
      body.appendChild(el('span', 'task-text', t.text));
      li.appendChild(body);
      var restore = el('button', 'btn small', '恢复');
      restore.type = 'button';
      restore.addEventListener('click', function () { api.restoreTask(t.id); });
      var purge = el('button', 'btn small', '彻底删除');
      purge.type = 'button';
      purge.addEventListener('click', function () { api.purgeTask(t.id); });
      li.appendChild(restore);
      li.appendChild(purge);
      list.appendChild(li);
    });
    $('trash-empty').hidden = trashed.length > 0;
  }

  function setPriority(p) {
    editPriority = p;
    Array.prototype.forEach.call($('edit-priority').querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.priority === p));
    });
  }

  function openEdit(t) {
    editingId = t.id;
    $('edit-text').value = t.text;
    $('edit-due').value = t.dueDate || '';
    setPriority(t.priority);
    $('edit-dialog').showModal();
    $('edit-text').focus();
  }

  function saveEdit() {
    if (L.isBlankText($('edit-text').value)) {
      shake($('edit-text'));
      return;
    }
    api.updateTask(editingId, {
      text: $('edit-text').value,
      priority: editPriority,
      dueDate: $('edit-due').value || null,
    });
    $('edit-dialog').close();
  }

  function bind() {
    $('add-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('add-input');
      if (L.isBlankText(input.value)) {
        shake(input);
        return;
      }
      api.addTask({ text: input.value });
      input.value = '';
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-filter]'), function (b) {
      b.addEventListener('click', function () {
        filter = b.dataset.filter;
        Array.prototype.forEach.call(document.querySelectorAll('[data-filter]'), function (o) {
          o.setAttribute('aria-pressed', String(o === b));
        });
        renderList();
      });
    });

    $('clear-done').addEventListener('click', function () {
      var ids = state.tasks.filter(function (t) { return t.done && t.deletedAt === null; })
        .map(function (t) { return t.id; });
      if (ids.length === 0) return;
      api.clearDone();
      showToast('已清除 ' + ids.length + ' 项已完成', function () { ids.forEach(api.restoreTask); });
    });

    $('toast-undo').addEventListener('click', function () {
      if (undoFn) undoFn();
      undoFn = null;
      $('toast').hidden = true;
    });

    $('open-trash').addEventListener('click', function () { renderTrash(); $('trash-dialog').showModal(); });
    $('trash-close').addEventListener('click', function () { $('trash-dialog').close(); });
    $('trash-clear').addEventListener('click', function () { api.emptyTrash(); });

    Array.prototype.forEach.call($('edit-priority').querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { setPriority(b.dataset.priority); });
    });
    $('edit-due-clear').addEventListener('click', function () { $('edit-due').value = ''; });
    $('edit-cancel').addEventListener('click', function () { $('edit-dialog').close(); });
    $('edit-form').addEventListener('submit', function (e) { e.preventDefault(); saveEdit(); });
    $('edit-dialog').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(); }
    });

    document.addEventListener('keydown', function (e) {
      var tag = document.activeElement && document.activeElement.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !$('view-todo').hidden) {
        e.preventDefault();
        $('add-input').focus();
      }
    });

    // 过了午夜,"今天截止/明天/已过期"要重算。
    function scheduleMidnight() {
      var now = new Date();
      var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      setTimeout(function () { if (state) renderList(); scheduleMidnight(); }, next - now);
    }
    scheduleMidnight();
    document.addEventListener('visibilitychange', function () { if (state && !document.hidden) renderList(); });
  }

  bind();

  window.PixelViews = window.PixelViews || {};
  window.PixelViews.todo = {
    render: function (next) {
      state = next;
      renderList();
      if ($('trash-dialog').open) renderTrash();
    },
  };
})();
