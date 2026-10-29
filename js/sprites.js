// Character sprites as text maps: one character per pixel, '.' is empty.
// Rows shorter than the sprite width are left halves and get mirrored.
const Sprites = (() => {
  // ---- Mom: standing, facing us, apron on -------------------------------
  const MOM_PALETTE = {
    k: '#2b1d2e', // outline
    h: '#8a4a2e', H: '#c0703f', d: '#5e2e1e', // hair
    s: '#ffdcc0', S: '#f2b896', // skin
    e: '#5a3a9a', w: '#ffffff', m: '#d0505e', b: '#ff9eae', // face
    p: '#ff8fb8', P: '#e06a98', // blouse
    a: '#fff6e0', A: '#ecd9b0', r: '#ff5e6c', // apron
    l: '#8f7ae6', L: '#6a56c4', // skirt
    f: '#ff5e6c', F: '#c0404c', // slippers (near / far foot)
  };

  const MOM = [
    '......kkk',
    '....kkhhH',
    '...khhhHH',
    '..khhHHhhhhHHhrk..', // hair clip
    '.khhhhhhhhhhhhrhk.',
    '.khhhhhhh',
    '.khhhshhh',
    '.khhssssh',
    '.khhsssss',
    '.khhskkss', // lashes
    '.khhswessssweshhk.', // eyes with highlights
    '.khhseess',
    '.khhbbsss', // blush
    '.khhssssm',
    '.khhkSsss',
    '.khhdkkSS',
    '.khhdddSS',
    '..khpppwS',
    '.kphpppww',
    '.kppppaaa',
    '.kpPppaaa',
    '.kpPppaar', // heart on the apron
    '.kpPppaaa',
    '.kpPrrrrr', // apron strings
    '.kpPaaaaa',
    '.kpPaaaaa',
    '.kssaaaaa', // hands
    '..kkaaaaa',
    '..klAaaaa',
    '..klAaaaa',
    '..klAaaaa',
    '..klAaaaa',
    '..kllAaaa',
    '..kllAAAA',
    '..klLllll',
    '..klLllll',
    '.klLLllll',
    '.klLlllll',
    '.kLLLLLLL',
    '..kkkkkkk',
    '.....ksk.',
    '.....ksk.',
    '....kffk.',
    '....kkkk.',
  ];
  const MOM_BLINK = { 9: '.khhsssss', 10: '.khhskkss', 11: '.khhsssss' };

  // ---- Boy: sitting cross-legged, back to us, facing the TV ------------
  const BOY_PALETTE = {
    k: '#1c1830',
    h: '#2a2f66', H: '#4d63c9', // spiky hair
    s: '#ffd6b5', S: '#e8a98a',
    u: '#ff9a62', t: '#ff5a3d', T: '#c9382c', // hoodie
    n: '#3b5fd0', N: '#27419a', // trousers (near / far leg)
    e: '#26305e', w: '#ffffff', m: '#c0504d', b: '#ff9eae', // face
    r: '#ff4757', R: '#b8303c', // sneakers (near / far foot)
  };

  const BOY_HEAD = [
    '......k....k........',
    '..k..khk..khk..k....', // spiky anime hair
    '..kk.khhkkhhhk.kk...',
    '..khkkhhhhhhhhhkhk..',
    '..khhhhHHhhhhHhhhk..',
    '.khhHHHhhhhHHHhhhhk.', // shine band
    '..khhhHHhhhhHHhhhk..',
    '.khhhhhhhhhhhhhhhhk.',
    '..khhhhhhhhhhhhhhk..',
    '.kskhhhhhhhhhhhhksk.', // ears
    '.kSkhhhhhhhhhhhhkSk.',
    '..kkhhhhhhhhhhhhkk..',
    '...khhkhhhhhhkhhk...',
    '....kk.khhhhk.kk....',
  ];

  const BOY_BODY = [
    '....kuuSSS',
    '...kuuuuuu', // hood
    '..kttuuuuu',
    '.kttttuuuu',
    '.kTtttttuu',
    '.kttTttttt', // elbows out
    '.kttTttttt',
    '..ktTttttt',
    '.kkTTTTTTT',
    'knnnnnNnnn', // crossed legs
    'knnnnnnNnn',
    '.kkkkkkkkk',
  ];
  // Elbows tucked in — alternating with the above looks like button mashing
  const BOY_BODY_MASH = BOY_BODY.map((row, i) => (i === 5 || i === 6 ? '..ktTttttt' : row));

  // ---- Boy: standing, facing us ------------------------------------------
  const BOY_FRONT = [
    '...k...k',
    '..khk.kh',
    '.kkhhkhh',
    '.khhhhHh',
    'khhhHHhh',
    'khhhhhhh',
    'khhshhhs',
    'khssssss',
    'khsskkss', // lashes
    'khsswess', // eyes
    'khsseess',
    'khsbbsss', // blush
    '.khssssm',
    '..kSssss',
    '....kkSS',
    '..kutttw', // hoodie with drawstrings
    '.kttttwt',
    'kttTttwt',
    'kttTtttt',
    'kttTtttt',
    'kttTtttt',
    'kttTuuuu', // pocket
    'kssTuuuu', // hands
    '.kkTTTTT',
    '..knnnnn',
    '..knnnnn',
    '..knnnnk',
    '..knnnk.',
    '..knnnk.',
    '..knnnk.',
    '..knnnk.',
    '..kNNNk.',
    '.krrrrk.',
    '.kkkkkk.',
  ];
  const BOY_FRONT_BLINK = { 8: 'khssssss', 9: 'khsskkss', 10: 'khssssss' };

  // ---- Walk cycles -------------------------------------------------------
  // Side views are drawn facing right and flipped for walking left. Each
  // cycle is contact → passing → contact → passing. The far leg is a shade
  // darker so the legs read as crossing. Passing frames have one extra leg
  // row, so the body rises a pixel as the legs pass each other.

  function toGrid(rows, width) {
    return rows.map(r => (r.length === width ? r : r + [...r].reverse().join('')).split(''));
  }

  // Paint the near arm onto a grid: a 2px sleeve with an outline and a hand
  // at the end. `reach` is how far the hand swings forward (+) or back (-).
  function addArm(grid, arm, reach) {
    const pts = [];
    for (let i = 0; i < arm.len; i++) pts.push([arm.x + Math.round((reach * i) / (arm.len - 1)), arm.y + i]);
    const set = (x, y, c) => { if (grid[y] && x >= 0 && x < grid[y].length) grid[y][x] = c; };
    for (const [x, y] of pts) { set(x - 1, y, 'k'); set(x + 2, y, 'k'); }
    pts.forEach(([x, y], i) => {
      const hand = i >= arm.len - 2;
      set(x, y, hand ? 's' : arm.sleeve);
      set(x + 1, y, hand ? 's' : arm.light);
    });
    const [hx, hy] = pts[pts.length - 1];
    set(hx, hy + 1, 'k');
    set(hx + 1, hy + 1, 'k');
  }

  function walkCycle(upper, steps, arm, palette, width) {
    const right = steps.map(({ legs, reach }) => {
      const grid = toGrid([...upper, ...legs], width);
      addArm(grid, arm, reach);
      return Px.sprite(grid.map(r => r.join('')), palette, width);
    });
    return { right, left: right.map(Px.flip) };
  }

  // Same legs with near and far swapped
  const swapLegs = (rows, a, b, c, d) =>
    rows.map(r => r.replace(/./g, ch => ({ [a]: b, [b]: a, [c]: d, [d]: c }[ch] || ch)));

  const MOM_SIDE = [
    '....kkkkkk......',
    '..kkhhhhhhkk....',
    '.khhhhHHHhhhk...',
    '.khhhHHhhhhhhk..',
    'khhhhhhhhhrhhhk.', // hair clip
    'khhhhhhhhhhhhhhk',
    'khhhhhhhhhhshhsk',
    'khhhhhhhhssssssk',
    'khhhhhhhsssssssk',
    'khhhhhhhssskkssk', // lashes
    'khhhhhhhssswessk', // eye
    'khhhhhhhssseesss', // nose tip
    'khhhhhhhssbbsssk', // blush
    'khhhhhhhssssssmk', // mouth
    'khhhhhhhdkSsssk.',
    'khhhhhhddkkkkk..',
    '.khhhhhddkSSk...',
    '.khhhhkpppwk....', // long hair down her back
    '.khhhkpppppak...',
    '.khhkppppppaak..',
    '..kkpppppppaak..',
    '...kpppppppaak..',
    '...kpppppppaak..',
    '...krrrrrrrrrk..', // apron strings
    '...kllllllaaak..',
    '...kllllllaaak..',
    '..klllllllaaak..',
    '..klllllllaaak..',
    '..klllllllaaak..',
    '..klllllllaaak..',
    '..klllllllaaak..',
    '.kllllllllaaak..',
    '.kllllllllAAAk..',
    '.klllllllllllk..',
    '.kLllllllllllk..',
    '.kLlllllllllllk.',
    'kLLllllllllllllk',
    'kLlllllllllllllk',
    'kLLLLLLLLLLLLLLk',
    '.kkkkkkkkkkkkkk.',
  ];
  const MOM_CONTACT = ['....kSk...ksk...', '...kSk.....ksk..', '..kFFk.....kffk.', '..kkkk.....kkkk.'];
  const MOM_PASSING = ['....kSk.ksk.....', '...kFFk.ksk.....', '...kkkk.ksk.....', '........kffk....', '........kkkk....'];
  const momWalk = walkCycle(MOM_SIDE, [
    { legs: MOM_CONTACT, reach: -3 },
    { legs: MOM_PASSING, reach: 0 },
    { legs: swapLegs(MOM_CONTACT, 's', 'S', 'f', 'F'), reach: 3 },
    { legs: swapLegs(MOM_PASSING, 's', 'S', 'f', 'F'), reach: 0 },
  ], { x: 7, y: 18, len: 10, sleeve: 'P', light: 'p' }, MOM_PALETTE, 16);

  const BOY_SIDE = [
    '...k..k.......',
    '..khkkhk.k....',
    '.kkhhhhhkhk...',
    'khhhhHHhhhhk..',
    '.khhHHhhhhhhk.',
    'khhhhhhhhhhhhk',
    '.khhhhhhhshhsk',
    '.khhhhhhsssssk',
    '.khhhhhssskksk', // lashes
    '.khhhkSssswesk', // ear, eye
    '.khhhkSssseess', // nose tip
    '.khhhhkssbbssk', // blush
    '..khhhksssssmk', // mouth
    '...khhhkSsssk.',
    '....khhkSSkk..',
    '...kuuuttttk..', // hood
    '..kuuuttttk...',
    '..kuuttttttk..',
    '..kuttttttttk.',
    '..ktttttttttk.',
    '..kTtttttttk..',
    '..kTtttttttk..',
    '..kTTTTTTTTk..',
    '...knnnnnnk...',
    '...knnnnnnk...',
  ];
  const BOY_CONTACT = [
    '...kNNnnnk....',
    '...kNNkknnk...',
    '..kNNk..knnk..',
    '..kNNk..knnk..',
    '.kNNk...knnk..',
    '.kNNk....knnk.',
    'kNNk.....knnk.',
    'kRRk.....krrrk',
    'kkkk.....kkkkk',
  ];
  const BOY_PASSING = [
    '....kNNnnk....',
    '....kNNnnk....',
    '....kNNnnk....',
    '....kNNnnk....',
    '...kNNknnk....',
    '..kNNk.knnk...',
    '.kRRk..knnk...',
    '.kkk...knnk...',
    '.......krrrk..',
    '.......kkkkk..',
  ];
  const boyWalk = walkCycle(BOY_SIDE, [
    { legs: BOY_CONTACT, reach: -2 },
    { legs: BOY_PASSING, reach: 0 },
    { legs: swapLegs(BOY_CONTACT, 'n', 'N', 'r', 'R'), reach: 2 },
    { legs: swapLegs(BOY_PASSING, 'n', 'N', 'r', 'R'), reach: 0 },
  ], { x: 6, y: 16, len: 8, sleeve: 'T', light: 't' }, BOY_PALETTE, 14);

  // ---- Sitting at the dinner table ---------------------------------------
  // Side-on (end chairs): the lap sticks out forward and the shins hang down,
  // with the hand resting on the knee. `seatRow` is the row that rests on
  // the chair seat.
  function sitSide(upper, lower, arm, reach, palette, width, seatRow) {
    const grid = toGrid([...upper.map(r => r.padEnd(width, '.')), ...lower], width);
    addArm(grid, arm, reach);
    const right = Px.sprite(grid.map(r => r.join('')), palette, width);
    return { right, left: Px.flip(right), seatRow };
  }

  const momSitSide = sitSide(MOM_SIDE.slice(0, 24), [
    '...kllllllaaaak.....',
    '..klllllllaaaaak....',
    '..kllllllllaaaaaaak.',
    '..kLLLLLLLLAAAAAAAk.',
    '...kkkkkkkkkkkklllk.', // resting on the seat
    '..............klllk.',
    '..............kLLLk.',
    '..............kkkkk.',
    '...............ksk..',
    '...............ksk..',
    '...............ksk..',
    '...............ksk..',
    '...............kffk.',
    '...............kkkk.',
  ], { x: 7, y: 18, len: 9, sleeve: 'P', light: 'p' }, 4, MOM_PALETTE, 20, 28);

  const boySitSide = sitSide(BOY_SIDE.slice(0, 23), [
    '...knnnnnnnnnnnk..',
    '...kNNNNNNNNNNnnk.',
    '....kkkkkkkkkknnk.', // resting on the seat
    '.............knnk.',
    '.............knnk.',
    '.............knnk.',
    '.............knnk.',
    '.............knnk.',
    '.............knnk.',
    '.............knnk.',
    '.............krrrk',
    '.............kkkkk',
  ], { x: 6, y: 16, len: 7, sleeve: 'T', light: 't' }, 3, BOY_PALETTE, 18, 25);

  // Facing us (back chairs): the table hides the lap, only the shins and
  // feet show underneath it. `above` is how many rows show over the table.
  const MOM_SIT_FRONT = [...MOM.slice(0, 27),
    '..kkaaaaa', '..klAaaaa', '..kLLLLLL', '..kkkkkkk',
    ...Array(8).fill('.....ksk.'), '....kffk.', '....kkkk.'];
  const BOY_SIT_FRONT = [...BOY_FRONT.slice(0, 25),
    '..kkkkkk', ...Array(11).fill('...knnk.'), '..krrrk.', '..kkkkk.'];

  const momSitFront = {
    frames: [Px.sprite(MOM_SIT_FRONT, MOM_PALETTE, 18), Px.sprite(MOM_SIT_FRONT.map((r, i) => MOM_BLINK[i] || r), MOM_PALETTE, 18)],
    above: 24,
  };
  const boySitFront = {
    frames: [Px.sprite(BOY_SIT_FRONT, BOY_PALETTE, 16), Px.sprite(BOY_SIT_FRONT.map((r, i) => BOY_FRONT_BLINK[i] || r), BOY_PALETTE, 16)],
    above: 22,
  };

  return {
    momSitSide,
    momSitFront,
    boySitSide,
    boySitFront,
    mom: Px.sprite(MOM, MOM_PALETTE, 18),
    momBlink: Px.sprite(MOM.map((row, i) => MOM_BLINK[i] || row), MOM_PALETTE, 18),
    momWalk,
    boyHead: Px.sprite(BOY_HEAD, BOY_PALETTE, 20),
    boyBody: [Px.sprite(BOY_BODY, BOY_PALETTE, 20), Px.sprite(BOY_BODY_MASH, BOY_PALETTE, 20)],
    boyFront: Px.sprite(BOY_FRONT, BOY_PALETTE, 16),
    boyFrontBlink: Px.sprite(BOY_FRONT.map((row, i) => BOY_FRONT_BLINK[i] || row), BOY_PALETTE, 16),
    boyWalk,
  };
})();
