// 窗口不可见时暂停所有 CSS 动画,避免常驻软件白白占用 CPU。
(function () {
  function sync() {
    document.documentElement.classList.toggle('paused', document.hidden);
  }
  document.addEventListener('visibilitychange', sync);
  sync();
})();
