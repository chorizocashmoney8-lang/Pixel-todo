// 待办页交互检查:在真实页面里点击、输入,再读回页面和数据。
module.exports = async function ({ js, wait, store }) {
  const check = (name, ok, extra) => console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : ''));
  const count = () => store.get().tasks.filter((t) => t.deletedAt === null).length;
  const before = count();

  // 1 空输入:不新增,输入框抖动
  await js(`document.getElementById('add-input').value = '   ';
            document.getElementById('add-form').requestSubmit();`);
  await wait(100);
  check('空输入不新增', count() === before);
  check('空输入触发抖动', await js(`document.getElementById('add-input').classList.contains('shake')`));

  // 2 正常添加,输入框清空
  await js(`document.getElementById('add-input').value = '新任务<i>x</i>';
            document.getElementById('add-form').requestSubmit();`);
  await wait(150);
  check('添加后任务数 +1', count() === before + 1);
  check('添加后输入框清空', (await js(`document.getElementById('add-input').value`)) === '');
  check('标签当纯文本显示', (await js(`document.getElementById('task-list').innerText`)).includes('新任务<i>x</i>'));
  check('页面里没有解析出 <i> 元素', (await js(`document.querySelectorAll('#task-list i').length`)) === 0);

  // 3 打开编辑弹窗,回填
  await js(`document.querySelector('#task-list .task [aria-label="编辑"]').click()`);
  await wait(100);
  check('编辑弹窗打开', await js(`document.getElementById('edit-dialog').open`));
  check('回填任务内容', (await js(`document.getElementById('edit-text').value`)).length > 0);

  // 4 空白保存被拒绝,弹窗保持打开
  await js(`document.getElementById('edit-text').value = '  ';
            document.getElementById('edit-form').requestSubmit();`);
  await wait(100);
  check('空白保存被拒绝', await js(`document.getElementById('edit-dialog').open`));

  // 5 改内容、优先级、日期并保存
  await js(`document.getElementById('edit-text').value = '改过的任务';
            document.querySelector('#edit-priority [data-priority="low"]').click();
            document.getElementById('edit-due').value = '2030-05-06';
            document.getElementById('edit-form').requestSubmit();`);
  await wait(150);
  const edited = store.get().tasks.find((t) => t.text === '改过的任务');
  check('编辑保存后落库', !!edited && edited.priority === 'low' && edited.dueDate === '2030-05-06');
  check('保存后弹窗关闭', !(await js(`document.getElementById('edit-dialog').open`)));

  // 6 取消不保存
  await js(`document.querySelector('#task-list .task [aria-label="编辑"]').click()`);
  await wait(80);
  await js(`document.getElementById('edit-text').value = '不应保存';
            document.getElementById('edit-cancel').click()`);
  await wait(100);
  check('取消不保存', !store.get().tasks.some((t) => t.text === '不应保存'));

  // 7 清空截止日期
  await js(`[...document.querySelectorAll('#task-list .task')]
    .find((li) => li.innerText.includes('改过的任务')).querySelector('[aria-label="编辑"]').click()`);
  await wait(80);
  await js(`document.getElementById('edit-due-clear').click();
            document.getElementById('edit-form').requestSubmit();`);
  await wait(150);
  check('清空截止日期', store.get().tasks.find((t) => t.text === '改过的任务').dueDate === null);

  // 8 删除 -> 提示条 -> 撤销
  const n = count();
  await js(`[...document.querySelectorAll('#task-list .task')]
    .find((li) => li.innerText.includes('改过的任务')).querySelector('[aria-label="删除"]').click()`);
  await wait(150);
  check('删除后任务数 -1', count() === n - 1);
  check('出现撤销提示条', !(await js(`document.getElementById('toast').hidden`)));
  await js(`document.getElementById('toast-undo').click()`);
  await wait(150);
  check('撤销后恢复', count() === n);

  // 9 回收站:恢复与彻底删除
  await js(`[...document.querySelectorAll('#task-list .task')]
    .find((li) => li.innerText.includes('改过的任务')).querySelector('[aria-label="删除"]').click()`);
  await wait(100);
  await js(`document.getElementById('open-trash').click()`);
  await wait(100);
  check('回收站里能看到被删任务', (await js(`document.getElementById('trash-list').innerText`)).includes('改过的任务'));
  await js(`[...document.querySelectorAll('#trash-list .btn')].find((b) => b.textContent === '彻底删除').click()`);
  await wait(150);
  check('彻底删除后数据里消失', !store.get().tasks.some((t) => t.text === '改过的任务'));
  await js(`document.getElementById('trash-close').click()`);

  // 10 勾选完成、筛选
  await js(`document.querySelector('#task-list .check').click()`);
  await wait(150);
  check('勾选后产生 doneAt', store.get().tasks.some((t) => t.done && t.doneAt));
  await js(`document.querySelector('[data-filter="done"]').click()`);
  await wait(100);
  const doneTexts = await js(`[...document.querySelectorAll('#task-list .task')].every((li) => li.classList.contains('done'))`);
  check('「已完成」筛选只显示已完成项', doneTexts);
  await js(`document.querySelector('[data-filter="all"]').click()`);

  // 11 清除已完成 -> 撤销
  const doneBefore = store.get().tasks.filter((t) => t.done && t.deletedAt === null).length;
  await js(`document.getElementById('clear-done').click()`);
  await wait(150);
  check('清除已完成后没有未删除的已完成项',
    store.get().tasks.filter((t) => t.done && t.deletedAt === null).length === 0 && doneBefore > 0);
  await js(`document.getElementById('toast-undo').click()`);
  await wait(150);
  check('撤销清除后全部恢复',
    store.get().tasks.filter((t) => t.done && t.deletedAt === null).length === doneBefore);

  // 12 设置:置顶开关写入偏好
  await js(`document.getElementById('settings-btn').click()`);
  await wait(80);
  await js(`const c = document.getElementById('pref-top'); c.checked = true; c.dispatchEvent(new Event('change'))`);
  await wait(120);
  check('置顶开关写入偏好', store.get().prefs.alwaysOnTop === true);
  await js(`const n = document.getElementById('pref-count'); n.value = '3'; n.dispatchEvent(new Event('change'))`);
  await wait(120);
  check('小窗口条数写入偏好', store.get().prefs.widgetCount === 3);
};
