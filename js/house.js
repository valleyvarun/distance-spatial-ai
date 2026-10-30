// Static parts of the scene: the sunset sky, the garden and the cut-away
// house. Layers are drawn once (and again when the view resizes); main.js
// animates on top.
//
// The house and garden live in a W×H "world". The part that must always be
// on screen is the world plus SKY_EXTRA rows of open sky above it (W×CH).
// The canvas grows to fill the space it's given, and the background — sky,
// hills, lawn — carries on past the world in every direction to fill it.
const W = 384, H = 216;
const SKY_EXTRA = 24, CH = H + SKY_EXTRA;

// The current canvas size, and where the world's top-left corner lands on
// it. main.js keeps this up to date as the window resizes.
const View = { w: W, h: CH, ox: 0, oy: SKY_EXTRA };

const House = (() => {
  // Positions main.js needs for the things it animates
  const LAYOUT = {
    upperRoom: { x: 186, y: 36, w: 182, h: 72 },
    groundRoom: { x: 92, y: 114, w: 276, h: 72 },
    tvScreen: { x: 289, y: 53, w: 56, h: 29 },
    lamp: { x: 227, y: 139 },
    ceilingLight: { x: 318, y: 40 },
    lantern: { x: 60, y: 176 },
    woofers: [{ x: 275, y: 72 }, { x: 359, y: 72 }],
    steam: [[202, 160], [211, 162], [225, 160], [241, 158], [252, 160], [291, 132]],
    cat: { x: 149, y: 181 },
    canopy: { x0: 2, x1: 54, y0: 132, y1: 162 },
    gardenEdge: 84,
    // The wall mirror as a flat vertical mirror: the plane through the
    // middle of the drawn glass, and how far up and down the glass goes
    mirror: { x: 98, y0: 86, y1: 168 },
    // The air inside the house, and the floor slab between the storeys,
    // as [x, y, w, h]. Sound gets round the slab at its open end (x = 186).
    interior: [92, 36, 276, 150],
    slab: [186, 108, 182, 6],
  };
  // Solid parts of the house, as [x, y, w, h]: they block sight lines
  LAYOUT.solids = [
    [86, 32, 288, 4],  // ceiling
    [86, 32, 6, 154],  // left wall
    [368, 32, 6, 154], // right wall
    LAYOUT.slab,       // upstairs floor
  ];

  function box(g, x, y, w, h, fill, outline) {
    Px.rect(g, x, y, w, h, outline);
    if (w > 2 && h > 2) Px.rect(g, x + 1, y + 1, w - 2, h - 2, fill);
  }

  // Punch a see-through hole so the live sky shows through a window
  function glass(g, x, y, w, h) {
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(x, y, w, h);
    g.restore();
    Px.rect(g, x, y, w, h, 'rgba(255, 238, 215, 0.16)');
  }

  // Stable pseudo-random value per pixel, so scattered details stay put
  // however the view is sized
  function hash(x, y) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ======================================================================
  // Background layers — sized to the whole view, not just the world
  // ======================================================================
  function buildSky(view) {
    const c = Px.canvas(view.w, view.h), g = c.getContext('2d');
    const stops = ['#1a1240', '#2a1756', '#40206b', '#5d287b', '#82307f', '#a93c7f',
      '#cc4f78', '#e86a6b', '#f6885f', '#fca65b', '#ffc463', '#ffdc86'].map(Px.hex);
    const img = g.createImageData(view.w, view.h), d = img.data;
    for (let y = 0; y < view.h; y++) {
      const t = Math.min(1, Math.max(0, y - view.oy) / 196) * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(t));
      const f = Math.max(0, (t - i - 0.6) / 0.4); // dither only near each band edge
      for (let x = 0; x < view.w; x++) {
        const col = f > Px.bayer(x - view.ox, y - view.oy) ? stops[i + 1] : stops[i];
        const o = (y * view.w + x) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    drawMoon(g, view.ox + 34, view.oy + 6);
    return c;
  }

  // Hills and lawn across the whole view. Inside the world they match the
  // house layer exactly; outside it they just keep going.
  function buildLand(view) {
    const c = Px.canvas(view.w, view.h), g = c.getContext('2d');
    g.translate(view.ox, view.oy);
    const x0 = -view.ox, x1 = view.w - view.ox, y1 = view.h - view.oy;
    drawHills(g, x0, x1);
    drawLawn(g, x0, x1, y1);
    const flowers = ['#ffffff', '#ffd23f', '#ff7aa8', '#b38cff'];
    for (let y = 196; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (x >= 0 && x < W && y < H) continue; // the house layer has its own
        const r = hash(x, y);
        if (r < 0.008) {
          Px.dot(g, x, y, '#7fdc5c'); Px.dot(g, x + 1, y - 1, '#7fdc5c'); Px.dot(g, x + 2, y, '#7fdc5c');
        } else if (r < 0.011) {
          Px.dot(g, x, y + 1, '#2f8a3a');
          Px.dot(g, x, y, flowers[Math.floor(hash(y, x) * flowers.length)]);
        }
      }
    }
    return c;
  }

  function drawMoon(g, cx, cy) {
    Px.glow(g, cx, cy, 18, '#ffd9a8', 0.05, 4);
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const inMoon = dx * dx + dy * dy <= 8.5 * 8.5;
        const inShadow = (dx - 4) ** 2 + (dy + 3) ** 2 <= 7.5 * 7.5;
        if (inMoon && !inShadow) {
          const rim = (dx - 4) ** 2 + (dy + 3) ** 2 <= 9 * 9;
          Px.dot(g, cx + dx, cy + dy, rim ? '#ffe9a8' : '#fff7dc');
        }
      }
    }
  }

  // ======================================================================
  // House layer
  // ======================================================================
  function buildHouse() {
    const c = Px.canvas(W, H), g = c.getContext('2d');
    drawHills(g);
    drawGarden(g);
    drawRooms(g);
    drawStairHall(g);
    drawKidsRoom(g);
    drawKitchen(g);
    drawDining(g);
    drawTable(g);
    drawMirror(g);
    drawStairs(g);
    drawStructure(g);
    drawBushes(g);
    return c;
  }

  // ---- Background hills and Mt. Fuji -----------------------------------
  function drawHills(g, x0 = 0, x1 = W) {
    for (let x = x0; x < x1; x++) {
      const top = Math.round(158 + 6 * Math.sin(x / 23) + 4 * Math.sin(x / 9 + 1));
      Px.rect(g, x, top, 1, 193 - top, '#3e2d72');
    }

    // Fuji peeks out beside the house; its foot runs off to the left
    const peakX = 58, peakY = 110;
    for (let x = Math.max(x0, -60); x < Math.min(x1, 86); x++) {
      const dd = Math.abs(x - peakX);
      const top = Math.round(peakY + 0.35 * dd + 0.006 * dd * dd);
      if (top >= 193) continue;
      const lit = x >= peakX;
      Px.rect(g, x, top, 1, 193 - top, lit ? '#6a58b4' : '#4f4096');
      const snowLine = peakY + 11 + [0, 2, 1, 3, 1, 2, 0, 3][((x % 8) + 8) % 8];
      if (top < snowLine) Px.rect(g, x, top, 1, snowLine - top, lit ? '#fff1f6' : '#dccbf0');
    }

    for (let x = x0; x < x1; x++) {
      const top = Math.round(178 + 4 * Math.sin(x / 17 + 2) + 2 * Math.sin(x / 7));
      Px.rect(g, x, top, 1, 193 - top, '#2d2459');
    }
  }

  // Lawn from the horizon down to y1, darkening (dithered) as it comes closer
  function drawLawn(g, x0, x1, y1) {
    const greens = ['#9be36e', '#6fd055', '#4fb847', '#43a843', '#3a9640'];
    for (let y = 193; y < y1; y++) {
      const t = Math.min(greens.length - 1.001, (y - 193) / 5);
      const i = Math.floor(t), f = t - i;
      for (let x = x0; x < x1; x++) Px.dot(g, x, y, f > Px.bayer(x, y) ? greens[i + 1] : greens[i]);
    }
  }

  // ---- Garden: grass, sakura tree, stone lantern -----------------------
  function drawGarden(g) {
    const r = Px.rng(42);
    drawLawn(g, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(r() * W), y = 196 + Math.floor(r() * 19);
      Px.dot(g, x, y, '#7fdc5c'); Px.dot(g, x + 1, y - 1, '#7fdc5c'); Px.dot(g, x + 2, y, '#7fdc5c');
    }
    const flowers = ['#ffffff', '#ffd23f', '#ff7aa8', '#b38cff'];
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(r() * W), y = 197 + Math.floor(r() * 17);
      Px.dot(g, x, y + 1, '#2f8a3a');
      Px.dot(g, x, y, flowers[Math.floor(r() * flowers.length)]);
    }
    for (const [x, y, rx] of [[12, 205, 5], [32, 210, 6], [54, 204, 5], [74, 209, 4]]) {
      Px.ellipse(g, x, y, rx, 1, '#6e6888');
      Px.ellipse(g, x, y - 1, rx - 1, 1, '#b9b4d4');
    }
    for (let i = 0; i < 24; i++) {
      Px.dot(g, Math.floor(r() * 64), 194 + Math.floor(r() * 8), r() < 0.5 ? '#ffc2e0' : '#ff8fc4');
    }
    drawTree(g);
    drawLantern(g, LAYOUT.lantern.x);
  }

  function drawTree(g) {
    const bark = '#6b3a2a';
    Px.poly(g, [[19, 194], [31, 194], [28, 180], [27, 158], [23, 158], [22, 180]], bark);
    Px.rect(g, 23, 162, 1, 30, '#8f5238');
    Px.rect(g, 27, 166, 1, 26, '#4a2418');
    Px.line(g, 24, 168, 12, 152, bark); Px.line(g, 25, 168, 13, 152, bark);
    Px.line(g, 27, 165, 40, 150, bark); Px.line(g, 27, 166, 41, 150, bark);
    Px.line(g, 25, 160, 26, 142, bark);

    const blobs = [[14, 150, 9], [27, 140, 11], [41, 148, 10], [22, 158, 7],
      [36, 158, 7], [6, 160, 6], [49, 140, 6], [16, 138, 6]];
    for (const [x, y, rr] of blobs) Px.disc(g, x + 1, y + 2, rr, '#c94f8c');
    for (const [x, y, rr] of blobs) Px.disc(g, x, y, rr - 1, '#ff8fc4');
    for (const [x, y, rr] of blobs) if (rr >= 6) Px.disc(g, x - 2, y - 3, rr - 4, '#ffc2e0');

    const r = Px.rng(5);
    for (let i = 0; i < 70; i++) {
      const [bx, by, br] = blobs[Math.floor(r() * blobs.length)];
      const a = r() * Math.PI * 2, d = r() * (br - 1);
      const col = ['#ffffff', '#ffe3f0', '#e0609e'][Math.floor(r() * 3)];
      Px.dot(g, bx + Math.cos(a) * d, by + Math.sin(a) * d, col);
    }
  }

  function drawLantern(g, cx) {
    const stone = '#a8a4c0', dark = '#6e6a88', light = '#cfcbe4';
    Px.rect(g, cx - 4, 190, 9, 3, dark);
    Px.rect(g, cx - 3, 189, 7, 1, stone);
    Px.rect(g, cx - 2, 180, 5, 9, stone);
    Px.rect(g, cx - 2, 180, 1, 9, light);
    Px.rect(g, cx + 2, 180, 1, 9, dark);
    Px.rect(g, cx - 4, 173, 9, 7, stone);
    Px.rect(g, cx - 4, 179, 9, 1, dark);
    Px.rect(g, cx - 2, 175, 5, 3, '#ffd27a');
    Px.poly(g, [[cx - 7, 174], [cx - 3, 169], [cx + 4, 169], [cx + 8, 174]], dark);
    Px.rect(g, cx - 3, 169, 7, 1, light);
    Px.rect(g, cx, 166, 1, 3, dark);
  }

  function drawBushes(g) {
    const blobs = [[74, 190, 5], [81, 188, 6], [66, 193, 3]];
    for (const [x, y, r] of blobs) Px.disc(g, x, y + 1, r, '#1f6b3a');
    for (const [x, y, r] of blobs) Px.disc(g, x, y, r - 1, '#2f9150');
    for (const [x, y, r] of blobs) if (r > 3) Px.disc(g, x - 1, y - 2, r - 3, '#55bf6a');
    for (const [x, y] of [[72, 187], [79, 185], [83, 190], [76, 191], [85, 186]]) Px.dot(g, x, y, '#ff6fa8');
  }

  // ---- Room backgrounds: wallpaper, panelling, floors ------------------
  function drawRooms(g) {
    // Stair hall + ground floor share a warm cream wallpaper
    for (const [x, y, w, h] of [[92, 36, 94, 138], [186, 114, 182, 60]]) {
      Px.rect(g, x, y, w, h, '#ffe6bf');
      for (let xx = x; xx < x + w; xx++) if (xx % 6 === 3) Px.rect(g, xx, y, 1, h, '#fadcac');
    }
    Px.rect(g, 92, 36, 94, 2, '#f0cb94');
    Px.rect(g, 186, 114, 182, 2, '#f0cb94');

    // Wainscot panelling
    Px.rect(g, 92, 155, 276, 1, '#b86e3a');
    Px.rect(g, 92, 156, 276, 16, '#eea56a');
    Px.rect(g, 92, 156, 276, 1, '#ffc58e');
    for (let x = 98; x < 368; x += 14) Px.rect(g, x, 158, 1, 12, '#d98f56');
    Px.rect(g, 92, 171, 276, 3, '#8a4a26');

    // Ground floor boards
    for (let y = 174; y < 186; y++) {
      Px.rect(g, 92, y, 276, 1, Math.floor((y - 174) / 3) % 2 ? '#cf884a' : '#dd9655');
    }
    Px.rect(g, 92, 174, 276, 1, '#a8612f');
    Px.rect(g, 92, 185, 276, 1, '#9c5a2c');
    const r = Px.rng(11);
    for (let row = 0; row < 4; row++) {
      for (let x = 92 + Math.floor(r() * 20); x < 368; x += 18 + Math.floor(r() * 22)) {
        Px.rect(g, x, 175 + row * 3, 1, 2, '#b57038');
      }
    }

    // Kid's room: sky-blue wallpaper with little stars
    Px.rect(g, 189, 36, 179, 62, '#8fd8ea');
    for (let y = 44, row = 0; y < 92; y += 10, row++) {
      for (let x = 195 + (row % 2) * 5; x < 366; x += 10) {
        Px.dot(g, x - 1, y, '#b8eef8'); Px.dot(g, x + 1, y, '#b8eef8');
        Px.dot(g, x, y - 1, '#b8eef8'); Px.dot(g, x, y + 1, '#b8eef8');
        Px.dot(g, x, y, '#e2fbff');
      }
    }
    Px.rect(g, 189, 36, 179, 2, '#6cc0d6');
    Px.rect(g, 189, 94, 179, 1, '#5a9ccc');
    Px.rect(g, 189, 95, 179, 3, '#3d7fb2');
    for (let y = 98; y < 108; y++) {
      Px.rect(g, 186, y, 182, 1, Math.floor((y - 98) / 2) % 2 ? '#e8ae6c' : '#f2bb7c');
    }
    Px.rect(g, 186, 98, 182, 1, '#c98a4a');
    Px.rect(g, 186, 107, 182, 1, '#b06a34');

    // Wooden pillar between the stair hall and the kid's room
    Px.rect(g, 186, 36, 3, 62, '#a0622f');
    Px.rect(g, 186, 36, 1, 62, '#c98146');
    Px.rect(g, 188, 36, 1, 62, '#7a4520');
  }

  // ---- Stair hall: round window, clock, family photo -------------------
  function drawStairHall(g) {
    const cx = 136, cy = 62, r = 13;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    Px.disc(g, cx, cy, r - 1, '#000');
    g.restore();
    Px.disc(g, cx, cy, r - 1, 'rgba(255, 238, 215, 0.16)');
    Px.rect(g, cx, cy - r + 1, 1, 2 * r - 1, '#7a4520');
    Px.rect(g, cx - r + 1, cy, 2 * r - 1, 1, '#7a4520');
    for (let dy = -r - 2; dy <= r + 2; dy++) {
      for (let dx = -r - 2; dx <= r + 2; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r - 1.5 && d <= r + 0.5) Px.dot(g, cx + dx, cy + dy, '#6b3a1e');
        else if (d > r + 0.5 && d <= r + 1.5) Px.dot(g, cx + dx, cy + dy, '#c98146');
      }
    }

    // Clock showing seven o'clock — dinner time
    Px.disc(g, 170, 50, 6, '#5a2e1a');
    Px.disc(g, 170, 50, 5, '#fff8ea');
    for (const [x, y] of [[170, 46], [174, 50], [170, 54], [166, 50]]) Px.dot(g, x, y, '#c98146');
    Px.line(g, 170, 50, 170, 46, '#2b1d2e');
    Px.line(g, 170, 50, 168, 53, '#2b1d2e');
    Px.dot(g, 170, 50, '#ff5e6c');

    // Family photo
    box(g, 150, 84, 16, 13, '#c98146', '#5a2e14');
    Px.rect(g, 152, 86, 12, 9, '#9fe0ff');
    Px.rect(g, 152, 92, 12, 3, '#8be36b');
    for (const [x, y, hair, shirt] of [[153, 88, '#8a4a2e', '#ff8fb8'], [157, 89, '#2a2f66', '#ff5a3d'], [161, 87, '#3a2a2a', '#3b5fd0']]) {
      Px.rect(g, x, y, 2, 1, hair);
      Px.rect(g, x, y + 1, 2, 1, '#ffdcc0');
      Px.rect(g, x, y + 2, 2, 94 - y - 2, shirt);
    }
  }

  // ---- Kid's room upstairs ---------------------------------------------
  function drawKidsRoom(g) {
    // Window with pink curtains
    box(g, 195, 45, 34, 29, '#ffffff', '#3d6f8a');
    glass(g, 198, 48, 28, 23);
    Px.rect(g, 211, 48, 2, 23, '#ffffff');
    Px.rect(g, 198, 59, 28, 1, '#ffffff');
    Px.rect(g, 193, 74, 38, 2, '#ffffff');
    Px.rect(g, 193, 76, 38, 1, '#7cb8d0');
    for (const [l, rgt] of [[191, 199], [225, 233]]) {
      const left = l < 210;
      Px.poly(g, left
        ? [[l, 44], [rgt, 44], [rgt - 3, 62], [rgt - 1, 77], [l, 77]]
        : [[l, 44], [rgt, 44], [rgt, 77], [l + 1, 77], [l + 3, 62]], '#ff7aa8');
      for (let x = l + 2; x < rgt - 1; x += 3) Px.rect(g, x, 46, 1, 30, '#e0578b');
      Px.rect(g, left ? l : l + 3, 62, 5, 1, '#ffd23f');
    }
    Px.rect(g, 189, 43, 46, 1, '#7a4520');
    Px.dot(g, 189, 43, '#ffd23f'); Px.dot(g, 234, 43, '#ffd23f');

    // Space poster
    Px.rect(g, 239, 45, 17, 23, '#6cb8cc');
    Px.rect(g, 238, 44, 17, 23, '#ffffff');
    Px.rect(g, 239, 45, 15, 21, '#2c2a74');
    Px.rect(g, 239, 58, 15, 8, '#4a2f8f');
    Px.disc(g, 246, 53, 4, '#ff77b0');
    Px.disc(g, 245, 52, 2, '#ffa6cc');
    Px.line(g, 240, 56, 252, 51, '#ffd23f');
    for (const [x, y] of [[241, 47], [251, 47], [243, 59], [252, 58], [249, 61]]) Px.dot(g, x, y, '#ffffff');
    Px.rect(g, 241, 62, 11, 2, '#ffd23f');
    Px.dot(g, 239, 45, '#ff4757'); Px.dot(g, 253, 45, '#ff4757');

    // Manga shelf
    box(g, 236, 76, 27, 22, '#a8642c', '#5a2e14');
    Px.rect(g, 237, 77, 25, 1, '#d08a4a');
    const books = ['#ff5a3d', '#ffd23f', '#3b8bff', '#4cc35a', '#ff8fc4', '#b38cff', '#ffffff', '#ff9a3c'];
    const r = Px.rng(3);
    for (const [top, h] of [[79, 8], [89, 7]]) {
      Px.rect(g, 239, top, 21, h, '#5e3218');
      for (let x = 239; x < 259;) {
        const w = r() < 0.7 ? 2 : 1, bh = h - Math.floor(r() * 3);
        Px.rect(g, x, top + h - bh, w, bh, books[Math.floor(r() * books.length)]);
        x += w + (r() < 0.15 ? 1 : 0);
      }
    }
    // Robot figure and a cactus on top
    Px.rect(g, 240, 72, 4, 4, '#d0d4e8');
    Px.rect(g, 240, 70, 4, 2, '#ff5a3d');
    Px.dot(g, 241, 71, '#3ad4ff');
    Px.rect(g, 254, 73, 5, 3, '#d9733a');
    Px.rect(g, 255, 68, 3, 5, '#4cc35a');
    Px.dot(g, 254, 70, '#4cc35a');
    Px.dot(g, 256, 67, '#ff8fc4');

    // Randoseru school bag and a football on the floor
    box(g, 198, 87, 12, 13, '#e8384f', '#5a1220');
    Px.rect(g, 199, 88, 10, 4, '#ff6b7e');
    Px.rect(g, 199, 92, 10, 1, '#5a1220');
    Px.rect(g, 203, 93, 2, 2, '#ffd23f');
    Px.rect(g, 201, 85, 6, 2, '#5a1220');
    Px.disc(g, 220, 101, 3, '#2b2b3a');
    Px.disc(g, 220, 101, 2, '#ffffff');
    Px.dot(g, 220, 101, '#2b2b3a'); Px.dot(g, 218, 100, '#2b2b3a'); Px.dot(g, 222, 102, '#2b2b3a');

    // Ceiling light
    Px.rect(g, 311, 36, 15, 3, '#c8a86a');
    Px.rect(g, 312, 36, 13, 2, '#fff3c4');

    // Speakers on stands
    for (const { x: cx } of LAYOUT.woofers) {
      const x = cx - 5, y = 58;
      Px.rect(g, cx - 1, y + 22, 3, 18, '#1d1d2a');
      Px.rect(g, cx - 4, 98, 9, 2, '#1d1d2a');
      Px.rect(g, x, y, 11, 22, '#12121c');
      Px.rect(g, x + 1, y + 1, 9, 20, '#2d2d44');
      Px.rect(g, x + 1, y + 1, 9, 1, '#4a4a6e');
      Px.rect(g, x + 1, y + 1, 1, 20, '#3d3d5c');
      Px.disc(g, cx, y + 5, 1, '#6a6a96');
      Px.dot(g, cx, y + 5, '#b8b8e0');
      Px.disc(g, cx, y + 14, 3, '#1a1a28');
      Px.disc(g, cx, y + 14, 2, '#4d4d74');
    }

    // TV (the screen itself is animated in main.js)
    Px.rect(g, 285, 49, 64, 37, '#0e0e16');
    Px.rect(g, 286, 50, 62, 35, '#24243a');
    Px.rect(g, 286, 50, 62, 1, '#46466a');
    Px.rect(g, 289, 53, 56, 29, '#000000');
    Px.dot(g, 346, 83, '#3aff8a');
    Px.rect(g, 296, 85, 6, 2, '#14141f');
    Px.rect(g, 332, 85, 6, 2, '#14141f');

    // TV cabinet with the game console
    Px.rect(g, 282, 87, 71, 12, '#5a2e14');
    Px.rect(g, 283, 88, 69, 10, '#c47a40');
    Px.rect(g, 283, 88, 69, 1, '#e8a060');
    Px.rect(g, 286, 90, 19, 7, '#3e2010');
    Px.rect(g, 288, 92, 14, 5, '#eef0f8');
    Px.rect(g, 288, 92, 14, 1, '#ffffff');
    Px.rect(g, 288, 95, 14, 1, '#c8ccdc');
    Px.rect(g, 290, 93, 6, 1, '#9aa0b8');
    Px.dot(g, 300, 93, '#3ad4ff');
    for (const x of [307, 329]) {
      Px.rect(g, x, 90, 21, 7, '#b06a34');
      Px.dot(g, x + 10, 93, '#ffd23f');
    }

    // Rug, cushion and snacks
    Px.ellipse(g, 318, 103, 34, 4, '#ffd23f');
    Px.ellipse(g, 318, 103, 30, 3, '#ff8fb1');
    Px.ellipse(g, 318, 103, 24, 2, '#7ad7f0');
    Px.ellipse(g, 318, 103, 16, 1, '#ffffff');
    box(g, 306, 100, 25, 5, '#ff5d8f', '#b8325e');
    Px.rect(g, 307, 101, 23, 1, '#ff8fb1');
    for (const [x, y] of [[305, 100], [331, 100], [305, 104], [331, 104]]) Px.dot(g, x, y, '#ffd23f');
    Px.line(g, 302, 96, 304, 100, '#2b2b3a');
    Px.line(g, 304, 100, 309, 101, '#2b2b3a');
    Px.rect(g, 333, 99, 3, 5, '#ff3b3b');
    Px.rect(g, 333, 99, 3, 1, '#d0d4e0');
    Px.dot(g, 333, 101, '#ff8a8a');
    box(g, 338, 97, 7, 8, '#ffcc33', '#6a4a10');
    Px.rect(g, 339, 99, 5, 2, '#ff4757');
    Px.dot(g, 346, 103, '#ffd86a'); Px.dot(g, 348, 104, '#ffd86a');
  }

  // ---- Kitchen ---------------------------------------------------------
  function drawKitchen(g) {
    // Tiled backsplash
    Px.rect(g, 282, 128, 64, 20, '#ffffff');
    for (let x = 282; x < 346; x += 4) Px.rect(g, x, 128, 1, 20, '#cfe7f5');
    for (let y = 128; y < 148; y += 4) Px.rect(g, 282, y, 64, 1, '#cfe7f5');

    // Range hood
    box(g, 291, 114, 10, 10, '#cfd4e2', '#8a90a8');
    Px.poly(g, [[287, 123], [305, 123], [309, 131], [283, 131]], '#5a6078');
    Px.poly(g, [[288, 124], [304, 124], [307, 130], [285, 130]], '#dfe3ee');
    Px.rect(g, 283, 130, 26, 2, '#8a90a8');
    Px.rect(g, 291, 132, 10, 1, '#fff3b0');

    // Window over the sink
    box(g, 311, 115, 30, 24, '#ffffff', '#a0703c');
    glass(g, 314, 118, 24, 18);
    Px.rect(g, 325, 118, 2, 18, '#ffffff');
    Px.rect(g, 314, 118, 24, 3, '#7ad7f0');
    for (let x = 314; x < 338; x += 2) Px.dot(g, x, 121, '#7ad7f0');
    Px.rect(g, 309, 138, 34, 2, '#f4f4f4');
    Px.rect(g, 309, 140, 34, 1, '#c8ccd8');
    Px.rect(g, 316, 134, 5, 4, '#d9733a');
    Px.rect(g, 315, 134, 7, 1, '#f08a4a');
    for (const [x, y] of [[317, 131], [318, 130], [319, 131], [316, 132], [320, 132], [318, 132], [317, 133], [319, 133]]) {
      Px.dot(g, x, y, (x + y) % 2 ? '#4cc35a' : '#7ae38c');
    }

    // Counter, cabinets and oven
    Px.rect(g, 280, 147, 69, 5, '#5a5f78');
    Px.rect(g, 281, 148, 67, 1, '#ffffff');
    Px.rect(g, 281, 149, 67, 2, '#d8dce8');
    Px.rect(g, 281, 152, 66, 20, '#ffd166');
    for (const x of [281, 306, 326, 346]) Px.rect(g, x, 152, 1, 20, '#d9a23a');
    Px.rect(g, 281, 152, 66, 1, '#d9a23a');
    Px.rect(g, 284, 155, 20, 14, '#d9a23a');
    Px.rect(g, 286, 158, 16, 9, '#2b2b3a');
    Px.rect(g, 287, 159, 5, 1, '#4a4a66');
    Px.rect(g, 286, 156, 16, 1, '#8a90a8');
    Px.dot(g, 316, 155, '#8a5a20');
    Px.dot(g, 336, 155, '#8a5a20');
    Px.rect(g, 281, 172, 66, 2, '#6a4220');

    // Burners, pot and kettle
    Px.rect(g, 285, 146, 9, 2, '#2b2b3a');
    Px.rect(g, 296, 146, 9, 2, '#2b2b3a');
    Px.rect(g, 285, 137, 12, 9, '#7a2a22');
    Px.rect(g, 286, 138, 10, 7, '#ff6b5a');
    Px.rect(g, 286, 138, 2, 7, '#ff9a8a');
    Px.rect(g, 284, 136, 14, 2, '#c94434');
    Px.rect(g, 289, 134, 4, 2, '#3a2a2a');
    Px.rect(g, 283, 140, 2, 1, '#3a2a2a');
    Px.rect(g, 297, 140, 2, 1, '#3a2a2a');
    Px.ellipse(g, 301, 142, 4, 3, '#2f7a6a');
    Px.ellipse(g, 301, 142, 3, 2, '#5ad1b4');
    Px.dot(g, 299, 141, '#a8f0dc');
    Px.line(g, 305, 142, 307, 139, '#2f7a6a');
    Px.rect(g, 298, 137, 6, 1, '#3a2a2a');
    Px.dot(g, 298, 138, '#3a2a2a'); Px.dot(g, 303, 138, '#3a2a2a');

    // Sink and tap
    Px.rect(g, 314, 148, 22, 1, '#8a90a8');
    Px.rect(g, 332, 141, 2, 7, '#b8c0d0');
    Px.rect(g, 328, 140, 6, 2, '#d8e0ec');
    Px.rect(g, 328, 142, 1, 2, '#b8c0d0');

    // Fridge covered in magnets and a drawing
    Px.rect(g, 347, 119, 21, 55, '#2f6b5a');
    Px.rect(g, 348, 120, 19, 53, '#8fe3c8');
    Px.rect(g, 365, 120, 2, 53, '#6cc8aa');
    Px.rect(g, 348, 120, 19, 1, '#c4f5e4');
    Px.rect(g, 348, 137, 19, 1, '#2f6b5a');
    Px.rect(g, 350, 125, 1, 9, '#ffffff');
    Px.rect(g, 350, 140, 1, 14, '#ffffff');
    Px.dot(g, 355, 124, '#ff4757'); Px.dot(g, 361, 127, '#ffd23f'); Px.dot(g, 357, 130, '#3a7bff');
    Px.rect(g, 354, 143, 9, 10, '#ffffff');
    Px.rect(g, 356, 148, 4, 3, '#ff4757');
    Px.rect(g, 357, 147, 2, 1, '#ff4757');
    Px.dot(g, 361, 145, '#ffd23f'); Px.dot(g, 360, 145, '#ffd23f');
    Px.rect(g, 355, 151, 7, 1, '#4cc35a');
    Px.dot(g, 358, 142, '#3a7bff');

    // Calendar
    Px.rect(g, 264, 121, 12, 14, '#d8b080');
    Px.rect(g, 263, 120, 12, 14, '#ffffff');
    Px.rect(g, 263, 120, 12, 3, '#ff4757');
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) Px.dot(g, 264 + col * 3, 125 + row * 3, '#9aa0b8');
    }
    Px.dot(g, 270, 128, '#ff4757');
    Px.dot(g, 268, 119, '#5a2e1a');
  }

  // ---- Dining area: rug, four chairs, lamp -----------------------------
  function drawDining(g) {
    // Rug
    Px.ellipse(g, 227, 180, 40, 4, '#3a9ad9');
    Px.ellipse(g, 227, 180, 36, 3, '#5ac8f0');
    Px.ellipse(g, 227, 180, 28, 2, '#ffd23f');
    Px.ellipse(g, 227, 180, 22, 1, '#5ac8f0');

    drawChairs(g);

    // Hanging lamp
    Px.rect(g, 227, 114, 1, 16, '#2b1d2e');
    Px.poly(g, [[223, 129], [232, 129], [237, 137], [218, 137]], '#7a2e10');
    Px.poly(g, [[224, 130], [231, 130], [235, 136], [220, 136]], '#ff8a3d');
    Px.rect(g, 224, 130, 8, 1, '#ffb36b');
    Px.rect(g, 219, 136, 18, 1, '#c85a20');
    Px.rect(g, 225, 137, 5, 1, '#fff6c0');

    // Cat cushion under the stairs (the cat is animated)
    Px.ellipse(g, 149, 182, 9, 2, '#5a3cb0');
    Px.ellipse(g, 149, 181, 8, 1, '#8f7ae6');
  }

  function drawChairs(g) {
    // Two chairs tucked in behind the table
    for (const x of [208, 236]) {
      box(g, x, 153, 12, 4, '#b8703a', '#5a2e14');
      box(g, x, 156, 3, 12, '#a0602f', '#5a2e14');
      box(g, x + 9, 156, 3, 12, '#a0602f', '#5a2e14');
      Px.rect(g, x + 5, 157, 2, 10, '#8a4a26');
    }

    // A chair at each end of the table, seen from the side
    for (const [back, seat] of [[182, 182], [271, 261]]) {
      box(g, back, 157, 4, 21, '#b8703a', '#5a2e14');
      box(g, seat, 174, 15, 4, '#c47f45', '#5a2e14');
      Px.rect(g, seat + 1, 178, 2, 5, '#8a4a26');
      Px.rect(g, seat + 12, 178, 2, 5, '#8a4a26');
    }
  }

  // ---- Dining table with dinner on it ----------------------------------
  // Kept separate so it can also be drawn over people sitting at the table.
  function drawTable(g) {
    // Legs, then a checked tablecloth
    box(g, 199, 173, 4, 10, '#b8703a', '#5a2e14');
    box(g, 251, 173, 4, 10, '#b8703a', '#5a2e14');
    Px.rect(g, 195, 165, 65, 12, '#5a2e14');
    for (let y = 166; y < 176; y++) {
      for (let x = 196; x < 259; x++) {
        const check = y < 169 ? ((x >> 1) + y) % 2 : ((x >> 1) + (y >> 1)) % 2;
        Px.dot(g, x, y, check ? '#ff6b81' : '#fff4f4');
      }
    }
    Px.rect(g, 196, 169, 63, 1, '#d94a60');
    Px.rect(g, 196, 175, 63, 1, '#e04a64');

    // Rice bowls
    for (const cx of [202, 252]) {
      Px.rect(g, cx - 3, 164, 7, 2, '#d6334a');
      Px.rect(g, cx - 2, 166, 5, 1, '#a82238');
      Px.rect(g, cx - 1, 167, 3, 1, '#6a1222');
      Px.rect(g, cx - 3, 163, 7, 1, '#ffffff');
      Px.rect(g, cx - 2, 162, 5, 1, '#ffffff');
      Px.rect(g, cx - 1, 161, 3, 1, '#ffffff');
      Px.dot(g, cx + 2, 163, '#dfe6f2');
      Px.dot(g, cx + 1, 162, '#dfe6f2');
      Px.dot(g, cx - 4, 164, '#5a1220'); Px.dot(g, cx + 4, 164, '#5a1220');
      Px.rect(g, cx - 4, 168, 8, 1, '#7a3e1e'); // chopsticks
    }

    // Miso soup
    Px.rect(g, 208, 163, 7, 1, '#d6334a');
    Px.rect(g, 209, 163, 5, 1, '#c8843a');
    Px.dot(g, 210, 163, '#ffffff'); Px.dot(g, 212, 163, '#ffffff'); Px.dot(g, 211, 163, '#6fd35a');
    Px.rect(g, 208, 164, 7, 2, '#3a2230');
    Px.rect(g, 209, 166, 5, 1, '#2a1824');
    Px.rect(g, 210, 167, 3, 1, '#1a0e16');

    // Grilled fish on a blue plate
    Px.rect(g, 217, 165, 19, 1, '#7ab8ff');
    Px.rect(g, 217, 166, 19, 1, '#3a7bd5');
    Px.rect(g, 218, 167, 17, 1, '#2a5aa8');
    Px.ellipse(g, 225, 163, 6, 1, '#e8823a');
    Px.rect(g, 221, 162, 9, 1, '#ffb070');
    Px.dot(g, 232, 162, '#c8642a'); Px.dot(g, 232, 164, '#c8642a');
    Px.dot(g, 233, 161, '#c8642a'); Px.dot(g, 233, 165, '#c8642a');
    Px.dot(g, 220, 163, '#1a1a1a');
    for (const [x, y] of [[223, 162], [224, 163], [226, 162], [227, 163], [229, 162]]) Px.dot(g, x, y, '#7a3a1a');
    Px.rect(g, 218, 164, 2, 1, '#ffe14d');

    // Karaage with salad
    Px.rect(g, 235, 165, 13, 1, '#ffffff');
    Px.rect(g, 235, 166, 13, 1, '#e0e4ee');
    Px.rect(g, 236, 167, 11, 1, '#c8ccd8');
    for (const [x, y] of [[235, 164], [236, 163], [246, 164], [247, 163]]) Px.dot(g, x, y, '#6fd35a');
    for (const [x, y] of [[238, 163], [241, 163], [244, 163], [239, 161], [243, 161], [241, 159]]) {
      Px.disc(g, x, y, 1, '#e8a03a');
      Px.dot(g, x - 1, y - 1, '#ffd27a');
      Px.dot(g, x + 1, y + 1, '#b8701c');
    }
    Px.dot(g, 246, 162, '#ff3b3b'); Px.dot(g, 246, 161, '#7ad35a');
  }

  // Just the table, on a transparent canvas — used as a mask in main.js
  function buildTableMask() {
    const c = Px.canvas(W, H);
    drawTable(c.getContext('2d'));
    return c;
  }

  // How strongly main.js greys out and darkens each pixel of the view
  // (1 = fully, like the background). The house's bones — cut walls, floor
  // slabs, ceiling and the staircase — plus the dining chairs and the
  // mirror stay in full colour; the roof is only toned down.
  function buildShadeMap(view) {
    const ROOF = 0.4;
    const c = Px.canvas(W, H), g = c.getContext('2d');
    drawChairs(g);
    drawMirror(g);
    drawStairs(g);
    drawStructure(g);
    g.globalCompositeOperation = 'destination-out';
    drawTable(g);  // the table sits in front of the chairs
    drawBushes(g); // the bushes sit in front of the wall
    const alpha = g.getImageData(0, 0, W, H).data;
    const map = new Float32Array(view.w * view.h).fill(1);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!alpha[(y * W + x) * 4 + 3]) continue;
        map[(y + view.oy) * view.w + x + view.ox] = y < 32 ? ROOF : 0; // the roof sits entirely above the ceiling
      }
    }
    return map;
  }

  // ---- Wall mirror at the foot of the stairs ---------------------------
  function drawMirror(g) {
    // The left edge is nearest the viewer (+Z): taller there, tapering
    // toward the right edge farther into the room. Keep the glass centred
    // on the same reflection plane used by the distance calculations.
    Px.poly(g, [[92, 78], [104, 86], [104, 169], [92, 176]], '#7a5414');
    Px.poly(g, [[93, 80], [103, 87], [103, 168], [93, 174]], '#f2c14e');
    Px.poly(g, [[95, 83], [101, 88], [101, 166], [95, 171]], '#9fe6ff');
    Px.poly(g, [[95, 131], [101, 135], [101, 166], [95, 171]], '#7fd0f0');
    Px.line(g, 96, 96, 100, 104, '#ffffff');
    Px.line(g, 96, 103, 100, 110, '#e0f8ff');
    Px.line(g, 96, 121, 100, 128, '#ffffff');
    Px.line(g, 96, 151, 99, 156, '#ffffff');
    Px.dot(g, 98, 81, '#ff5e6c');
  }

  // ---- Staircase from the ground floor up to the kid's room ------------
  function drawStairs(g) {
    const x0 = 108, x1 = 186, rise = 6, run = 6;
    const firstStep = 2; // Omit the bottom two steps; all others stay in place.
    const startX = x0 + firstStep * run;
    const top = x => 186 - rise * (Math.floor((x - x0) / run) + 1);
    // Cut the exposed end level with the bottom riser, rather than leaving
    // the sloping support projecting below it as a triangular tip.
    const endY = top(startX) + rise;
    const under = x => Math.max(114, Math.min(endY, 186 - (x - 114)));

    for (let x = startX; x < x1; x++) {
      const yt = top(x), yb = under(x);
      Px.rect(g, x, yt, 1, yb - yt, '#e3984f');
      Px.rect(g, x, yb - 4, 1, 4, '#b5652f');
      Px.dot(g, x, yt, '#ffd394');
      Px.dot(g, x, yt + 1, '#f4b26b');
      if ((x - x0) % run === 0) Px.rect(g, x, yt, 1, rise, '#b86a34');
      Px.dot(g, x, yb, '#4a2414');
    }
    Px.line(g, startX - 1, endY, startX + run, endY, '#4a2414');
    for (let i = firstStep; i < 13; i++) {
      const sx = x0 + i * run, sy = 186 - rise * (i + 1);
      Px.rect(g, sx - 1, sy - 1, run + 1, 1, '#4a2414');
      Px.rect(g, sx - 1, sy - 1, 1, rise + 1, '#4a2414');
    }

    // Handrail with balusters
    for (let i = firstStep; i < 13; i++) {
      const bx = x0 + 3 + i * run;
      Px.rect(g, bx, 166 - (bx - x0), 1, top(bx) - (166 - (bx - x0)), '#c27a42');
    }
    Px.line(g, startX, 166 - firstStep * rise, 187, 87, '#7a3e1e');
    Px.line(g, startX, 165 - firstStep * rise, 187, 86, '#b8683a');
    box(g, startX - 2, 162 - firstStep * rise, 4, 18, '#c98146', '#4a2414');
    Px.rect(g, startX - 3, 161 - firstStep * rise, 6, 2, '#7a3e1e');
    box(g, 186, 84, 4, 24, '#c98146', '#4a2414');
    Px.rect(g, 185, 83, 6, 2, '#7a3e1e');
  }

  // ---- Cut walls, floors and roof --------------------------------------
  // Everything the section "cuts through" is painted with a diagonal hatch
  // (like an architect's drawing) and outlined where it meets open space.
  function drawStructure(g) {
    const m = new Uint8Array(W * H);
    const mark = (x, y, w, h, v) => {
      for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) {
          if (xx >= 0 && xx < W && yy >= 0 && yy < H) m[yy * W + xx] = v;
        }
      }
    };
    const WOOD = 1, STONE = 2, ROOF = 3, ATTIC = 4;

    const roofTop = x => {
      const d = Math.abs(x - 230);
      return 2 + d * 0.16 - Math.max(0, d - 146) * 0.6; // eaves curl up at the tips
    };
    for (let x = 74; x <= 386; x++) {
      const t = Math.round(roofTop(x));
      const thick = Math.abs(x - 230) > 146 ? 4 : 6;
      mark(x, t, 1, thick, ROOF);
      if (x >= 86 && x < 374) mark(x, t + thick, 1, 32 - (t + thick), ATTIC);
    }
    for (const [x, y, w, h] of LAYOUT.solids) mark(x, y, w, h, WOOD); // walls, ceiling, upstairs floor
    mark(86, 186, 288, 7, STONE); // foundation

    // Inside the gable we see the roof's slope facing us: columns of round
    // tiles running down toward the viewer, a shadow where each course
    // overlaps the next, and a row of round tile ends along the eave.
    const TILE = ['#1f2a66', '#3a4ca6', '#6a82dc', '#4a60c4', '#3a4ca6'];
    const roofFace = (x, y) => {
      const col = (((x - 228) % 5) + 5) % 5;
      const fromEave = 31 - y;
      if (fromEave < 3) {
        if (col === 0 || col === 4) return '#151a44';
        return col === 2 && fromEave === 1 ? '#9fb2f5' : '#2f3f94';
      }
      if (fromEave % 4 === 3) return '#1f2a66';
      return TILE[col];
    };

    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : m[y * W + x]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = m[y * W + x];
        if (!v) continue;
        if (v === ATTIC) { Px.dot(g, x, y, roofFace(x, y)); continue; }
        const edge = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)]
          .some(k => k !== -1 && k !== v && !(k * v === WOOD * STONE));
        let col;
        if (v === ROOF) {
          const d = y - Math.round(roofTop(x));
          col = edge ? '#151a44' : d === 1 ? '#7d93ec' : x % 5 === 0 ? '#2f3f94' : d >= 4 ? '#3a4ca6' : '#4a60c4';
        } else if (v === STONE) {
          col = edge ? '#2e2a44' : (x + y) % 4 === 0 ? '#8d87aa' : '#6e6888';
        } else {
          col = edge ? '#3b1d14' : (x + y) % 4 === 0 ? '#b0653c' : '#8c4a2c';
        }
        Px.dot(g, x, y, col);
      }
    }

    // Ridge cap
    Px.rect(g, 221, 0, 19, 3, '#151a44');
    Px.rect(g, 222, 0, 17, 2, '#2f3f94');
    Px.rect(g, 222, 0, 17, 1, '#6f86e0');
  }

  // ======================================================================
  // Light map
  // ======================================================================
  // How brightly each pixel of the view is lit (0..1). The only real light
  // sources are the lamp over the dinner table and the TV: brightness falls
  // off with distance from them, and each light stays inside its own room.
  // Outside the house only a faint spill remains. Built once with the TV on
  // and once with it off; main.js blends between the two.
  function buildLightMap(tvOn, view) {
    const AMBIENT = 0.3, OUTSIDE = 0.28;
    const lamp = LAYOUT.lamp;
    const tv = { x: LAYOUT.tvScreen.x + LAYOUT.tvScreen.w / 2, y: LAYOUT.tvScreen.y + LAYOUT.tvScreen.h / 2 };
    const falloff = (x, y, s, r0, r1) => {
      if (s === tv && !tvOn) return 0;
      const d = Math.hypot(x - s.x, y - s.y);
      return Math.min(1, Math.max(0, (r1 - d) / (r1 - r0))) ** 1.6;
    };

    const map = new Float32Array(view.w * view.h);
    for (let vy = 0; vy < view.h; vy++) {
      for (let vx = 0; vx < view.w; vx++) {
        const x = vx - view.ox, y = vy - view.oy; // world coordinates
        const inHouse = x >= 92 && x < 368 && y >= 36 && y < 186;
        const upstairs = inHouse && x >= 186 && y < 108;
        const stairHall = inHouse && x < 186;
        let light;
        if (inHouse) {
          const fromLamp = upstairs ? 0 : falloff(x, y, lamp, 22, 175);
          const fromTv = upstairs || stairHall ? falloff(x, y, tv, 30, 160) : 0;
          light = AMBIENT + (1 - AMBIENT) * Math.min(1, fromLamp + fromTv);
        } else {
          const spill = Math.max(falloff(x, y, lamp, 0, 280), falloff(x, y, tv, 0, 280));
          light = OUTSIDE + 0.3 * spill;
        }
        map[vy * view.w + vx] = light;
      }
    }
    return map;
  }

  return { LAYOUT, buildSky, buildLand, buildHouse, buildTableMask, buildShadeMap, buildLightMap };
})();
