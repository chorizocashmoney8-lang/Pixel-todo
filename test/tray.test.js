const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
test('托盘提醒慢闪10秒停止,提前确认清除所有计时器',()=>{
 const timers=new Map(); let serial=0;
 class Tray { constructor(image){this.image=image;} setImage(image){this.image=image;} setToolTip(text){this.tip=text;} setContextMenu(){} on(){} }
 const context={module:{exports:{}},Buffer,require:()=>({Tray,Menu:{buildFromTemplate:x=>x},nativeImage:{createFromBitmap:x=>x}}),
  setInterval(fn,ms){const id=++serial;timers.set(id,{fn,ms,type:'interval'});return id;},setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms,type:'timeout'});return id;},clearInterval(id){timers.delete(id);},clearTimeout(id){timers.delete(id);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main/tray.js'),'utf8'),context);
 const c=context.module.exports.createTray(()=>{},()=>{}); const normal=c.tray.image;
 c.setAlert('完成'); assert.equal(timers.size,2); const timeout=[...timers.values()].find(t=>t.type==='timeout');assert.equal(timeout.ms,10000);
 const interval=[...timers.values()].find(t=>t.type==='interval');assert.equal(interval.ms,1000);interval.fn();assert.equal(c.tray.image,normal);
 timeout.fn();assert.equal(c.tray.image,normal);assert.ok(![...timers.values()].some(t=>t.type==='interval'));
 c.setAlert('休息结束');c.clearAlert();assert.equal(timers.size,0);assert.equal(c.tray.image,normal);assert.equal(c.tray.tip,'Pixel Todo');
});
