// 生成 assets/icon.ico:把托盘用的 16x16 像素图放大成 256x256 PNG,再包进 ICO 容器。
const fs = require('node:fs');
const zlib = require('node:zlib');
const ROWS = [
  '0111111111111110', '1111111111111111', '1100000000000011', '1100000000000211',
  '1100000000002011', '1100000000020011', '1120000000200011', '1102000002000011',
  '1100200020000011', '1100020200000011', '1100002000000011', '1100000000000011',
  '1100000000000011', '1111111111111111', '0111111111111110', '0000000000000000',
];
const N = 256, S = N / 16;
const raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) {
  raw[y * (N * 4 + 1)] = 0;
  for (let x = 0; x < N; x++) {
    const c = ROWS[Math.floor(y / S)][Math.floor(x / S)];
    const o = y * (N * 4 + 1) + 1 + x * 4;
    const v = c === '1' ? 20 : 255;
    raw[o] = v; raw[o + 1] = v; raw[o + 2] = v; raw[o + 3] = c === '0' ? 0 : 255;
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const head = Buffer.alloc(22);
head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); // ICO, 1 张图
head[6] = 0; head[7] = 0; // 0 表示 256
head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);
head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
fs.writeFileSync(__dirname + '/../assets/icon.ico', Buffer.concat([head, png]));
fs.writeFileSync(__dirname + '/../assets/icon.png', png);
console.log('icon.ico', 22 + png.length, 'bytes');
