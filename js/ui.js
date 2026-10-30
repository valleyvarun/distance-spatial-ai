// Sidebars: music controls on the left, live readouts on the right.
(() => {
  // Each achievement is permanent for this game; notifications queue so
  // sitting and being sent away in the same frame both get their moment.
  const objectiveRows = new Map([...document.querySelectorAll('[data-objective]')].map(row => [row.dataset.objective, row]));
  const objectiveToast = document.getElementById('objective-toast');
  const objectiveToastLabel = document.getElementById('objective-toast-label');
  const celebrations = [];
  let celebrating = false;
  for (const row of objectiveRows.values()) {
    row.setAttribute('aria-label', row.querySelector('.objective-label').textContent + ': incomplete');
  }
  function showCelebration() {
    if (celebrating || !celebrations.length) return;
    celebrating = true;
    objectiveToastLabel.textContent = celebrations.shift();
    objectiveToast.hidden = false;
    objectiveToast.classList.remove('celebrating');
    void objectiveToast.offsetWidth;
    objectiveToast.classList.add('celebrating');
    setTimeout(() => {
      objectiveToast.hidden = true;
      objectiveToast.classList.remove('celebrating');
      celebrating = false;
      showCelebration();
    }, 2000);
  }
  Characters.onObjective(id => {
    const row = objectiveRows.get(id);
    if (!row) return;
    const label = row.querySelector('.objective-label').textContent;
    row.classList.add('completed');
    row.setAttribute('aria-label', label + ': complete');
    celebrations.push(label);
    showCelebration();
  });

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
    if (who && Characters.distancePair().includes(who) && Distances.active.sound) Speech.say(who);
  });
  Characters.onDialogue((who, line) => Speech.say(who, line));

  // ---- Distance pair ------------------------------------------------------
  const pairSelect = document.getElementById('distance-pair');
  pairSelect.value = 'mom-boy';
  const pairLabel = document.getElementById('selected-distance-pair');
  function showPair() {
    Characters.setDistancePair(pairSelect.value);
    pairLabel.textContent = pairSelect.selectedOptions[0].textContent;
    refresh();
  }
  pairSelect.addEventListener('change', showPair);

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
  showPair();
  setInterval(refresh, 150);
})();
