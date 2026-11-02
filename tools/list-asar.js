// 列出打包产物 app.asar 里的文件,确认该进的进了、不该进的没进。
const asar = require('@electron/asar');
const BACKSLASH = String.fromCharCode(92);
const list = asar.listPackage('dist/win-unpacked/resources/app.asar').map((p) => p.split(BACKSLASH).join('/'));
console.log(list.filter((p) => !p.includes('node_modules')).join('\n'));
console.log('node_modules 条目数:', list.filter((p) => p.includes('node_modules')).length);
