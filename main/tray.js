// 系统托盘图标与菜单。图标是代码生成的 16x16 像素位图,不依赖图片文件。
const { Tray, Menu, nativeImage } = require('electron');

const SIZE = 16;
// 1 = 黑色边框与方块,2 = 白色对勾,0 = 透明
const ICON = [
  '0111111111111110',
  '1111111111111111',
  '1100000000000011',
  '1100000000000211',
  '1100000000002011',
  '1100000000020011',
  '1120000000200011',
  '1102000002000011',
  '1100200020000011',
  '1100020200000011',
  '1100002000000011',
  '1100000000000011',
  '1100000000000011',
  '1111111111111111',
  '0111111111111110',
  '0000000000000000',
];

// 提醒状态下把图标反色(里面变黑、对勾变白),一眼能和平时区分。
function buildIcon(inverted) {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  ICON.forEach((row, y) => {
    row.split('').forEach((c, x) => {
      const i = (y * SIZE + x) * 4;
      const interior = c === '0' && x > 1 && x < 14 && y > 1 && y < 13;
      const dark = c === '1' || (inverted && interior);
      const v = dark ? 20 : 255;
      buf[i] = v; buf[i + 1] = v; buf[i + 2] = v; // BGRA
      buf[i + 3] = c === '0' && !(inverted && interior) ? 0 : 255;
    });
  });
  return nativeImage.createFromBitmap(buf, { width: SIZE, height: SIZE });
}

// 返回控制器。调用方必须在整个进程生命周期内持有它,否则 Tray 可能被垃圾回收,图标会凭空消失。
function createTray(onOpen, onQuit) {
  const normal = buildIcon(false);
  const alerted = buildIcon(true);
  const tray = new Tray(normal);
  tray.setToolTip('Pixel Todo');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开', click: onOpen },
    { type: 'separator' },
    { label: '退出', click: onQuit },
  ]));
  tray.on('click', onOpen);
  return {
    tray: tray,
    setAlert(message) {
      tray.setImage(alerted);
      tray.setToolTip('Pixel Todo - ' + message);
    },
    clearAlert() {
      tray.setImage(normal);
      tray.setToolTip('Pixel Todo');
    },
  };
}

module.exports = { createTray };
