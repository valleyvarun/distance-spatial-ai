// Mom and the boy. Click one to select them, then click a floor (or hold
// the arrow keys / WASD) to walk them around the house. Near the dinner
// table, clicking a chair makes them walk over and sit down.
const Characters = (() => {
  // ---- Where people can walk -------------------------------------------
  // Step off to the floor between the mirror and stairs, then forward
  // into the room. The connector follows that bend instead of hanging
  // directly below the raised stair edge.
  // The remaining stairs retain their original one-to-one slope.
  // The two floors are one storey (78 px = 3 m) apart, the same as the
  // floor slabs in the drawing, so the stairs climb exactly 3 m.
  const STOREY = 78;
  const GROUND_Y = 184, UPPER_Y = GROUND_Y - STOREY;
  const FOOT = 119, TOP = 185;
  const ENTRY_X = 108, LANDING_Y = 178, STAIR_FOOT_Y = 172;
  const FLOOR_DEPTH = GROUND_Y - LANDING_Y;
  const LANDING_DEPTH = FLOOR_DEPTH + Math.hypot(FOOT - ENTRY_X, LANDING_Y - STAIR_FOOT_Y);
  const ENTRY_REGION = { x0: 101, x1: 160 };
  function landingPoint(depth) {
    if (depth <= FLOOR_DEPTH) return { x: ENTRY_X, y: GROUND_Y - depth };
    const progress = (depth - FLOOR_DEPTH) / (LANDING_DEPTH - FLOOR_DEPTH);
    return { x: ENTRY_X + (FOOT - ENTRY_X) * progress, y: LANDING_Y + (STAIR_FOOT_Y - LANDING_Y) * progress };
  }
  const landingGoal = depth => ({ path: 'landing', x: landingPoint(depth).x, depth });
  const PATHS = {
    ground: { x0: 101, x1: 358, y: () => GROUND_Y },
    landing: { x0: ENTRY_X, x1: FOOT, y: () => LANDING_Y },
    stairs: { x0: FOOT, x1: TOP, y: x => STAIR_FOOT_Y - (x - FOOT) },
    upper: { x0: TOP, x1: 358, y: () => UPPER_Y },
  };
  const ORDER = ['ground', 'landing', 'stairs', 'upper'];
  const EXIT = {
    'ground>landing': { x: ENTRY_X }, 'landing>ground': { x: ENTRY_X, depth: 0 },
    'landing>stairs': { x: FOOT, depth: LANDING_DEPTH }, 'stairs>landing': { x: FOOT },
    'stairs>upper': { x: TOP }, 'upper>stairs': { x: TOP },
  };

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
      neck: { front: [8.5, 16], side: [10.5, 16], cushion: [11.5, 15] },
      eye: { front: [8.5, 10], side: [11.5, 10], cushion: [11.5, 9] },
      mouth: { front: [8.5, 13], side: [14.5, 13], cushion: [11.5, 12] },
      ear: { front: [8.5, 11], side: [6.5, 11], cushion: [11.5, 10] },
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
  const cat = {
    name: 'Bollu', path: 'ground', x: House.LAYOUT.cat.x, speed: 38, state: 'sleep', seat: null,
    sitSide: Sprites.catSitSide, sitFront: Sprites.catSitFront,
  };
  const characters = [...people, cat];
  const charactersById = { mom, boy, cat };
  const DISTANCE_PAIRS = { 'mom-boy': ['mom', 'boy'], 'boy-cat': ['boy', 'cat'], 'cat-mom': ['cat', 'mom'] };
  let pair = DISTANCE_PAIRS['mom-boy'];
  const distancePair = () => [...pair];
  function setDistancePair(value) {
    if (DISTANCE_PAIRS[value]) pair = DISTANCE_PAIRS[value];
  }
  for (const c of characters) {
    Object.assign(c, { depth: 0, facing: 1, dist: 0, route: [], goal: null, pendingSeat: null, byKeys: false, nextBlink: 1 + Math.random() * 3, blinkUntil: 0 });
  }

  let selected = null;
  let won = false, winListener = null;
  const onWin = fn => { winListener = fn; };
  const REQUIRED_OBJECTIVES = ['mom-game', 'cat-game', 'cat-table', 'mom-cat', 'dinner'];
  const completedObjectives = new Set();
  let objectiveListener = null;
  const onObjective = fn => { objectiveListener = fn; };
  function completeObjective(id) {
    if (completedObjectives.has(id)) return;
    completedObjectives.add(id);
    if (objectiveListener) objectiveListener(id);
  }
  let hasMoved = false, firstMoveListener = null;
  const onFirstMove = fn => { firstMoveListener = fn; };
  let canvas, t = 0;
  const keys = { left: false, right: false, up: false, down: false };

  const ARROW = Px.sprite(['kkkkkkk', 'kyyyyyk', '.kyyyk.', '..kyk..', '...k...'], { k: '#2b1d2e', y: '#ffd23f' }, 7);

  const pathPoint = p => p.path === 'landing' ? landingPoint(p.depth ?? 0) : { x: p.x, y: PATHS[p.path].y(p.x) };
  const footY = c => Math.round(pathPoint(c).y);

  // ---- Routing ----------------------------------------------------------
  // Walk to the end of each path in turn until we're on the goal's path.
  function route(c, goal) {
    const steps = [];
    let i = ORDER.indexOf(c.path);
    const j = ORDER.indexOf(goal.path);
    while (i !== j) {
      const next = i + Math.sign(j - i);
      steps.push({ path: ORDER[i], ...EXIT[`${ORDER[i]}>${ORDER[next]}`] });
      i = next;
    }
    steps.push(goal);
    return steps;
  }

  // Turn a click in the scene into a spot on the walkable paths
  function floorAt(px, py) {
    if (px < 92 || px > 368 || py < 36 || py > 192) return null;
    const clamp = (p, x) => ({ path: p, x: Math.max(PATHS[p].x0, Math.min(PATHS[p].x1, x)) });
    if (px >= 101 && px < FOOT && py >= 174 && py < GROUND_Y - 2) {
      return landingGoal(Math.min(FLOOR_DEPTH, GROUND_Y - py));
    }
    const stairY = PATHS.stairs.y(px);
    if (px >= FOOT - 4 && px <= TOP + 2 && py > stairY - 30 && py < stairY + 8) return clamp('stairs', px);
    if (px >= 186 && py < 111) return clamp('upper', px);
    if (py >= 111) return clamp('ground', px);
    return clamp('stairs', (px - py + STAIR_FOOT_Y + FOOT) / 2);
  }

  function chairAt(px, py) {
    return CHAIRS.find(({ hit: h }) => px >= h.x && px < h.x + h.w && py >= h.y && py < h.y + h.h);
  }

  // Where the held keys want the selected character to go
  function keyGoal(c) {
    if (c === cat && catAtTable()) return null;
    const h = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const v = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (!h && !v) return null;
    if (c.path === 'ground') {
      if (v < 0 && c.x >= ENTRY_REGION.x0 && c.x <= ENTRY_REGION.x1) return landingGoal(FLOOR_DEPTH);
      return h ? { path: 'ground', x: h < 0 ? PATHS.ground.x0 : PATHS.ground.x1 } : null;
    }
    if (c.path === 'landing') {
      if (v > 0) return { path: 'ground', x: ENTRY_X };
      if (v < 0) return { path: 'stairs', x: TOP };
      // A sideways command naturally steps forward before crossing the room.
      if (h) return { path: 'ground', x: h < 0 ? PATHS.ground.x0 : PATHS.ground.x1 };
      return null;
    }
    if (c.path === 'stairs') {
      if (h > 0) return { path: 'upper', x: PATHS.upper.x1 };
      if (h < 0 || v > 0) return landingGoal(FLOOR_DEPTH);
      return { path: 'stairs', x: TOP };
    }
    if (h < 0 || (v > 0 && Math.abs(c.x - TOP) < 10)) return landingGoal(FLOOR_DEPTH);
    return h > 0 ? { path: 'upper', x: PATHS.upper.x1 } : null;
  }

  // ---- Sitting ----------------------------------------------------------
  const catAtTable = () => CHAIRS.includes(cat.seat);
  const nearTable = c => (c.seat && c.seat !== CUSHION) ||
    (c.path === 'ground' && c.x >= TABLE_ZONE.x0 && c.x <= TABLE_ZONE.x1);
  const takenBy = (chair, c) => characters.find(o => o !== c && (o.seat === chair || o.pendingSeat === chair));
  let dialogueListener = null;
  const onDialogue = fn => { dialogueListener = fn; };
  const say = (who, line) => { if (dialogueListener) dialogueListener(who, line); };
  const idOf = c => c === mom ? 'mom' : c === boy ? 'boy' : 'cat';

  function sit(c, seat) {
    if (seat === CUSHION) {
      const previous = characters.find(other => other !== c && other.seat === CUSHION);
      if (previous) {
        standUp(previous);
        previous.x = CUSHION.x - 25;
        previous.route = [];
        previous.goal = null;
        previous.pendingSeat = null;
        previous.byKeys = false;
        say(idOf(previous), previous === cat ? 'meow, meow' : 'heyy!!');
      }
    }
    c.seat = seat;
    c.state = 'sit';
    c.x = seat.x;
    c.pendingSeat = null;
    c.route = [];
    c.goal = null;
    c.byKeys = false;
    if (c === cat && catAtTable() && selected === cat) {
      select(null);
      for (const key in keys) keys[key] = false;
    }
    if (seat === CUSHION && c === mom) completeObjective('mom-game');
    if (seat === CUSHION && c === cat) completeObjective('cat-game');
    if (CHAIRS.includes(seat) && c === cat) completeObjective('cat-table');
    if (c === cat && CHAIRS.includes(seat)) say('mom', 'This food is not for you, Bollu!');
  }

  function checkWin() {
    if (won) return;
    const atDinner = !CHAIRS.includes(cat.seat) &&
      people.every(person => person.state === 'sit' && CHAIRS.includes(person.seat));
    if (!atDinner) return;
    // Dinner can be achieved early, but victory also requires every other
    // objective and this dinner arrangement to be true right now.
    completeObjective('dinner');
    if (REQUIRED_OBJECTIVES.every(id => completedObjectives.has(id))) {
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
    if (c === cat && c.state === 'sleep') c.state = 'idle';
    c.route = route(c, goal);
    c.goal = goal;
    c.pendingSeat = seat;
    c.byKeys = false;
    if (seat && c.path === goal.path && Math.abs(c.x - goal.x) < 0.5) sit(c, seat);
  }

  const momNearCat = () => mom.path === 'ground' && cat.path === 'ground' &&
    Math.abs(mom.x - cat.x) <= 0.6 * STOREY / 3;

  let shooStarted = -Infinity;
  const SHOO_DURATION = 0.85;
  const momShooing = () => t - shooStarted < SHOO_DURATION;

  function shooCat() {
    const wasAtTable = CHAIRS.includes(cat.seat);
    if (selected === cat) {
      select(null);
      for (const k in keys) keys[k] = false;
    }
    const destination = cat.x < (TABLE_ZONE.x0 + TABLE_ZONE.x1) / 2 ? 135 : 335;
    standUp(mom);
    mom.facing = destination < mom.x ? -1 : 1;
    shooStarted = t;
    walkTo(cat, { path: 'ground', x: destination });
    if (wasAtTable) completeObjective('mom-cat');
  }

  // ---- Movement ---------------------------------------------------------
  function advance(c, dt) {
    while (c.route.length) {
      const wp = c.route[0];
      if (wp.path === 'landing' && c.path !== 'landing') {
        c.depth = c.path === 'stairs' ? LANDING_DEPTH : 0;
      }
      c.path = wp.path;
      const inDepth = c.path === 'landing';
      const delta = inDepth ? (wp.depth ?? 0) - c.depth : wp.x - c.x;
      if (Math.abs(delta) < 0.01) {
        if (inDepth) {
          c.depth = wp.depth ?? 0;
          c.x = landingPoint(c.depth).x;
        } else c.x = wp.x;
        c.route.shift();
        continue;
      }
      const onStairs = c.path === 'stairs';
      const move = Math.sign(delta) * Math.min(Math.abs(delta), c.speed * (onStairs ? STAIR_PACE : 1) * dt);
      if (inDepth) {
        c.depth += move;
        c.x = landingPoint(c.depth).x;
        c.depthDirection = Math.sign(move);
        if (c.depth > FLOOR_DEPTH) c.facing = c.depthDirection;
      }
      else c.x += move;
      if (move !== 0 && !hasMoved) {
        hasMoved = true;
        if (firstMoveListener) firstMoveListener();
      }
      if (!inDepth) c.facing = move > 0 ? 1 : -1;
      c.dist += Math.abs(move) * (onStairs ? Math.SQRT2 : 1);
      return true;
    }
    return false;
  }

  function arrive(c) {
    const headingToGame = c.goal?.path === 'upper' && Math.abs(c.goal.x - CUSHION.x) < 6;
    c.state = 'idle';
    c.dist = 0;
    c.goal = null;
    if (c.pendingSeat) {
      const seat = c.pendingSeat;
      c.pendingSeat = null;
      if (seat === CUSHION || !takenBy(seat, c)) sit(c, seat); // the gaming spot can be taken over
    } else if (headingToGame && c.path === 'upper' && Math.abs(c.x - CUSHION.x) < 6) {
      sit(c, CUSHION); // back at the TV: sit down and keep playing
    }
  }

  function update(dt, time) {
    t = time;
    if (won) return;
    for (const c of characters) {
      // Pause Mom briefly for the gesture, then resume her normal movement.
      if (c === mom && momShooing()) continue;
      // Finish the short step off/on the stairs even if the key is released
      // or another character is selected. Never leave someone mid-step.
      const leavingStairs = c.byKeys && c.path === 'stairs' && c.x <= FOOT + 0.01 && c.facing < 0;
      const finishingStep = c.byKeys && c.path === 'landing' && c.depth > FLOOR_DEPTH;
      const goal = leavingStairs ? landingGoal(FLOOR_DEPTH) : finishingStep
        ? (c.depthDirection < 0 ? landingGoal(FLOOR_DEPTH) : { path: 'stairs', x: FOOT })
        : c === selected ? keyGoal(c) : null;
      if (goal) {
        const guideToEntrance = c.path === 'ground' && goal.path === 'landing';
        standUp(c);
        if (c === cat && c.state === 'sleep') c.state = 'idle';
        c.route = route(c, goal);
        c.goal = null;
        c.pendingSeat = null;
        // A tap on Up in the entrance region guides the character all the
        // way to the safe floor spot; holding Up continues onto the stairs.
        c.byKeys = !guideToEntrance;
      } else if (c.byKeys) {
        c.route = [];
        c.byKeys = false;
      }

      const oldX = c.x, oldPath = c.path;
      if (advance(c, dt)) {
        c.state = 'walk';
        // Entering the gaming spot takes it over. Starting at its centre
        // and walking away must not immediately seat the character again.
        if (c.byKeys && oldPath === 'upper' && c.path === 'upper' &&
            (oldX - CUSHION.x) * (c.x - CUSHION.x) <= 0 && oldX !== CUSHION.x) {
          sit(c, CUSHION);
          for (const k in keys) keys[k] = false;
        }
      }
      else if (c.state === 'walk') arrive(c);

      if (t > c.nextBlink) {
        c.blinkUntil = t + 0.14;
        c.nextBlink = t + 2.2 + Math.random() * 3;
      }
    }
    if (CHAIRS.includes(cat.seat) && momNearCat()) shooCat();
    // Settle back onto the mat only after stopping, not while passing it.
    if (cat.state === 'idle' && !cat.route.length && !cat.seat &&
        cat.path === 'ground' && Math.abs(cat.x - House.LAYOUT.cat.x) <= 8) {
      cat.x = House.LAYOUT.cat.x;
      cat.state = 'sleep';
      cat.goal = null;
    }
    // Check after everyone moves, including when Bollu leaves a dining chair.
    checkWin();
  }

  // ---- Drawing ----------------------------------------------------------
  // The sprite to show and where its top-left corner goes
  function look(c) {
    const blink = t < c.blinkUntil ? 1 : 0;
    const seat = c.seat;
    if (c === mom && momShooing()) {
      const beat = Math.min(4, Math.floor((t - shooStarted) / 0.15));
      const img = Sprites.momShoo[c.facing > 0 ? 'right' : 'left'][[0, 1, 0, 1, 2][beat]];
      return { img, x: Math.round(c.x - 8) - (c.facing < 0 ? 12 : 0), y: footY(c) - img.height };
    }
    if ((c === cat || c === mom) && seat === CUSHION) {
      const frames = c === mom ? Sprites.momGame : Sprites.catGame;
      const img = frames[Math.floor(t * (c === mom ? 6 : 7)) % frames.length];
      return { img, x: Math.round(c.x - img.width / 2), y: UPPER_Y - 2 - img.height };
    }
    if (seat && seat.pose === 'front') {
      const img = c.sitFront.frames[blink];
      return { img, x: Math.round(seat.x - img.width / 2), y: TABLE_TOP - c.sitFront.above };
    }
    if (seat && seat.pose === 'side') {
      const img = c.sitSide[seat.facing > 0 ? 'right' : 'left'];
      return { img, x: seat.facing > 0 ? seat.back - 1 : seat.back - img.width + 2, y: SIDE_SEAT_Y - c.sitSide.seatRow };
    }
    const img = c.state === 'walk' && c.path !== 'landing'
      ? c.walk[c.facing > 0 ? 'right' : 'left'][Math.floor(c.dist / STEP_PX) % 4]
      : c.idle[blink];
    return { img, x: Math.round(c.x - img.width / 2), y: footY(c) - img.height };
  }

  // Scene-space rectangle the character occupies (used for clicks too)
  function bounds(c) {
    if (c === mom && momShooing()) {
      // Keep the selection arrow and speech anchored to her body, not her hand.
      return { x: Math.round(c.x - 8), y: footY(c) - Sprites.momShoo.right[0].height, w: 16, h: Sprites.momShoo.right[0].height };
    }
    if ((c === cat && c.seat) || (c === mom && c.seat === CUSHION)) {
      const { img, x, y } = look(c);
      return { x, y, w: img.width, h: img.height };
    }
    if (c.seat === CUSHION) return { x: Math.round(c.x) - 10, y: CUSHION.top, w: 20, h: 26 };
    if (c === cat) return { x: Math.round(c.x) - 10, y: footY(c) - 17, w: 21, h: 17 };
    const { img, x, y } = look(c);
    return { x, y, w: img.width, h: img.height };
  }

  let drawCat;
  function drawPerson(ctx, c) {
    if (c === cat) {
      if (c.seat) {
        const { img, x, y } = look(c);
        ctx.drawImage(img, x, y);
        return;
      }
      return drawCat(ctx, Math.round(c.x), footY(c) - 3, t, c.state, c.facing, c.dist);
    }
    if (c.seat === CUSHION) {
      // Head bobs to the music, elbows mash buttons
      const b = bounds(c);
      if (c === boy) {
        ctx.drawImage(Sprites.boyBody[Math.floor(t * 7) % 2], b.x, b.y + 14);
        ctx.drawImage(Sprites.boyHead, b.x, b.y + Math.floor(t * 2.4) % 2);
      } else {
        const { img, x, y } = look(c);
        ctx.drawImage(img, x, y);
      }
      return;
    }
    const { img, x, y } = look(c);
    ctx.drawImage(img, x, y);
  }

  function drawGoal(ctx, c) {
    const point = pathPoint(c.goal);
    const x = Math.round(point.x), y = Math.round(point.y);
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
  function draw(ctx, tableOverlay, catRenderer) {
    drawCat = catRenderer;
    if (selected && selected.goal) drawGoal(ctx, selected);
    const atTable = characters.filter(c => c.seat && c.seat !== CUSHION);
    for (const c of atTable) drawPerson(ctx, c);
    if (atTable.length) ctx.drawImage(tableOverlay, 0, 0);
    const rest = characters.filter(c => !atTable.includes(c) && c !== selected);
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
    const order = characters.filter(c => c !== selected);
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
    if (c === cat && catAtTable()) return;
    selected = c;
    if (selectListener) selectListener(c ? idOf(c) : null);
  }

  function onPointerDown(e) {
    if (won) return;
    const [px, py] = scenePoint(e);
    const chair = chairAt(px, py);
    const hit = personAt(px, py);
    // Bollu stays put until Mom sends him away; clicks cannot select him
    // or pass through him to issue a floor/chair movement command.
    if (hit === cat && catAtTable()) return;
    // Switching characters always takes priority over destination actions,
    // including when the character being clicked is playing the game.
    if (hit && hit !== selected) return select(hit);
    // Shoo Bollu only when Mom is close and Bollu is at the table.
    if (hit === cat && nearTable(cat) && momNearCat()) {
      shooCat();
      return;
    }
    // Standing right in front of a chair shouldn't stop you clicking it
    const wantsChair = hit && hit === selected && chair && selected.seat !== chair;
    if (hit && !wantsChair) return select(hit === selected ? null : hit);
    if (!selected) return;

    // Click the TV itself to send the selected character to the gaming spot.
    const tv = House.LAYOUT.tvScreen;
    if (px >= tv.x && px < tv.x + tv.w && py >= tv.y && py < tv.y + tv.h) {
      return walkTo(selected, { path: 'upper', x: CUSHION.x }, CUSHION);
    }

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
    const hit = personAt(px, py);
    canvas.style.cursor = hit === cat && catAtTable() ? 'default'
      : hit || (selected && (chairAt(px, py) || floorAt(px, py))) ? 'pointer' : 'default';
  }

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  };

  function onKey(e) {
    if (won) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
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
  const boyAtTv = () => characters.some(c => c.seat === CUSHION);

  // Centre of a character's neck or eyes in world coordinates, whatever their pose
  const CAT_ANCHORS = {
    sleep: { neck: [5, 12], eye: [3, 9], mouth: [4, 11], ear: [6, 5] },
    side: { neck: [15, 9], eye: [18, 5], mouth: [19, 7], ear: [17, 2] },
    sitSide: { neck: [8, 8], eye: [11, 5], mouth: [13, 6], ear: [10, 2] },
    front: { neck: [8, 10], eye: [8, 6], mouth: [8, 7], ear: [4, 2] },
    cushion: { neck: [10, 10], eye: [10, 7], mouth: [10, 9], ear: [5, 3] },
  };
  function anchorOf(c, part) {
    const b = bounds(c);
    if (c === cat) {
      const pose = c.seat === CUSHION ? 'cushion' : c.seat?.pose === 'front' ? 'front'
        : c.seat?.pose === 'side' ? 'sitSide' : c.state === 'sleep' ? 'sleep' : 'side';
      const [x, y] = CAT_ANCHORS[pose][part];
      const left = (pose === 'side' && c.facing < 0) || (pose === 'sitSide' && c.seat.facing < 0);
      return { x: b.x + (left ? b.w - 1 - x : x) + 0.5, y: b.y + y + 0.5 };
    }
    const a = c.anchors[part];
    if (c.seat === CUSHION) {
      const point = a.cushion || a.front;
      return { x: b.x + point[0] + 0.5, y: b.y + point[1] + 0.5 };
    }
    const sideOn = (c === mom && momShooing()) || (c.state === 'walk' && c.path !== 'landing') || (c.seat && c.seat.pose === 'side');
    const [nx, ny] = sideOn ? a.side : a.front;
    const facingLeft = sideOn && (c.seat ? c.seat.facing < 0 : c.facing < 0);
    return { x: b.x + (facingLeft ? b.w - 1 - nx : nx) + 0.5, y: b.y + ny + 0.5 };
  }

  const necks = () => Object.fromEntries(pair.map(id => [id, anchorOf(charactersById[id], 'neck')]));
  const eyes = () => Object.fromEntries(pair.map(id => [id, anchorOf(charactersById[id], 'eye')]));

  // A character as seen in a vertical mirror at x = mirrorX:
  // flipped across it
  function drawReflection(ctx, who, mirrorX, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(2 * mirrorX, 0);
    ctx.scale(-1, 1);
    drawPerson(ctx, charactersById[who]);
    ctx.restore();
  }

  // Use the selected character's perspective only when they belong to the pair.
  const viewer = () => selected && pair.includes(idOf(selected)) ? idOf(selected) : pair[0];

  // Top-centre of someone's head ('mom' or 'boy'), in world coordinates
  function headTop(who) {
    const b = bounds(who === 'mom' ? mom : who === 'cat' ? cat : boy);
    return { x: b.x + b.w / 2, y: b.y };
  }

  // The active pair's speaker and listener, using the same perspective as sight.
  function voice() {
    const who = viewer();
    const speaker = charactersById[who], listener = charactersById[pair.find(id => id !== who)];
    return { mouth: anchorOf(speaker, 'mouth'), ear: anchorOf(listener, 'ear') };
  }

  // The walking route between the pair — along the floors and up or down the
  // stairs — as a list of points on the walking line. Someone sitting
  // starts from where they'd stand up.
  function travelPath() {
    const at = c => ({ path: c.path, x: c.x, depth: c.depth });
    const [from, to] = pair.map(id => charactersById[id]);
    return [at(from), ...route(from, at(to))].map(pathPoint);
  }

  const catSleeping = () => cat.state === 'sleep';
  return { STOREY, init, update, draw, catSleeping, onSelect, onDialogue, onWin, onFirstMove, onObjective, boyAtTv, distancePair, setDistancePair, necks, eyes, headTop, travelPath, drawReflection, viewer, voice };
})();
