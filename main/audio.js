const fs = require('node:fs/promises');
const path = require('node:path');
const MIME = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const BUILTINS = ['soft-pixel', 'clear-extended', 'bubble-response'];
const MAX_BYTES = 10 * 1024 * 1024;
function createAudioLibrary(userDir, assetsDir, store) {
  const folder = path.join(userDir, 'sounds');
  const file = path.join(folder, 'custom-sound.json');
  async function importFile(source) {
    const ext = path.extname(source).toLowerCase();
    if (!MIME[ext]) throw new Error('请选择 WAV、MP3、OGG 或 M4A 音频。');
    const info = await fs.stat(source);
    if (!info.isFile() || info.size > MAX_BYTES || info.size === 0) throw new Error('音频须为非空文件,且不超过10 MB。');
    const data = await fs.readFile(source);
    // 复制受控数据,不保存原路径;原文件移动后导入的声音仍可使用。
    const url = 'data:' + MIME[ext] + ';base64,' + data.toString('base64');
    await fs.mkdir(folder, { recursive: true });
    const temp = file + '.tmp';
    const backup = file + '.rollback';
    const name = path.basename(source);
    let hadPrevious = false;
    await fs.writeFile(temp, JSON.stringify({ url }));
    try {
      try { await fs.rename(file, backup); hadPrevious = true; }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
      await fs.rename(temp, file);
      try {
        store.update(s => { s.prefs.sound = 'custom'; s.prefs.customSoundName = name; });
      } catch (e) {
        await fs.unlink(file).catch(() => {});
        if (hadPrevious) await fs.rename(backup, file);
        throw e;
      }
      if (hadPrevious) await fs.unlink(backup).catch(() => {});
      return name;
    } finally {
      await fs.unlink(temp).catch(() => {});
    }
  }
  async function url() {
    const choice = store.get().prefs.sound;
    if (choice === 'custom') {
      try { return JSON.parse(await fs.readFile(file,'utf8')).url; } catch (_) { /* 外部误删时回退默认提示音 */ }
    }
    const id = BUILTINS.includes(choice) ? choice : 'clear-extended';
    return 'data:audio/wav;base64,' + (await fs.readFile(path.join(assetsDir,id + '.wav'))).toString('base64');
  }
  return { importFile, url };
}
module.exports = { createAudioLibrary };
