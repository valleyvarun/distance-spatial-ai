// Animation loop: everything that moves is drawn here, on top of the
// pre-rendered sky and house layers from house.js.
(() => {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // How much colour to drain from everything that isn't a character
  // (0 = full colour, 1 = greyscale). Keeps Mom and the boy popping out.
  const BACKGROUND_DESATURATION = 0.6;

  // 0 = TV off, 1 = on; in between while the CRT switches on or off
  let tvLevel = 1;

  // ---- View-sized layers ------------------------------------------------
  // Rebuilt whenever the canvas changes size: the sky and land behind the
  // house, the stars, and the per-pixel lighting maps.
  let skyLayer, landLayer, stars;
  let lightOff, lightTv; // lighting with the TV off, and how much it adds when on
  let shadeMap;          // how much of the shading each pixel gets

  function makeStars() {
    const r = Px.rng(7);
    const top = View.oy + 72; // stars only where the sky is dark
    return Array.from({ length: Math.round((View.w * top) / 520) }, () => ({
      x: Math.floor(r() * View.w),
      y: Math.floor(r() * top),
      speed: 1 + r() * 2.5,
      phase: r() * Math.PI * 2,
      big: r() < 0.15,
    }));
  }

  function setView(w, h) {
    if (canvas.width === w && canvas.height === h && skyLayer) return;
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = false;
    Object.assign(View, { w, h, ox: Math.floor((w - W) / 2), oy: SKY_EXTRA + Math.floor((h - CH) / 2) });
    skyLayer = House.buildSky(View);
    landLayer = House.buildLand(View);
    stars = makeStars();
    lightOff = House.buildLightMap(false, View);
    const lightOn = House.buildLightMap(true, View);
    lightTv = lightOn.map((v, i) => v - lightOff[i]);
    shadeMap = House.buildShadeMap(View);
  }

  // Grey out and light the background: only the table lamp and the TV
  // light the scene, and it gets darker the further you are from them.
  function shadeBackground(amount) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const s = shadeMap[p];
      if (!s) continue;
      const grey = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const desat = amount * s;
      const light = 1 - (1 - (lightOff[p] + lightTv[p] * tvLevel)) * s;
      d[i] = (d[i] + (grey - d[i]) * desat) * light;
      d[i + 1] = (d[i + 1] + (grey - d[i + 1]) * desat) * light;
      d[i + 2] = (d[i + 2] + (grey - d[i + 2]) * desat) * light;
    }
    ctx.putImageData(img, 0, 0);
  }

  const L = House.LAYOUT;
  const houseLayer = House.buildHouse();
  const tvLayer = Px.canvas(L.tvScreen.w, L.tvScreen.h);
  const tvg = tvLayer.getContext('2d');

  // The shaded dinner table on its own, redrawn over anyone sitting at it
  const tableMask = House.buildTableMask();
  const tableOverlay = Px.canvas(W, H);
  const tableG = tableOverlay.getContext('2d');
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---- Screen scaling ---------------------------------------------------
  // The canvas fills all the space it's given (the .screen box, less the
  // 16px frame border). The scale is set so the whole house (W×CH) always
  // fits; whatever room is left over shows more sky, garden and lawn.
  const frame = canvas.parentElement;
  const screen = document.querySelector('.screen');
  function fit() {
    const availW = screen.clientWidth - 32, availH = screen.clientHeight - 32;
    if (availW <= 0 || availH <= 0) return;
    const s = Math.min(availW / W, availH / CH);
    const w = Math.max(W, Math.floor(availW / s)), h = Math.max(CH, Math.floor(availH / s));
    setView(w, h);
    canvas.style.width = w * s + 'px';
    canvas.style.height = h * s + 'px';
    frame.style.setProperty('--px', s + 'px');
    if (running) render(); // resizing clears the canvas; repaint before it's ever seen blank
  }
  let running = false;
  new ResizeObserver(fit).observe(screen);
  fit();

  Characters.init(canvas);

  // ---- Clouds (world coordinates) ----------------------------------------
  function makeCloud(w, seed) {
    const r = Px.rng(seed);
    const c = Px.canvas(w + 6, 16), g = c.getContext('2d');
    const puffs = [];
    for (let x = 5; x < w; x += 4 + Math.floor(r() * 4)) {
      puffs.push([x, 9 - Math.floor(r() * 4), 3 + Math.floor(r() * 3)]);
    }
    for (const [x, y, rr] of puffs) Px.disc(g, x, y + 1, rr, '#c96a9e');
    for (const [x, y, rr] of puffs) Px.disc(g, x, y, rr, '#f7a6c8');
    for (const [x, y, rr] of puffs) if (rr > 3) Px.disc(g, x - 1, y - 1, rr - 2, '#ffd6e8');
    g.clearRect(0, 13, c.width, 3);
    Px.rect(g, 3, 12, w - 2, 1, '#c96a9e');
    return c;
  }
  const clouds = [
    { img: makeCloud(40, 1), x: 10, y: 10, v: 2.0 },
    { img: makeCloud(28, 2), x: 150, y: 30, v: 3.2 },
    { img: makeCloud(52, 3), x: 290, y: -18, v: 1.4 },
    { img: makeCloud(34, 4), x: -20, y: 52, v: 2.6 },
    { img: makeCloud(30, 5), x: 200, y: -22, v: 1.8 },
  ];

  // ---- Little game on the TV ------------------------------------------
  const HERO_PALETTE = { R: '#ff3b3b', S: '#ffd6b5', E: '#1a1a2a', B: '#2f4fe0' };
  const heroTop = ['.RRR.', 'RRRRR', '.SSE.', 'RBBBR', '.BBB.'];
  const hero = [
    Px.sprite([...heroTop, '.B.B.'], HERO_PALETTE, 5),
    Px.sprite([...heroTop, 'B...B'], HERO_PALETTE, 5),
  ];

  function drawGame(g, t) {
    const w = L.tvScreen.w, h = L.tvScreen.h;
    const s = t * 22;
    Px.rect(g, 0, 0, w, h, '#4fb4ff');
    Px.rect(g, 0, 9, w, 5, '#74c8ff');
    Px.rect(g, 0, 14, w, 4, '#9bdcff');
    const cx = Math.round(70 - ((s * 0.3) % 90));
    Px.rect(g, cx, 4, 9, 2, '#ffffff');
    Px.rect(g, cx + 2, 3, 4, 1, '#ffffff');

    for (let x = 0; x < w; x++) {
      const top = Math.round(17 + 2.5 * Math.sin((x + s * 0.4) / 6));
      Px.rect(g, x, top, 1, 23 - top, '#3cc46a');
      Px.dot(g, x, top, '#8af09a');
    }

    Px.rect(g, 0, 23, w, h - 23, '#d0703a');
    Px.rect(g, 0, 23, w, 1, '#8af05a');
    Px.rect(g, 0, 26, w, 1, '#8a3a1a');
    for (let x = 0; x < w; x++) {
      const k = Math.floor(x + s) % 8;
      if (k === 0) Px.rect(g, x, 24, 1, 2, '#8a3a1a');
      if (k === 4) Px.rect(g, x, 27, 1, 2, '#8a3a1a');
    }

    for (let i = 0; i < 3; i++) {
      const bx = Math.round((((i * 40 + 70 - s) % 120) + 120) % 120) - 20;
      Px.rect(g, bx, 9, 6, 6, '#a8641e');
      Px.rect(g, bx + 1, 10, 4, 4, '#ffd23f');
      Px.dot(g, bx + 2, 11, '#a8641e');
      Px.dot(g, bx + 3, 12, '#a8641e');
    }

    // The hero hops over a walking mushroom on every loop
    const cyc = (t % 1.4) / 1.4;
    const f = ((0.25 - cyc + 0.5) % 1 + 1) % 1 - 0.5;
    const ex = Math.round(12 + f * 90);
    Px.rect(g, ex, 19, 5, 2, '#c8402a');
    Px.dot(g, ex + 1, 19, '#ffffff');
    Px.rect(g, ex + 1, 21, 3, 2, '#ffe0b0');
    Px.dot(g, ex, 22, '#3a1a0a'); Px.dot(g, ex + 4, 22, '#3a1a0a');

    const jump = cyc < 0.5 ? Math.round(Math.sin((cyc / 0.5) * Math.PI) * 9) : 0;
    g.drawImage(hero[jump ? 1 : Math.floor(t * 10) % 2], 10, 17 - jump);

    for (let i = 0; i < 3; i++) Px.dot(g, 2 + i * 3, 2, '#ff3b5c');
    for (let y = 1; y < h; y += 2) Px.rect(g, 0, y, w, 1, 'rgba(0, 0, 0, 0.12)');
    Px.line(g, 3, 6, 8, 1, 'rgba(255, 255, 255, 0.3)');
  }

  // Old-CRT style power: switching off squashes the picture into a bright
  // line, the line shrinks to a dot, then the glass goes dark. Switching
  // on plays the same thing in reverse.
  function drawTv() {
    const s = L.tvScreen;
    Px.rect(ctx, s.x, s.y, s.w, s.h, '#101018');
    if (tvLevel > 0) drawGame(tvg, t);
    if (tvLevel === 1) {
      ctx.drawImage(tvLayer, s.x, s.y);
    } else if (tvLevel > 0.5) {
      const h = Math.max(1, Math.round(s.h * (tvLevel - 0.5) * 2));
      const y = s.y + Math.round((s.h - h) / 2);
      ctx.drawImage(tvLayer, 0, 0, s.w, s.h, s.x, y, s.w, h);
      ctx.globalAlpha = 0.6;
      Px.rect(ctx, s.x, y, s.w, h, '#ffffff');
      ctx.globalAlpha = 1;
    } else if (tvLevel > 0) {
      const w = Math.max(1, Math.round(s.w * tvLevel * 2));
      Px.rect(ctx, s.x + Math.round((s.w - w) / 2), s.y + Math.floor(s.h / 2), w, 1, '#ffffff');
    }
    if (tvLevel < 1) {
      // Faint reflections on the dark glass
      Px.line(ctx, s.x + 3, s.y + 11, s.x + 13, s.y + 1, 'rgba(255, 255, 255, 0.07)');
      Px.line(ctx, s.x + 7, s.y + 11, s.x + 17, s.y + 1, 'rgba(255, 255, 255, 0.04)');
    }
    Px.dot(ctx, s.x + s.w + 1, s.y + s.h + 1, tvLevel > 0 ? '#3aff8a' : '#ff4757'); // power LED
  }

  // ---- Particles ------------------------------------------------------
  const steam = [];
  const steamTimers = L.steam.map(() => Math.random() * 0.3);
  const petals = [];
  const notes = [];
  const zees = [];
  const NOTE = ['..#.', '..##', '..#.', '###.', '##..'];
  const ZEE = ['####', '..#.', '.#..', '####'];
  const NOTE_COLORS = ['#ffd23f', '#ff8fc4', '#7ad7f0', '#b8f27a'];
  let noteTimer = 0, noteSide = 0, zeeTimer = 1;

  function spawnPetal(anywhere) {
    const c = L.canopy;
    return {
      x: anywhere ? rand(0, L.gardenEdge) : rand(c.x0, c.x1),
      y: anywhere ? rand(c.y0, 205) : rand(c.y0, c.y1),
      vx: rand(5, 11), vy: rand(6, 11),
      phase: rand(0, Math.PI * 2),
      col: Math.random() < 0.5 ? '#ffc2e0' : '#ff8fc4',
      land: rand(196, 212),
    };
  }
  for (let i = 0; i < 14; i++) petals.push(spawnPetal(true));

  // Draw a text-map glyph (notes, Zs) with a given colour and alpha
  function glyph(rows, x, y, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
    });
    ctx.globalAlpha = 1;
  }

  // ---- Cat ---------------------------------------------------------------
  function drawCat(t) {
    const { x, y } = L.cat; // centre of the cushion
    const out = '#3a2420', fur = '#ff9a3c', dark = '#d0702a', cream = '#fff3e0';
    const breathe = Math.sin(t * 2.2) > 0 ? 1 : 0;
    const tail = Math.floor(t / 3) % 3 === 0 && t % 3 < 0.5 ? 1 : 0;

    // Outline pass, then fill pass, so the shapes merge into one silhouette
    Px.ellipse(ctx, x + 2, y - 4, 8, 4 + breathe, out);
    Px.disc(ctx, x - 6, y - 5, 4, out);
    Px.rect(ctx, x - 8, y - 2, 18, 3, out);
    Px.dot(ctx, x - 9, y - 10, out); Px.dot(ctx, x - 4, y - 10, out);

    Px.ellipse(ctx, x + 2, y - 4, 7, 3 + breathe, fur);
    Px.disc(ctx, x - 6, y - 5, 3, fur);
    Px.dot(ctx, x - 9, y - 9, fur); Px.dot(ctx, x - 4, y - 9, fur);
    Px.dot(ctx, x - 9, y - 8, '#ff9aa8'); Px.dot(ctx, x - 4, y - 8, '#ff9aa8');
    Px.ellipse(ctx, x + 3, y - 2, 5, 1, cream);
    Px.rect(ctx, x - 8, y - 4, 4, 2, cream);
    for (const dx of [0, 3, 6]) Px.dot(ctx, x + dx, y - 7 - breathe, dark);
    Px.rect(ctx, x - 8, y - 5, 2, 1, out);
    Px.rect(ctx, x - 5, y - 5, 2, 1, out);
    Px.dot(ctx, x - 6, y - 3, '#ff7a8a');

    // Tail curled round the front, the tip flicks now and then
    Px.rect(ctx, x - 7, y - 1, 16, 1, fur);
    Px.rect(ctx, x - 7, y - 1, 2, 1, dark);
    Px.dot(ctx, x - 8, y - 1 - tail, fur);
  }

  // ---- Main loop -------------------------------------------------------
  let last = performance.now(), t = 0;

  function update(dt) {
    // Clouds drift across the whole view, then wrap round
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > View.w - View.ox) c.x = -View.ox - c.img.width;
    }

    L.steam.forEach(([sx, sy], i) => {
      steamTimers[i] -= dt;
      if (steamTimers[i] <= 0) {
        steamTimers[i] = rand(0.14, 0.3);
        steam.push({ x: sx + rand(-1.5, 1.5), y: sy, vy: -rand(5, 9), life: rand(1.6, 2.4), age: 0, phase: rand(0, 6.28), amp: rand(0.6, 1.4) });
      }
    });
    for (let i = steam.length - 1; i >= 0; i--) {
      const p = steam[i];
      p.age += dt; p.y += p.vy * dt; p.phase += dt * 3;
      if (p.age > p.life) steam.splice(i, 1);
    }

    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      p.phase += dt * 3;
      p.x += (p.vx + Math.sin(p.phase) * 6) * dt;
      p.y += p.vy * dt;
      if (p.x > L.gardenEdge || p.y > p.land) petals[i] = spawnPetal(false);
    }

    // The TV (and speakers) are on only while the boy sits in front of it
    const tvTarget = Characters.boyAtTv() ? 1 : 0;
    tvLevel += Math.sign(tvTarget - tvLevel) * Math.min(Math.abs(tvTarget - tvLevel), dt / 0.4);

    noteTimer -= dt;
    if (noteTimer <= 0 && tvLevel === 1) {
      noteTimer = rand(0.6, 1.1);
      const w = L.woofers[noteSide++ % 2];
      notes.push({ x: w.x - 2 + rand(-2, 2), y: w.y - 16, age: 0, life: 2.2, col: NOTE_COLORS[Math.floor(rand(0, 4))], phase: rand(0, 6.28) });
    }
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      n.age += dt; n.y -= 7 * dt; n.phase += dt * 4;
      if (n.age > n.life) notes.splice(i, 1);
    }

    zeeTimer -= dt;
    if (zeeTimer <= 0) {
      zeeTimer = 2.2;
      zees.push({ x: L.cat.x - 6, y: L.cat.y - 14, age: 0, life: 2 });
    }
    for (let i = zees.length - 1; i >= 0; i--) {
      const z = zees[i];
      z.age += dt; z.y -= 4 * dt; z.x += 2 * dt;
      if (z.age > z.life) zees.splice(i, 1);
    }

    Characters.update(dt, t);
  }

  function clipTo(r, draw) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    draw();
    ctx.restore();
  }

  function render() {
    // Sky
    ctx.drawImage(skyLayer, 0, 0);
    for (const s of stars) {
      const b = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      ctx.globalAlpha = 0.3 + 0.7 * b;
      Px.dot(ctx, s.x, s.y, '#fff6d8');
      if (s.big && b > 0.6) {
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) Px.dot(ctx, s.x + dx, s.y + dy, '#ffc8ec');
      }
    }
    ctx.globalAlpha = 1;

    // Everything below is in world coordinates
    ctx.save();
    ctx.translate(View.ox, View.oy);
    for (const c of clouds) ctx.drawImage(c.img, Math.round(c.x), c.y);

    // Hills and lawn, then the house
    ctx.drawImage(landLayer, -View.ox, -View.oy);
    ctx.drawImage(houseLayer, 0, 0);
    drawTv();

    // Lights: TV and ceiling light upstairs, warm lamp over the table
    const flicker = 0.045 + 0.015 * Math.sin(t * 9) + 0.01 * Math.sin(t * 23);
    clipTo(L.upperRoom, () => {
      Px.glow(ctx, L.ceilingLight.x, L.ceilingLight.y, 30, '#fff0b0', 0.03, 3);
      if (tvLevel > 0) Px.glow(ctx, L.tvScreen.x + 28, L.tvScreen.y + 16, 46, '#7fd6ff', flicker * tvLevel, 4);
    });
    clipTo(L.groundRoom, () => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.05;
      Px.poly(ctx, [[219, 137], [236, 137], [264, 176], [190, 176]], '#ffd27a');
      ctx.restore();
      Px.glow(ctx, L.lamp.x, L.lamp.y, 44, '#ffc266', 0.045, 5);
    });
    Px.glow(ctx, L.lantern.x, L.lantern.y, 9, '#ffb84d', 0.07 + 0.03 * Math.sin(t * 5), 3);

    // Speakers thump to the beat while the TV is on
    const beat = tvLevel === 1 && (t % 0.42) < 0.09;
    for (const w of L.woofers) {
      Px.disc(ctx, w.x, w.y, 2, beat ? '#6a6aa0' : '#4d4d74');
      Px.dot(ctx, w.x, w.y, beat ? '#c8c8ff' : '#8f8fc4');
    }
    clipTo(L.upperRoom, () => {
      for (const n of notes) {
        const a = Math.min(1, n.age * 3) * (1 - n.age / n.life);
        glyph(NOTE, n.x + Math.sin(n.phase) * 1.5, n.y, n.col, a);
      }
    });

    // Steam from dinner and the pot
    for (const p of steam) {
      const k = p.age / p.life;
      const a = Math.min(1, p.age * 4) * (1 - k);
      const x = Math.round(p.x + Math.sin(p.phase) * p.amp * (0.4 + k * 1.6));
      const y = Math.round(p.y);
      ctx.fillStyle = `rgba(170, 120, 160, ${0.45 * a})`;
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * a})`;
      ctx.fillRect(x, y, 1, 2);
    }

    // Cat napping under the stairs
    drawCat(t);
    for (const z of zees) {
      const a = Math.min(1, z.age * 3) * (1 - z.age / z.life);
      glyph(ZEE, z.x, z.y, '#ffffff', a);
    }

    // Sakura petals drifting in the garden
    for (const p of petals) {
      Px.dot(ctx, p.x, p.y, p.col);
      if (Math.sin(p.phase) > 0) Px.dot(ctx, p.x + 1, p.y, p.col);
    }

    // Everything so far is background — tone it down before the characters
    shadeBackground(BACKGROUND_DESATURATION);

    // Cut the shaded table out on its own (in world coordinates) so seated
    // characters can sit behind it
    tableG.globalCompositeOperation = 'copy';
    tableG.drawImage(canvas, -View.ox, -View.oy);
    tableG.globalCompositeOperation = 'destination-in';
    tableG.drawImage(tableMask, 0, 0);
    tableG.globalCompositeOperation = 'source-over';

    Characters.draw(ctx, tableOverlay);
    Distances.draw(ctx, t);
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); // first rAF stamp can predate `last`
    last = now;
    t += dt;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  running = true;
  requestAnimationFrame(loop);
})();
