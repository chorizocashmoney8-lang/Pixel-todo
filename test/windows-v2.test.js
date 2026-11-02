const test = require('node:test');
const assert = require('node:assert/strict');
const { createWindowController } = require('../main/window-controller');
function fake(visible = false) { return { visible, isVisible() { return this.visible; }, isDestroyed() { return false; }, show() { this.visible = true; }, showInactive() { this.visible = true; }, hide() { this.visible = false; }, moveTop() {}, focus() {}, isMinimized() { return false; } }; }
test('小窗可隐藏,托盘打开主窗,收起重新恢复;主窗与小窗互斥', () => {
  const widget = fake(true), main = fake();
  const c = createWindowController(main, widget);
  c.hideWidget(); assert.equal(widget.visible, false);
  c.openApp(); assert.equal(main.visible, true); assert.equal(widget.visible, false);
  c.minimizeApp(); assert.equal(main.visible, false); assert.equal(widget.visible, true);
});
test('到点恢复隐藏小窗,主窗可见时不额外显示小窗', () => {
  const widget = fake(), main = fake(); const c = createWindowController(main, widget);
  c.revealForAlert(); assert.equal(widget.visible, true);
  c.openApp(); c.revealForAlert(); assert.equal(widget.visible, false); assert.equal(main.visible, true);
});
