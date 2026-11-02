(() => {
  'use strict';
  const A = window.PixelApp, { $, element: el } = A;
  let audio = null, audioGeneration = 0, importName = '', saveQueue = Promise.resolve();
  const builtins = ['clear-extended', 'soft-pixel', 'bubble-response'];
  function stopAudio() {
    audioGeneration++;
    if (audio) { audio.pause(); audio.src = ''; audio = null; }
  }
  function save(patch, button) {
    stopAudio();
    // Serialize preference IPC so volume and rapid theme choices cannot overwrite one another.
    const operation = saveQueue.then(() => A.mutate('setPrefs', patch));
    saveQueue = operation.catch(() => {});
    return A.action(button, async () => {
      try { await operation; }
      catch (error) { render(A.state); throw error; }
    }, '设置没有保存，请重试。');
  }
  function updatePressed(selector, key, prefs) {
    document.querySelectorAll(selector).forEach(button => {
      const value = button.dataset[key];
      const selected = String(prefs[key]) === value;
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  function makeThemes() {
    const grid = $('themeGrid'); grid.replaceChildren();
    (window.PixelThemes || []).forEach((theme, index) => {
      const button = el('button', 'theme-choice'); button.type = 'button'; button.dataset.theme = index;
      button.setAttribute('aria-label', theme.name);
      const swatch = el('span', 'theme-swatch'); swatch.setAttribute('aria-hidden', 'true');
      // The theme declaration block is data, never an individual CSS color.
      const vars = typeof theme.vars === 'string' ? Object.fromEntries(theme.vars.split(';').filter(Boolean).map(entry => {
        const colon = entry.indexOf(':'); return [entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()];
      })) : (theme.vars || {});
      const color = vars['--hi'] || vars.hi || vars['--bar'] || vars.bar;
      if (color && CSS.supports('color', color)) swatch.style.backgroundColor = color;
      button.append(swatch, el('span', '', theme.name));
      button.onclick = () => save({ theme: index }, button);
      grid.append(button);
    });
  }
  function render(state) {
    if (!state) return;
    const p = state.prefs;
    updatePressed('[data-theme]', 'theme', p);
    updatePressed('[data-font]', 'font', p);
    document.querySelectorAll('[data-idle]').forEach(button => { button.setAttribute('aria-pressed', String(p.idleMode === button.dataset.idle)); button.disabled = Boolean(button.dataset.busy) || !p.buddy; });
    for (const key of ['face', 'pose']) {
      updatePressed(`[data-${key}]`, key, p);
      document.querySelectorAll(`[data-${key}]`).forEach(button => { button.disabled = Boolean(button.dataset.busy) || !p.buddy || p.idleMode !== 'fixed'; });
    }
    for (const [id, key] of Object.entries({ buddyToggle: 'buddy', animateToggle: 'animate', alwaysOnTop: 'alwaysOnTop', autoStart: 'autoStart' })) $(id).checked = Boolean(p[key]);
    $('buddyOptions').setAttribute('aria-disabled', String(!p.buddy));
    let custom = $('soundSelect').querySelector('option[value=custom]');
    if (p.sound === 'custom' || importName || p.customSoundName) {
      if (!custom) { custom = el('option'); custom.value = 'custom'; $('soundSelect').append(custom); }
      custom.textContent = '已导入：' + (importName || p.customSoundName || '本地音频');
    }
    $('soundSelect').value = builtins.includes(p.sound) || p.sound === 'custom' ? p.sound : 'clear-extended';
    $('volumeRange').value = p.volume;
    $('volumeValue').textContent = p.volume + '%';
    $('volumeRange').setAttribute('aria-valuetext', p.volume + '%');
    $('importName').textContent = importName || p.customSoundName || (p.sound === 'custom' ? '已导入本地音频' : '只保存在本机');
    const live = state.tasks.filter(t => t.deletedAt == null);
    $('dataSummary').textContent = `${live.length} 件待办 · ${state.pomodoros.length} 次专注。数据只保存在本机。`;
  }
  A.views.settings = {
    init() {
      makeThemes();
      for (const [selector, key] of [['[data-font]', 'font'], ['[data-idle]', 'idleMode'], ['[data-face]', 'face'], ['[data-pose]', 'pose']]) {
        document.querySelectorAll(selector).forEach(button => button.onclick = () => {
          const dataKey = key === 'idleMode' ? 'idle' : key;
          const value = ['face', 'pose'].includes(key) ? Number(button.dataset[dataKey]) : button.dataset[dataKey];
          save({ [key]: value }, button);
        });
      }
      for (const [id, key] of Object.entries({ buddyToggle: 'buddy', animateToggle: 'animate', alwaysOnTop: 'alwaysOnTop', autoStart: 'autoStart' })) $(id).onchange = () => save({ [key]: $(id).checked }, $(id));
      $('soundSelect').onchange = () => save({ sound: $('soundSelect').value }, $('soundSelect'));
      $('volumeRange').oninput = () => {
        $('volumeValue').textContent = $('volumeRange').value + '%';
        $('volumeRange').setAttribute('aria-valuetext', $('volumeRange').value + '%');
        if (audio) audio.volume = Number($('volumeRange').value) / 100;
      };
      $('volumeRange').onchange = () => save({ volume: Number($('volumeRange').value) }, $('volumeRange'));
      $('soundPreview').onclick = () => A.action($('soundPreview'), async () => {
        await saveQueue;
        stopAudio();
        const generation = audioGeneration;
        const url = await A.invoke('getSoundUrl');
        if (generation !== audioGeneration || !A.isActive() || A.view !== 'settings') return;
        if (typeof url !== 'string' || !/^data:audio\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(url)) throw new Error('所选音频无法读取，请重新导入。');
        audio = new Audio(url); audio.volume = A.state.prefs.volume / 100;
        const playing = audio;
        playing.onended = () => { if (audio === playing) audio = null; };
        try { await playing.play(); }
        catch (error) { if (generation !== audioGeneration || error.name === 'AbortError') return; throw error; }
      }, '暂时无法试听。');
      $('importSound').onclick = () => A.action($('importSound'), async () => {
        stopAudio();
        const result = await A.invoke('importSound');
        if (!result || result.canceled) return;
        importName = result.name || '本地音频';
        await saveQueue;
        await A.mutate('setPrefs', { sound: 'custom' });
        render(A.state); A.toast('已选用导入的声音。');
      }, '音频导入没有成功。');
    }, render, stopAudio
  };
})();

