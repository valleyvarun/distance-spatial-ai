// Sidebars: music controls on the left, live readouts on the right.
(() => {
  const movementHint = document.getElementById('movement-hint');
  Characters.onFirstMove(() => { movementHint.hidden = true; });
  const winScreen = document.getElementById('win-screen');
  const restart = document.getElementById('restart');
  restart.addEventListener('click', () => window.location.reload());
  Characters.onWin(() => {
    movementHint.hidden = true;
    document.querySelector('.frame').classList.add('has-won');
    winScreen.hidden = false;
    // Keep keyboard focus in the end screen until the game is restarted.
    document.querySelectorAll('.panel').forEach(panel => { panel.inert = true; });
    restart.focus({ preventScroll: true });
    winScreen.addEventListener('keydown', event => {
      if (event.key === 'Tab') {
        event.preventDefault();
        restart.focus();
      }
    });
  });

  // ---- Music --------------------------------------------------------------
  const toggle = document.getElementById('music-toggle');
  const volume = document.getElementById('music-volume');

  toggle.addEventListener('click', () => {
    const on = toggle.getAttribute('aria-pressed') !== 'true';
    if (on) Music.start();
    else Music.stop();
    toggle.setAttribute('aria-pressed', String(on));
    toggle.textContent = on ? '♪ Music on' : '♪ Music off';
  });

  volume.addEventListener('input', () => Music.setVolume(volume.value / 100));
  Music.setVolume(volume.value / 100);

  // ---- Calling out --------------------------------------------------------
  // With sound distance on, whoever you click calls out to the other
  Characters.onSelect(who => {
    if (who && Distances.active.sound) Speech.say(who);
  });

  // ---- Distance toggles ---------------------------------------------------
  for (const button of document.querySelectorAll('[data-distance]')) {
    button.addEventListener('click', () => {
      const on = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(on));
      Distances.active[button.dataset.distance] = on;
    });
  }

  // ---- Outputs ------------------------------------------------------------
  const KINDS = ['physical', 'travel', 'visual', 'sound'];
  const out = Object.fromEntries(KINDS.map(kind => [kind, document.getElementById(`out-${kind}`)]));

  function refresh() {
    const d = Distances.readouts();
    for (const kind of KINDS) if (out[kind].textContent !== d[kind]) out[kind].textContent = d[kind];
  }
  refresh();
  setInterval(refresh, 150);
})();
