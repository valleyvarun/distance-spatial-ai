// The four kinds of distance between the chosen characters, switched on from the
// controls sidebar. So far:
//   physical — a straight line from neck to neck, through walls and floors
//   travel   — the length of the walk between them, along floors and stairs
//   visual   — how far the light goes from one's eyes to the other's:
//              straight across, or bounced off the mirror
//   sound    — how far away Mom's voice sounds to the boy: the distance
//              face to face in open air that would make her just as quiet
const Distances = (() => {
  // Scale: one storey (78 px floor to floor) is 3 m — so Mom stands about
  // 1.7 m tall and the boy about 1.3 m
  const PX_PER_M = Characters.STOREY / 3;
  const TRAVEL_LIFT = 3; // the travel line runs this far above the walking line

  const COLORS = { physical: '#ffd23f', travel: '#ff5d8f', visual: '#5ad1ff', sound: '#7ee07a' };
  const SHADOW = 'rgba(18, 10, 36, 0.85)';
  const active = { physical: false, travel: false, visual: false, sound: false };

  function physical() {
    const necks = Characters.necks();
    const [a, b] = Characters.distancePair().map(id => necks[id]);
    return Math.hypot(b.x - a.x, b.y - a.y) / PX_PER_M;
  }

  function pathLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return len;
  }

  // The point a given distance along a path
  function pointAlong(pts, d) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (d <= seg && seg > 0) return { x: a.x + ((b.x - a.x) * d) / seg, y: a.y + ((b.y - a.y) * d) / seg };
      d -= seg;
    }
    return pts[pts.length - 1];
  }

  const travel = () => pathLength(Characters.travelPath()) / PX_PER_M;

  // ---- Lines of sight ---------------------------------------------------
  const MIRROR = House.LAYOUT.mirror;
  const SOLIDS = House.LAYOUT.solids;

  // How far along the segment (ax, ay)→(bx, by) (0..1) it enters the
  // rectangle [x, y, w, h], or null if it misses (Liang–Barsky clipping).
  // Written without allocating, as the sound waves call it a lot.
  function entersRect(ax, ay, bx, by, rect) {
    const [rx, ry, rw, rh] = rect;
    const dx = bx - ax, dy = by - ay;
    let t0 = 0, t1 = 1;
    if (dx === 0) {
      if (ax < rx || ax > rx + rw) return null;
    } else {
      let enter = (rx - ax) / dx, leave = (rx + rw - ax) / dx;
      if (enter > leave) { const s = enter; enter = leave; leave = s; }
      t0 = Math.max(t0, enter);
      t1 = Math.min(t1, leave);
    }
    if (dy === 0) {
      if (ay < ry || ay > ry + rh) return null;
    } else {
      let enter = (ry - ay) / dy, leave = (ry + rh - ay) / dy;
      if (enter > leave) { const s = enter; enter = leave; leave = s; }
      t0 = Math.max(t0, enter);
      t1 = Math.min(t1, leave);
    }
    return t0 <= t1 ? t0 : null;
  }

  // How far along a→b (0..1) the segment first runs into a wall, ceiling or
  // floor slab, or null if it gets through clear. The stairs and furniture
  // don't block the view.
  function blockedAt(a, b) {
    let first = null;
    for (const rect of SOLIDS) {
      const t = entersRect(a.x, a.y, b.x, b.y, rect);
      if (t !== null && (first === null || t < first)) first = t;
    }
    return first;
  }

  // How Mom and the boy see each other: straight across if nothing is in the
  // way, otherwise by light bouncing off the mirror, otherwise not at all.
  // It's worked out from the viewer's side (the boy when he's selected,
  // otherwise Mom). Via the mirror, the light travels exactly as far as a
  // straight line from the viewer to the other person's mirror image behind
  // the glass — the same either way round.
  function sight() {
    const eyes = Characters.eyes();
    const who = Characters.viewer(), other = Characters.distancePair().find(id => id !== who);
    const viewer = eyes[who], target = eyes[other];
    const block = blockedAt(viewer, target);
    if (block === null) {
      return { kind: 'direct', viewer, target, length: Math.hypot(target.x - viewer.x, target.y - viewer.y) };
    }

    const image = { x: 2 * MIRROR.x - target.x, y: target.y };
    const s = (MIRROR.x - viewer.x) / (image.x - viewer.x);
    const hit = { x: MIRROR.x, y: viewer.y + (image.y - viewer.y) * s };
    const onGlass = s > 0 && s < 1 && hit.y >= MIRROR.y0 && hit.y <= MIRROR.y1;
    if (onGlass && blockedAt(viewer, hit) === null && blockedAt(hit, target) === null) {
      return { kind: 'mirror', viewer, target, seen: other, hit, image, length: Math.hypot(image.x - viewer.x, image.y - viewer.y) };
    }
    return { kind: null, viewer, target, block };
  }

  // Marching dashed line with a dark drop shadow, so it reads on any
  // background. `phase` carries the dash pattern on from a previous segment;
  // the phase to continue with is returned.
  function dashedLine(ctx, a, b, color, t, phase = 0) {
    const steps = Math.max(1, Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    const shift = Math.floor(t * 10);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      if ((i + phase + shift) % 6 >= 4) continue;
      pts.push([Math.floor(a.x + ((b.x - a.x) * i) / steps), Math.floor(a.y + ((b.y - a.y) * i) / steps)]);
    }
    for (const [x, y] of pts) Px.dot(ctx, x, y + 1, SHADOW);
    for (const [x, y] of pts) Px.dot(ctx, x, y, color);
    return phase + steps;
  }

  function endpoint(ctx, p, color, small = false) {
    Px.disc(ctx, Math.floor(p.x), Math.floor(p.y), small ? 1 : 2, SHADOW);
    Px.disc(ctx, Math.floor(p.x), Math.floor(p.y), small ? 0 : 1, color);
  }

  // A little tag like "4.2 m", just above the middle of the line, kept on screen
  function label(ctx, str, mid, color) {
    const w = Px.textWidth(str) + 6, h = 9;
    const x = Math.round(Math.max(-View.ox + 2, Math.min(View.w - View.ox - w - 2, mid.x - w / 2)));
    const y = Math.round(Math.max(-View.oy + 2, mid.y - h - 5));
    Px.rect(ctx, x, y, w, h, color);
    Px.rect(ctx, x + 1, y + 1, w - 2, h - 2, '#1d1238');
    Px.text(ctx, str, x + 3, y + 2, color);
  }

  function drawPhysical(ctx, t) {
    const necks = Characters.necks();
    const [a, b] = Characters.distancePair().map(id => necks[id]);
    const color = COLORS.physical;
    dashedLine(ctx, a, b, color, t);
    endpoint(ctx, a, color);
    endpoint(ctx, b, color);
    label(ctx, `${physical().toFixed(1)} m`, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, color);
  }

  // The walking route from Mom to the boy, traced just above the floor and
  // along the noses of the stairs
  function drawTravel(ctx, t) {
    const pts = Characters.travelPath().map(p => ({ x: p.x, y: p.y - TRAVEL_LIFT }));
    const color = COLORS.travel;
    let phase = 0;
    for (let i = 1; i < pts.length; i++) phase = dashedLine(ctx, pts[i - 1], pts[i], color, t, phase);
    endpoint(ctx, pts[0], color);
    endpoint(ctx, pts[pts.length - 1], color);
    label(ctx, `${travel().toFixed(1)} m`, pointAlong(pts, pathLength(pts) / 2), color);
  }

  function cross(ctx, p, color) {
    const x = Math.floor(p.x), y = Math.floor(p.y);
    for (const [dx, dy] of [[-2, -2], [-1, -1], [0, 0], [1, 1], [2, 2], [2, -2], [1, -1], [-1, 1], [-2, 2]]) {
      Px.dot(ctx, x + dx, y + dy + 1, SHADOW);
    }
    for (const [dx, dy] of [[-2, -2], [-1, -1], [0, 0], [1, 1], [2, 2], [2, -2], [1, -1], [-1, 1], [-2, 2]]) {
      Px.dot(ctx, x + dx, y + dy, color);
    }
  }

  function drawVisual(ctx, t) {
    const v = sight();
    const color = COLORS.visual;

    if (v.kind === 'direct') {
      dashedLine(ctx, v.viewer, v.target, color, t);
      endpoint(ctx, v.viewer, color, true); // small, so it doesn't hide the eyes
      endpoint(ctx, v.target, color, true);
      label(ctx, `${(v.length / PX_PER_M).toFixed(1)} m`, { x: (v.viewer.x + v.target.x) / 2, y: (v.viewer.y + v.target.y) / 2 }, color);
      return;
    }

    if (v.kind === 'mirror') {
      // The other person's mirror image, faintly, where the viewer's eyes
      // place them behind the glass — and the line of sight carrying on to it
      Characters.drawReflection(ctx, v.seen, MIRROR.x, 0.35);
      ctx.globalAlpha = 0.45;
      dashedLine(ctx, v.hit, v.image, color, t);
      ctx.globalAlpha = 1;
      // The path the light really takes: from the person seen, off the mirror, to the viewer
      const phase = dashedLine(ctx, v.target, v.hit, color, t);
      dashedLine(ctx, v.hit, v.viewer, color, t, phase);
      endpoint(ctx, v.viewer, color, true);
      endpoint(ctx, v.target, color, true);
      Px.disc(ctx, Math.floor(v.hit.x), Math.floor(v.hit.y), 2, '#ffffff'); // glint where it bounces
      label(ctx, `${(v.length / PX_PER_M).toFixed(1)} m`, pointAlong([v.viewer, v.hit, v.target], v.length / 2), color);
      return;
    }

    // They can't see each other: show the viewer's line of sight stopping at the wall
    const end = { x: v.viewer.x + (v.target.x - v.viewer.x) * v.block, y: v.viewer.y + (v.target.y - v.viewer.y) * v.block };
    ctx.globalAlpha = 0.6;
    dashedLine(ctx, v.viewer, end, color, t);
    ctx.globalAlpha = 1;
    endpoint(ctx, v.viewer, color, true);
    cross(ctx, end, '#ff4757');
  }

  // ---- Sound ------------------------------------------------------------
  // One calls the other — Mom calls the boy, or the boy calls Mom when he's
  // selected. The voice reaches the listener by up to two routes:
  //  - through the air: straight across if nothing's in the way, otherwise
  //    up (or down) the open stair hall and round the end of the floor slab.
  //    This carries nearly all of it.
  //  - straight through the floor slab, which stops most of what goes that way
  // Along each route the voice spreads out (6 dB quieter each time the
  // distance doubles), loses a little bending round the end of the slab,
  // and a lot passing through it. Adding the routes up gives how loud it is
  // at the listener's ear, compared with 1 m in front of the speaker. The
  // sound distance is how far apart they would stand, face to face with
  // only air between them, for the voice to drop that much — so mostly the
  // length of the air route, a little more for the turn. It's the same
  // whoever is calling.
  const SLAB = House.LAYOUT.slab;
  const [AIR_X, AIR_Y, AIR_W, AIR_H] = House.LAYOUT.interior;
  const SLAB_LOSS = 30; // dB lost passing through the floor slab
  const BEND_LOSS = 3;  // dB lost turning right back round a corner (less for gentler turns)
  const RING_BACK_DIM = 9; // dB the rings look dimmer pointing away from the listener (drawing only)
  // Points just round the open end of the slab, above and below it
  const SLAB_TOP = { x: SLAB[0] - 0.5, y: SLAB[1] - 0.5 };
  const SLAB_BOTTOM = { x: SLAB[0] - 0.5, y: SLAB[1] + SLAB[3] + 0.5 };

  // How many dB dimmer to draw a ring in direction (dx, dy) than along
  // `aim`, a unit vector towards the listener — so the waves show where the
  // voice is aimed
  function directivity(dx, dy, aim) {
    const cos = (dx * aim.x + dy * aim.y) / Math.hypot(dx, dy);
    return (-RING_BACK_DIM * (1 - cos)) / 2;
  }

  // Unit vector from the speaker's mouth towards the listener's ear
  function aimAt(mouth, ear) {
    const len = Math.hypot(ear.x - mouth.x, ear.y - mouth.y) || 1;
    return { x: (ear.x - mouth.x) / len, y: (ear.y - mouth.y) / len };
  }

  // The angle (0..π) between two directions — how sharply a route turns
  function turn(a, b) {
    const cos = (a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  const dir = (from, to) => ({ x: to.x - from.x, y: to.y - from.y });

  function sound() {
    const { mouth, ear } = Characters.voice();
    const aim = aimAt(mouth, ear);
    const routes = [];
    if (entersRect(mouth.x, mouth.y, ear.x, ear.y, SLAB) === null) {
      routes.push({ pts: [mouth, ear], loss: 0 });
    } else {
      routes.push({ pts: [mouth, ear], loss: SLAB_LOSS });
      const [first, second] = mouth.y > ear.y ? [SLAB_BOTTOM, SLAB_TOP] : [SLAB_TOP, SLAB_BOTTOM];
      const pts = [mouth, first, second, ear];
      const clear = pts.every((p, i) => i === 0 || entersRect(pts[i - 1].x, pts[i - 1].y, p.x, p.y, SLAB) === null);
      if (clear) routes.push({ pts, loss: (BEND_LOSS * turn(dir(mouth, first), dir(second, ear))) / Math.PI });
    }
    let total = 0;
    for (const r of routes) {
      const length = pathLength(r.pts) / PX_PER_M;
      r.intensity = 10 ** (-r.loss / 10) / Math.max(length, 0.1) ** 2;
      total += r.intensity;
    }
    const distance = 1 / Math.sqrt(total); // in open air, face to face, intensity falls as 1/distance²
    return { mouth, ear, aim, routes, total, distance, drop: 20 * Math.log10(distance) };
  }

  // ---- Sound waves ------------------------------------------------------
  // Bunches of three rings spread from the speaker's mouth, brightest
  // towards the listener. They fill the air of the house; through the slab
  // they carry on much fainter, and where they reach the slab's open end
  // they bend round into the other storey. (Slowed right down so you can
  // watch them.)
  const WAVE_SPEED = 24;   // px per second
  const WAVE_GAP = 4;      // px between the rings of a bunch
  const WAVE_EVERY = 1.6;  // seconds between bunches
  const WAVE_REACH = 320;  // px a ring travels before it has faded out
  const THROUGH_SLAB = 0.25; // how bright a ring stays through the slab (exaggerated so it shows)
  let bursts = [], lastBurst = -Infinity, speaker = null;

  const inAir = (x, y) => x >= AIR_X && x < AIR_X + AIR_W && y >= AIR_Y && y < AIR_Y + AIR_H &&
    !(x >= SLAB[0] && x < SLAB[0] + SLAB[2] && y >= SLAB[1] && y < SLAB[1] + SLAB[3]);

  // How strong a ring still looks after travelling r px
  const ringFade = r => Math.max(0, 1 - r / WAVE_REACH) ** 0.7;

  // Ring pixels are collected as flat [x, y, alpha, ...] then drawn in two
  // passes — dark shadows first, then the colour — so they read on any wall
  const ringPx = [];

  function addRing(b, r) {
    const fade = ringFade(r);
    const step = 1.2 / r;
    for (let i = 0, a = 0; a < Math.PI * 2; i++, a += step) {
      const dx = Math.cos(a), dy = Math.sin(a);
      const x = Math.round(b.x + dx * r), y = Math.round(b.y + dy * r);
      if (!inAir(x, y)) continue;
      let alpha = fade * 10 ** (directivity(dx, dy, b.aim) / 20);
      if (entersRect(b.x, b.y, x + 0.5, y + 0.5, SLAB) !== null) {
        if (i % 2) continue; // through the slab: dotted, and much fainter
        alpha *= THROUGH_SLAB;
      }
      ringPx.push(x, y, alpha);
    }
  }

  // Once a ring has reached the open end of the slab, a new ring spreads
  // from its far corner into the other storey — weaker the more it bends
  function addBentRing(b, r) {
    const below = b.y > SLAB[1] + SLAB[3];
    const [first, corner] = below ? [SLAB_BOTTOM, SLAB_TOP] : [SLAB_TOP, SLAB_BOTTOM];
    const r2 = r - Math.hypot(first.x - b.x, first.y - b.y) - Math.abs(first.y - corner.y);
    if (r2 <= 1) return;
    const inX = first.x - b.x, inY = first.y - b.y, inLen = Math.hypot(inX, inY);
    const base = ringFade(r) * 10 ** (directivity(inX, inY, b.aim) / 20);
    const step = 1.2 / r2;
    for (let a = 0; a < Math.PI * 2; a += step) {
      const dx = Math.cos(a), dy = Math.sin(a);
      const x = Math.round(corner.x + dx * r2), y = Math.round(corner.y + dy * r2);
      if (!inAir(x, y) || (below ? y >= SLAB[1] : y < SLAB[1] + SLAB[3])) continue;
      if (entersRect(b.x, b.y, x + 0.5, y + 0.5, SLAB) === null) continue; // the first ring already covers it
      const bend = Math.acos(Math.max(-1, Math.min(1, (inX * dx + inY * dy) / inLen)));
      ringPx.push(x, y, base * 10 ** (-(BEND_LOSS * bend) / Math.PI / 20));
    }
  }

  function flushRings(ctx, color) {
    ctx.fillStyle = SHADOW;
    for (let i = 0; i < ringPx.length; i += 3) {
      ctx.globalAlpha = ringPx[i + 2] * 0.8;
      ctx.fillRect(ringPx[i], ringPx[i + 1] + 1, 1, 1);
    }
    ctx.fillStyle = color;
    for (let i = 0; i < ringPx.length; i += 3) {
      ctx.globalAlpha = ringPx[i + 2];
      ctx.fillRect(ringPx[i], ringPx[i + 1], 1, 1);
    }
    ctx.globalAlpha = 1;
    ringPx.length = 0;
  }

  function drawSound(ctx, t) {
    const s = sound();
    const color = COLORS.sound;

    // When the other one starts calling, clear the air and start afresh
    const source = Characters.distancePair().join(':') + ':' + Characters.viewer();
    if (source !== speaker) {
      speaker = source;
      bursts = [];
      lastBurst = -Infinity;
    }
    // A fresh bunch of three rings every so often, from wherever the speaker is now
    if (t - lastBurst >= WAVE_EVERY) {
      bursts.push({ x: s.mouth.x, y: s.mouth.y, aim: s.aim, t0: t });
      lastBurst = t;
    }
    bursts = bursts.filter(b => (t - b.t0) * WAVE_SPEED - 2 * WAVE_GAP < WAVE_REACH);
    for (const b of bursts) {
      for (let j = 0; j < 3; j++) {
        const r = (t - b.t0) * WAVE_SPEED - j * WAVE_GAP;
        if (r < 3) continue;
        addRing(b, r);
        addBentRing(b, r);
      }
    }
    flushRings(ctx, color);

    // The routes the voice takes, bolder for the ones carrying more of it
    for (const route of s.routes) {
      ctx.globalAlpha = 0.25 + 0.75 * (route.intensity / s.total);
      let phase = 0;
      for (let i = 1; i < route.pts.length; i++) phase = dashedLine(ctx, route.pts[i - 1], route.pts[i], color, t, phase);
    }
    ctx.globalAlpha = 1;
    endpoint(ctx, s.mouth, color, true);
    endpoint(ctx, s.ear, color, true);

    // The tag goes halfway along the route carrying most of the sound
    const main = s.routes.reduce((a, b) => (b.intensity > a.intensity ? b : a));
    label(ctx, `${s.distance.toFixed(1)} m`, pointAlong(main.pts, pathLength(main.pts) / 2), color);
  }

  // Called each frame in world coordinates, after the characters
  function draw(ctx, t) {
    if (active.sound) drawSound(ctx, t);
    else bursts = [];
    if (active.travel) drawTravel(ctx, t);
    if (active.visual) drawVisual(ctx, t);
    if (active.physical) drawPhysical(ctx, t);
  }

  function soundReadout() {
    const s = sound();
    const drop = Math.round(s.drop);
    return `${s.distance.toFixed(1)} m (${drop >= 0 ? '−' : '+'}${Math.abs(drop)} dB)`;
  }

  function visualReadout() {
    const v = sight();
    if (!v.kind) return 'No view';
    const m = `${(v.length / PX_PER_M).toFixed(1)} m`;
    return v.kind === 'mirror' ? `${m} (mirror)` : m;
  }

  // Text for the outputs sidebar
  const readouts = () => ({
    physical: `${physical().toFixed(1)} m`,
    travel: `${travel().toFixed(1)} m`,
    visual: visualReadout(),
    sound: soundReadout(),
  });

  return { active, draw, readouts };
})();
