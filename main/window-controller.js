// 协调窗口,隐藏小窗不影响主进程计时。
function createWindowController(main, widget) {
  return {
    openApp() { widget.hide(); if (main.isMinimized()) main.restore(); main.show(); main.focus(); },
    minimizeApp() { main.hide(); widget.showInactive(); },
    hideApp() { main.hide(); widget.showInactive(); },
    hideWidget() { widget.hide(); },
    revealForAlert() { if (!main.isVisible()) widget.showInactive(); },
  };
}
module.exports = { createWindowController };
