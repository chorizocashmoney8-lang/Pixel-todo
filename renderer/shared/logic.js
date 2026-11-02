// 纯函数集合:排序、日期文案、统计、计时恢复。
// 不碰 DOM 和文件,主进程用 require,渲染进程用全局 PixelLogic。
(function () {
  var MIN = 60 * 1000;
  var FOCUS_MS = 25 * MIN;
  var PRIORITY_RANK = { high: 0, mid: 1, low: 2 };

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  // 'YYYY-MM-DD' 按本地零点解析。new Date('YYYY-MM-DD') 会按 UTC 解析,东八区会错位。
  function parseLocalDate(s) {
    var p = s.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function todayString(now) {
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  }

  // 两个日期字符串相差的整天数,用 UTC 日历天计算,避开夏令时造成的 23/25 小时。
  function dayDiff(a, b) {
    var pa = a.split('-');
    var pb = b.split('-');
    var ua = Date.UTC(Number(pa[0]), Number(pa[1]) - 1, Number(pa[2]));
    var ub = Date.UTC(Number(pb[0]), Number(pb[1]) - 1, Number(pb[2]));
    return Math.round((ua - ub) / 86400000);
  }

  function dueLabel(dueDate, today) {
    if (!dueDate) return '';
    var diff = dayDiff(dueDate, today);
    if (diff === 0) return '今天截止';
    if (diff === 1) return '明天';
    if (diff > 1) return '还有 ' + diff + ' 天';
    return '已过期 ' + -diff + ' 天';
  }

  function sortTasks(tasks) {
    return tasks.slice().sort(function (a, b) {
      var pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      if (a.dueDate && b.dueDate) {
        if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      } else if (a.dueDate || b.dueDate) {
        return a.dueDate ? -1 : 1;
      }
      return a.createdAt - b.createdAt;
    });
  }

  function countPomodoros(list, now) {
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var sinceMonday = (now.getDay() + 6) % 7; // 周一为 0
    var weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday).getTime();
    var result = { today: 0, week: 0, total: 0, byTopic: {} };
    list.forEach(function (p) {
      result.total += 1;
      if (p.endedAt >= todayStart) result.today += 1;
      if (p.endedAt >= weekStart) result.week += 1;
      result.byTopic[p.topic] = (result.byTopic[p.topic] || 0) + 1;
    });
    return result;
  }

  // 软件重新启动时处理已过点的计时:学习段补记一个番茄钟,休息段直接回到 idle。
  function recoverTimer(timer, now) {
    var idle = { phase: 'idle', topic: '', endAt: null, pausedLeftMs: null };
    var due = timer.endAt !== null && timer.endAt <= now;
    if (timer.phase === 'focus' && due) {
      return {
        timer: idle,
        completed: {
          id: 'p_' + timer.endAt,
          topic: timer.topic,
          startedAt: timer.endAt - FOCUS_MS,
          endedAt: timer.endAt,
        },
      };
    }
    if (timer.phase === 'break' && due) {
      return { timer: idle, completed: null };
    }
    return { timer: timer, completed: null };
  }

  function isBlankText(s) {
    return String(s).trim() === '';
  }

  // 按字符(而不是 UTF-16 单元)截断,避免把 emoji 切成乱码。
  function truncateText(s, max) {
    var chars = Array.from(s);
    return chars.length > max ? chars.slice(0, max).join('') + '…' : s;
  }

  // 角落小窗口的行:只含未完成且不在回收站的任务,按排序取前 count 条。
  function widgetLines(tasks, count) {
    var live = tasks.filter(function (t) { return !t.done && t.deletedAt === null; });
    return sortTasks(live).slice(0, count).map(function (t) {
      var line = truncateText(t.text, 12);
      return t.dueDate ? line + ' · ' + t.dueDate.slice(5) : line;
    });
  }

  function formatClock(ms) {
    var total = Math.max(0, Math.ceil(ms / 1000));
    return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  }

  function formatDateTime(ms) {
    var d = new Date(ms);
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  var api = {
    formatDateTime: formatDateTime,
    truncateText: truncateText,
    widgetLines: widgetLines,
    formatClock: formatClock,
    parseLocalDate: parseLocalDate,
    todayString: todayString,
    dueLabel: dueLabel,
    sortTasks: sortTasks,
    countPomodoros: countPomodoros,
    recoverTimer: recoverTimer,
    isBlankText: isBlankText,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    window.PixelLogic = api;
  }
})();
