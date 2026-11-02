// 开发时启动 Electron。VS Code 环境会设置 ELECTRON_RUN_AS_NODE,必须在子进程里去掉它。
const { spawn } = require('node:child_process');
const electron = require('electron');
const env = Object.assign({}, process.env, { ELECTRON_ENABLE_LOGGING: '1' });
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { env, stdio: 'inherit' });
const ms = Number(process.argv[2] || 0);
if (ms > 0) setTimeout(() => { child.kill(); }, ms);
child.on('exit', (code, sig) => { console.log('electron exit code=' + code + ' signal=' + sig); });
