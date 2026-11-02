const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { createAudioLibrary } = require('../main/audio');
test('导入音频复制到受控目录,原文件移走后仍能读取;不支持的文件被拒绝', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),'pixel-audio-'));
 const source = path.join(dir,'sound.wav'); fs.copyFileSync(path.join(__dirname,'../assets/audio/clear-extended.wav'),source);
 const store = { prefs: { sound: 'clear-extended' }, get() { return { prefs: this.prefs }; }, update(fn) { fn({ prefs: this.prefs }); } };
 const library = createAudioLibrary(path.join(dir,'user'),path.join(__dirname,'../assets/audio'),store);
 const name = await library.importFile(source); assert.equal(name,'sound.wav');
 fs.unlinkSync(source); assert.match(await library.url(), /^data:audio\/wav;base64,/);
 const bad = path.join(dir,'bad.exe'); fs.writeFileSync(bad,'x'); await assert.rejects(library.importFile(bad));
 assert.equal(fs.readdirSync(path.join(dir,'user','sounds')).length,1);
});

test('偏好写盘失败时恢复旧音频,并保留原设置', async () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pixel-audio-rollback-'));
 let fail=false;
 const store={prefs:{sound:'clear-extended'},get(){return{prefs:this.prefs};},update(fn){if(fail)throw new Error('disk failed');fn({prefs:this.prefs});}};
 const library=createAudioLibrary(path.join(dir,'user'),path.join(__dirname,'../assets/audio'),store);
 await library.importFile(path.join(__dirname,'../assets/audio/clear-extended.wav'));
 const before=await library.url();fail=true;
 await assert.rejects(library.importFile(path.join(__dirname,'../assets/audio/soft-pixel.wav')),/disk failed/);
 assert.equal(await library.url(),before);assert.equal(store.prefs.customSoundName,'clear-extended.wav');
});
