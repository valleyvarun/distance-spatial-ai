// Mom and the boy. Click one to select them, then click a floor (or hold
// the arrow keys / WASD) to walk them around the house. Near the dinner
// table, clicking a chair makes them walk over and sit down.
const Characters = (() => {
  // ---- Where people can walk -------------------------------------------
  // Three straight paths joined end to end, each measured by x: the ground
  // floor, the staircase (rises one pixel per pixel) and the upstairs floor.
  // The two floors are one storey (78 px = 3 m) apart, the same as the
  // floor slabs in the drawing, so the stairs climb exactly 3 m.
  const STOREY = 78;
  const GROUND_Y = 184, UPPER_Y = GROUND_Y - STOREY;
  const FOOT = 107, TOP = FOOT + STOREY; // where the stairs meet each floor
  const PATHS = {
    ground: { x0: 101, x1: 358, y: () => GROUND_Y },
    stairs: { x0: FOOT, x1: TOP, y: x => GROUND_Y - (x - FOOT) },
    upper: { x0: TOP, x1: 358, y: () => UPPER_Y },
  };
  const ORDER = ['ground', 'stairs', 'upper'];
  const EXIT = { 'ground>stairs': FOOT, 'stairs>ground': FOOT, 'stairs>upper': TOP, 'upper>stairs': TOP };

  const STEP_PX = 4;       // distance walked per animation frame
  const STAIR_PACE = 0.55; // horizontal speed on the stairs vs. the flat

  // ---- Seats -----------------------------------------------------------
  const CUSHION = { x: 318, top: 78 };   // the boy's gaming spot in front of the TV
  const TABLE_ZONE = { x0: 150, x1: 320 }; // close enough to the table to sit down
  const TABLE_TOP = 165;                  // top edge of the tablecloth
  const SIDE_SEAT_Y = 173;                // row the end chairs' sitters rest on

  // Four chairs round the dinner table. `x` is where you stand to sit down,
  // `back` is the inner edge of a side chair's backrest, `hit` is clickable.
  const CHAIRS = [
    { x: 190, pose: 'side', facing: 1, back: 186, hit: { x: 181, y: 155, w: 17, h: 29 } },
    { x: 214, pose: 'front', hit: { x: 207, y: 152, w: 14, h: 14 } },
    { x: 242, pose: 'front', hit: { x: 235, y: 152, w: 14, h: 14 } },
    { x: 266, pose: 'side', facing: -1, back: 270, hit: { x: 259, y: 155, w: 17, h: 29 } },
  ];

  // `anchors` say where the neck and eyes sit within each kind of sprite,
  // in sprite pixels: facing us, side-on (drawn facing right), and — for
  // the boy — sitting on his cushion with his back to us
  const mom = {
    name: 'Mom', path: 'ground', x: 292, speed: 30, state: 'idle', seat: null,
    walk: Sprites.momWalk, idle: [Sprites.mom, Sprites.momBlink],
    sitSide: Sprites.momSitSide, sitFront: Sprites.momSitFront,
    anchors: {
      neck: { front: [8.5, 16], side: [10.5, 16] },
      eye: { front: [8.5, 10], side: [11.5, 10] },
      mouth: { front: [8.5, 13], side: [14.5, 13] },
      ear: { front: [8.5, 11], side: [6.5, 11] },
    },
  };
  const boy = {
    name: 'The boy', path: 'upper', x: CUSHION.x, speed: 34, state: 'sit', seat: CUSHION,
    walk: Sprites.boyWalk, idle: [Sprites.boyFront, Sprites.boyFrontBlink],
    sitSide: Sprites.boySitSide, sitFront: Sprites.boySitFront,
    anchors: {
      neck: { front: [7.5, 14], side: [8.5, 14], cushion: [9.5, 14] },
      eye: { front: [7.5, 9], side: [10.5, 9], cushion: [9.5, 9] },
      ear: { front: [7.5, 9], side: [5.5, 9.5], cushion: [9.5, 9.5] },
      mouth: { front: [7.5, 12], side: [12.5, 12], cushion: [9.5, 11] },
    },
  };
  const people = [mom, boy];
  for (const c of people) {
    Object.assign(c, { facing: 1, dist: 0, route: [], goal: null, pendingSeat: null, byKeys: false, nextBlink: 1 + Math.random() * 3, blinkUntil: 0 });
  }

  let selected = null;
  let won = false, winListener = null;
  const onWin = fn => { winListener = fn; };
  let hasMoved = false, firstMoveListener = null;
  const onFirstMove = fn => { firstMoveListener = fn; };
  let canvas, t = 0;
  const keys = { left: false, right: false, up: false, down: false };

  const ARROW = Px.sprite(['kkkkkkk', 'kyyyyyk', '.kyyyk.', '..kyk..', '...k...'], { k: '#2b1d2e', y: '#ffd23f' }, 7);

  const footY = c => Math.round(PATHS[c.path].y(c.x));

  // ---- Routing ----------------------------------------------------------
  // Walk to the end of each path in turn until we're on the goal's path.
  function route(c, goal) {
    const steps = [];
    let i = ORDER.indexOf(c.path);
    const j = ORDER.indexOf(goal.path);
    while (i !== j) {
      const next = i + Math.sign(j - i);
      steps.push({ path: ORDER[i], x: EXIT[`${ORDER[i]}>${ORDER[next]}`] });
      i = next;
    }
    steps.push(goal);
    return steps;
  }

  // Turn a click in the scene into a spot on the walkable paths
  function floorAt(px, py) {
    if (px < 92 || px > 368 || py < 36 || py > 192) return null;
    const clamp = (p, x) => ({ path: p, x: Math.max(PATHS[p].x0, Math.min(PATHS[p].x1, x)) });
    const stairY = PATHS.stairs.y(px);
    if (px >= FOOT - 4 && px <= TOP + 2 && py > stairY - 30 && py < stairY + 8) return clamp('stairs', px);
    if (px >= 186 && py < 111) return clamp('upper', px);
    if (py >= 111) return clamp('ground', px);
    return clamp('stairs', (px - py + GROUND_Y + FOOT) / 2); // stair hall wall: nearest point on the stairs
  }

  function chairAt(px, py) {
    return CHAIRS.find(({ hit: h }) => px >= h.x && px < h.x + h.w && py >= h.y && py < h.y + h.h);
  }

  // Where the held keys want the selected character to go
  function keyGoal(c) {
    const h = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const v = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (!h && !v) return null;
    if (c.path === 'ground') {
      if (v < 0 && Math.abs(c.x - FOOT) < 10) return { path: 'stairs', x: TOP };
      return h ? { path: 'ground', x: h < 0 ? PATHS.ground.x0 : PATHS.ground.x1 } : null;
    }
    if (c.path === 'stairs') {
      if (h > 0) return { path: 'upper', x: PATHS.upper.x1 };
      if (h < 0) return { path: 'ground', x: PATHS.ground.x0 };
      return { path: 'stairs', x: v < 0 ? TOP : FOOT };
    }
    if (h < 0 || (v > 0 && Math.abs(c.x - TOP) < 10)) return { path: 'stairs', x: FOOT };
    return h > 0 ? { path: 'upper', x: PATHS.upper.x1 } : null;
  }

  // ---- Sitting ----------------------------------------------------------
  const nearTable = c => (c.seat && c.seat !== CUSHION) ||
    (c.path === 'ground' && c.x >= TABLE_ZONE.x0 && c.x <= TABLE_ZONE.x1);
  const takenBy = (chair, c) => people.find(o => o !== c && (o.seat === chair || o.pendingSeat === chair));

  function sit(c, seat) {
    c.seat = seat;
    c.state = 'sit';
    c.x = seat.x;
    c.pendingSeat = null;
    c.route = [];
    c.goal = null;
    if (!won && people.every(person => person.state === 'sit' && CHAIRS.includes(person.seat))) {
      won = true;
      for (const k in keys) keys[k] = false;
      select(null);
      if (winListener) winListener();
    }
  }

  // Get up and stand where you'd step into the seat from
  function standUp(c) {
    if (!c.seat) return;
    c.path = c.seat === CUSHION ? 'upper' : 'ground';
    c.x = c.seat.x;
    c.seat = null;
    c.state = 'idle';
    c.dist = 0;
  }

  function walkTo(c, goal, seat = null) {
    standUp(c);
    c.route = route(c, goal);
    c.goal = goal;
    c.pendingSeat = seat;
    c.byKeys = false;
    if (seat && c.path === goal.path && Math.abs(c.x - goal.x) < 0.5) sit(c, seat);
  }

  // ---- Movement ---------------------------------------------------------
  function advance(c, dt) {
    while (c.route.length) {
      const wp = c.route[0];
      c.path = wp.path;
      if (Math.abs(wp.x - c.x) < 0.01) {
        c.x = wp.x;
        c.route.shift();
        continue;
      }
      const onStairs = c.path === 'stairs';
      const dx = wp.x - c.x;
      const move = Math.sign(dx) * Math.min(Math.abs(dx), c.speed * (onStairs ? STAIR_PACE : 1) * dt);
      c.x += move;
      if (move !== 0 && !hasMoved) {
        hasMoved = true;
        if (firstMoveListener) firstMoveListener();
      }
      c.facing = move > 0 ? 1 : -1;
      c.dist += Math.abs(move) * (onStairs ? Math.SQRT2 : 1);
      return true;
    }
    return false;
  }

  function arrive(c) {
    c.state = 'idle';
    c.dist = 0;
    c.goal = null;
    if (c.pendingSeat) {
      const seat = c.pendingSeat;
      c.pendingSeat = null;
      if (!takenBy(seat, c)) sit(c, seat); // unless someone got there first
    } else if (c === boy && c.path === 'upper' && Math.abs(c.x - CUSHION.x) < 6) {
      sit(c, CUSHION); // back at the TV: sit down and keep playing
    }
  }

  function update(dt, time) {
    t = time;
    if (won) return;
    for (const c of people) {
      const goal = c === selected ? keyGoal(c) : null;
      if (goal) {
        standUp(c);
        c.route = route(c, goal);
        c.goal = null;
        c.pendingSeat = null;
        c.byKeys = true;
      } else if (c.byKeys) {
        c.route = [];
        c.byKeys = false;
      }

      if (advance(c, dt)) c.state = 'walk';
      else if (c.state === 'walk') arrive(c);

      if (t > c.nextBlink) {
        c.blinkUntil = t + 0.14;
        c.nextBlink = t + 2.2 + Math.random() * 3;
      }
    }
  }

  // ---- Drawing ----------------------------------------------------------
  // The sprite to show and where its top-left corner goes
  function look(c) {
    const blink = t < c.blinkUntil ? 1 : 0;
    const seat = c.seat;
    if (seat && seat.pose === 'front') {
      const img = c.sitFront.frames[blink];
      return { img, x: Math.round(seat.x - img.width / 2), y: TABLE_TOP - c.sitFront.above };
    }
    if (seat && seat.pose === 'side') {
      const img = c.sitSide[seat.facing > 0 ? 'right' : 'left'];
      return { img, x: seat.facing > 0 ? seat.back - 1 : seat.back - img.width + 2, y: SIDE_SEAT_Y - c.sitSide.seatRow };
    }
    const img = c.state === 'walk'
      ? c.walk[c.facing > 0 ? 'right' : 'left'][Math.floor(c.dist / STEP_PX) % 4]
      : c.idle[blink];
    return { img, x: Math.round(c.x - img.width / 2), y: footY(c) - img.height };
  }

  // Scene-space rectangle the character occupies (used for clicks too)
  function bounds(c) {
    if (c.seat === CUSHION) return { x: Math.round(c.x) - 10, y: CUSHION.top, w: 20, h: 26 };
    const { img, x, y } = look(c);
    return { x, y, w: img.width, h: img.height };
  }

  function drawPerson(ctx, c) {
    if (c.seat === CUSHION) {
      // Head bobs to the music, elbows mash buttons
      const b = bounds(c);
      ctx.drawImage(Sprites.boyBody[Math.floor(t * 7) % 2], b.x, b.y + 14);
      ctx.drawImage(Sprites.boyHead, b.x, b.y + Math.floor(t * 2.4) % 2);
      return;
    }
    const { img, x, y } = look(c);
    ctx.drawImage(img, x, y);
  }

  function drawGoal(ctx, c) {
    const x = Math.round(c.goal.x), y = Math.round(PATHS[c.goal.path].y(c.goal.x));
    const r = 2 + (Math.floor(t * 6) % 3);
    ctx.globalAlpha = 0.9;
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      Px.dot(ctx, x + Math.round(Math.cos(ang) * r), y + Math.round(Math.sin(ang) * r * 0.4), '#ffd23f');
    }
    ctx.globalAlpha = 1;
  }

  // `tableOverlay` is the shaded table on its own, drawn back over anyone
  // sitting at it so their lap tucks in behind the tablecloth.
  function draw(ctx, tableOverlay) {
    if (selected && selected.goal) drawGoal(ctx, selected);
    const atTable = people.filter(c => c.seat && c.seat !== CUSHION);
    for (const c of atTable) drawPerson(ctx, c);
    if (atTable.length) ctx.drawImage(tableOverlay, 0, 0);
    const rest = people.filter(c => !atTable.includes(c) && c !== selected);
    if (selected && !atTable.includes(selected)) rest.push(selected);
    for (const c of rest) drawPerson(ctx, c);

    if (selected) {
      const b = bounds(selected);
      const bounce = Math.round(Math.sin(t * 6) * 1.5);
      ctx.drawImage(ARROW, Math.round(b.x + b.w / 2 - 3), b.y - 8 + bounce);
    }
  }

  // ---- Input ------------------------------------------------------------
  // Mouse position in world coordinates (the view shows background around the world)
  function scenePoint(e) {
    const r = canvas.getBoundingClientRect();
    return [
      ((e.clientX - r.left) * View.w) / r.width - View.ox,
      ((e.clientY - r.top) * View.h) / r.height - View.oy,
    ];
  }

  function personAt(px, py) {
    const order = people.filter(c => c !== selected);
    if (selected) order.push(selected);
    for (const c of order.reverse()) {
      const b = bounds(c);
      if (px >= b.x - 2 && px < b.x + b.w + 2 && py >= b.y - 2 && py < b.y + b.h + 2) return c;
    }
    return null;
  }

  let selectListener = null;
  const onSelect = fn => { selectListener = fn; };

  function select(c) {
    selected = c;
    if (selectListener) selectListener(c === mom ? 'mom' : c === boy ? 'boy' : null);
  }

  function onPointerDown(e) {
    if (won) return;
    const [px, py] = scenePoint(e);
    const chair = chairAt(px, py);
    const hit = personAt(px, py);
    // Standing right in front of a chair shouldn't stop you clicking it
    const wantsChair = hit === selected && chair && selected.seat !== chair;
    if (hit && !wantsChair) return select(hit === selected ? null : hit);
    if (!selected) return;

    // A free chair: sit if close to the table, otherwise just walk over
    if (chair && selected.seat !== chair) {
      if (takenBy(chair, selected)) return;
      if (nearTable(selected)) return walkTo(selected, { path: 'ground', x: chair.x }, chair);
    }

    const goal = floorAt(px, py);
    if (!goal) return select(null);
    walkTo(selected, goal);
  }

  function onPointerMove(e) {
    if (won) return;
    const [px, py] = scenePoint(e);
    canvas.style.cursor = personAt(px, py) || (selected && (chairAt(px, py) || floorAt(px, py))) ? 'pointer' : 'default';
  }

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  };

  function onKey(e) {
    if (won) return;
    if (e.target instanceof HTMLInputElement) return; // e.g. the volume slider
    if (e.code === 'Escape' && e.type === 'keydown') return select(null);
    const k = KEYMAP[e.code];
    if (!k) return;
    keys[k] = e.type === 'keydown';
    if (selected) e.preventDefault();
  }

  function init(canvasEl) {
    canvas = canvasEl;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  }

  // The TV and speakers only run while the boy is on his cushion
  const boyAtTv = () => boy.seat === CUSHION;

  // Centre of a character's neck or eyes in world coordinates, whatever their pose
  function anchorOf(c, part) {
    const b = bounds(c), a = c.anchors[part];
    if (c.seat === CUSHION) return { x: b.x + a.cushion[0] + 0.5, y: b.y + a.cushion[1] + 0.5 };
    const sideOn = c.state === 'walk' || (c.seat && c.seat.pose === 'side');
    const [nx, ny] = sideOn ? a.side : a.front;
    const facingLeft = sideOn && (c.seat ? c.seat.facing < 0 : c.facing < 0);
    return { x: b.x + (facingLeft ? b.w - 1 - nx : nx) + 0.5, y: b.y + ny + 0.5 };
  }

  const necks = () => ({ mom: anchorOf(mom, 'neck'), boy: anchorOf(boy, 'neck') });
  const eyes = () => ({ mom: anchorOf(mom, 'eye'), boy: anchorOf(boy, 'eye') });

  // Someone ('mom' or 'boy') as seen in a vertical mirror at x = mirrorX:
  // flipped across it
  function drawReflection(ctx, who, mirrorX, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(2 * mirrorX, 0);
    ctx.scale(-1, 1);
    drawPerson(ctx, who === 'mom' ? mom : boy);
    ctx.restore();
  }

  // Whose point of view to show: the boy's when he's selected, else Mom's
  const viewer = () => (selected === boy ? 'boy' : 'mom');

  // Top-centre of someone's head ('mom' or 'boy'), in world coordinates
  function headTop(who) {
    const b = bounds(who === 'mom' ? mom : boy);
    return { x: b.x + b.w / 2, y: b.y };
  }

  // One calling the other: the speaker's mouth and the listener's ear. Mom
  // calls the boy — unless he's selected, then he's the one calling.
  function voice() {
    const [speaker, listener] = selected === boy ? [boy, mom] : [mom, boy];
    return { mouth: anchorOf(speaker, 'mouth'), ear: anchorOf(listener, 'ear') };
  }

  // The way Mom would walk to the boy — along the floors and up or down the
  // stairs — as a list of points on the walking line. Someone sitting
  // starts from where they'd stand up.
  function travelPath() {
    const at = c => ({ path: c.path, x: c.x });
    return [at(mom), ...route(mom, at(boy))].map(p => ({ x: p.x, y: PATHS[p.path].y(p.x) }));
  }

  return { STOREY, init, update, draw, onSelect, onWin, onFirstMove, boyAtTv, necks, eyes, headTop, travelPath, drawReflection, viewer, voice };
})();
