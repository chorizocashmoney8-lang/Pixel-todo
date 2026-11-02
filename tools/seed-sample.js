// 验证用测试数据:覆盖优先级、截止日期、超长任务名、HTML 标签、已完成、回收站。
function pad(n) { return n < 10 ? '0' + n : String(n); }
function dayStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

module.exports = function seed(h) {
  h.addTask({ text: '交周报', priority: 'high', dueDate: dayStr(0) });
  h.addTask({ text: '<b>加粗标签</b>不应变粗', priority: 'high', dueDate: dayStr(2) });
  h.addTask({ text: '这是一个非常非常非常长的任务名称用来测试截断', priority: 'mid', dueDate: dayStr(-2) });
  h.addTask({ text: '读书', priority: 'mid' });
  h.addTask({ text: '整理桌面', priority: 'low', dueDate: dayStr(9) });
  h.addTask({ text: '第六条不应出现在小窗口', priority: 'low' });
  const done = h.addTask({ text: '已完成的不显示', priority: 'high' });
  h.updateTask(done.id, { done: true });
  const gone = h.addTask({ text: '回收站里的不显示', priority: 'high' });
  h.deleteTask(gone.id);
};
