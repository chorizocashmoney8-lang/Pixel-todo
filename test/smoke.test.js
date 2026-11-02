const test = require('node:test');
const assert = require('node:assert');

test('纯函数模块可以被主进程和测试 require 加载', () => {
  const logic = require('../renderer/shared/logic.js');
  assert.strictEqual(typeof logic, 'object');
});
