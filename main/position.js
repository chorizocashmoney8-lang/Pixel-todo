// 小窗口位置的纯计算,不依赖 electron,便于测试。
const MARGIN = 16;

function isNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

// displays 的第一项必须是主屏。保存的位置若不能让整个窗口落在某块屏幕内,就回到主屏右下角。
function clampToDisplays(pos, size, displays) {
  if (pos && isNum(pos.x) && isNum(pos.y)) {
    const inside = displays.some((d) =>
      pos.x >= d.x && pos.y >= d.y &&
      pos.x + size.w <= d.x + d.width &&
      pos.y + size.h <= d.y + d.height);
    if (inside) return { x: pos.x, y: pos.y };
  }
  const main = displays[0];
  return {
    x: main.x + main.width - size.w - MARGIN,
    y: main.y + main.height - size.h - MARGIN,
  };
}

module.exports = { clampToDisplays };
