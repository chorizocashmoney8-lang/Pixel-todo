const test = require('node:test');
const assert = require('node:assert');
const { clampToDisplays } = require('../main/position.js');

const SIZE = { w: 260, h: 200 };
const MAIN = { x: 0, y: 0, width: 1920, height: 1040 };
const SECOND = { x: 1920, y: 0, width: 1280, height: 1024 };

test('位置完全在某块屏幕内时原样返回', () => {
  assert.deepStrictEqual(clampToDisplays({ x: 100, y: 100 }, SIZE, [MAIN]), { x: 100, y: 100 });
});

test('位置在第二块屏幕内时原样返回', () => {
  assert.deepStrictEqual(clampToDisplays({ x: 2000, y: 50 }, SIZE, [MAIN, SECOND]), { x: 2000, y: 50 });
});

test('保存的位置在已拔掉的屏幕上,回到主屏右下角', () => {
  assert.deepStrictEqual(clampToDisplays({ x: 2000, y: 50 }, SIZE, [MAIN]), { x: 1920 - 260 - 16, y: 1040 - 200 - 16 });
});

test('没有保存过位置时,回到主屏右下角', () => {
  assert.deepStrictEqual(clampToDisplays(null, SIZE, [MAIN]), { x: 1644, y: 824 });
  assert.deepStrictEqual(clampToDisplays(undefined, SIZE, [MAIN]), { x: 1644, y: 824 });
});

test('窗口只有一部分露在屏幕外时,也回到主屏右下角', () => {
  assert.deepStrictEqual(clampToDisplays({ x: 1800, y: 100 }, SIZE, [MAIN]), { x: 1644, y: 824 });
  assert.deepStrictEqual(clampToDisplays({ x: -50, y: 100 }, SIZE, [MAIN]), { x: 1644, y: 824 });
});

test('主屏不在原点时,右下角按主屏的位置计算', () => {
  const main = { x: 1920, y: 0, width: 1280, height: 1024 };
  assert.deepStrictEqual(clampToDisplays(null, SIZE, [main, MAIN]), { x: 1920 + 1280 - 260 - 16, y: 1024 - 200 - 16 });
});

test('位置里有非数字时按没有保存处理', () => {
  assert.deepStrictEqual(clampToDisplays({ x: NaN, y: 10 }, SIZE, [MAIN]), { x: 1644, y: 824 });
  assert.deepStrictEqual(clampToDisplays({ x: '10', y: 10 }, SIZE, [MAIN]), { x: 1644, y: 824 });
});
