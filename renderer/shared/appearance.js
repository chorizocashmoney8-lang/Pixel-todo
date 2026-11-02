(function () {
  let active = !document.hidden;
  const listeners = new Set();
  function setActive(next) { active = next && !document.hidden; document.body.classList.toggle('inactive', !active); listeners.forEach(fn => fn()); }
  const widgetWindow = Boolean(document.getElementById('widget'));
  document.addEventListener('visibilitychange', () => setActive(!document.hidden && (widgetWindow || document.hasFocus())));
  if (window.pixelApi && window.pixelApi.onActivityChanged) window.pixelApi.onActivityChanged(setActive);
  function apply(prefs) {
    const theme = window.PixelThemes[prefs.theme] || window.PixelThemes[0];
    document.documentElement.style.cssText = theme.vars;
    document.body.classList.toggle('system-font', prefs.font === 'system');
    document.body.classList.toggle('reduce-motion', prefs.animate === false);
  }
  function sprite(prefs, pose, face) {
    const t = window.PixelThemes[prefs.theme] || window.PixelThemes[0];
    return t.sprites[pose === undefined ? prefs.pose || 0 : pose][face === undefined ? prefs.face || 0 : face];
  }
  function startBuddy(element, getPrefs) {
    let interval = null; let pose = null, face = null;
    element.classList.add('pixel-sprite');
    function draw() {
      const prefs = getPrefs(); if (!prefs) return;
      element.innerHTML = sprite(prefs, prefs.idleMode === 'random' && pose !== null ? pose : prefs.pose || 0, prefs.idleMode === 'random' && face !== null ? face : prefs.face || 0);
    }
    function update() {
      const prefs = getPrefs();
      const run = prefs && prefs.buddy && prefs.animate !== false && prefs.idleMode === 'random' && active && !document.hidden;
      if (run && interval === null) interval = setInterval(() => { const n = Math.floor(Math.random()*8); pose = Math.floor(n/4); face = n%4; draw(); },8000);
      if (!run && interval !== null) { clearInterval(interval); interval = null; }
      draw();
    }
    listeners.add(update); document.addEventListener('pixel-prefs',update); update();
    return () => { clearInterval(interval); listeners.delete(update); document.removeEventListener('pixel-prefs',update); };
  }
  window.PixelAppearance = { apply, sprite, startBuddy, isActive: () => active };
})();
