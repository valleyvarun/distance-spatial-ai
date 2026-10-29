// Tiny pixel-art toolkit. Every shape snaps to whole pixels so the
// low-res canvas stays crisp when it is scaled up.
const Px = (() => {
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').imageSmoothingEnabled = false;
    return c;
  }

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function dot(ctx, x, y, color) {
    rect(ctx, x, y, 1, 1, color);
  }

  // Bresenham line
  function line(ctx, x0, y0, x1, y1, color) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    ctx.fillStyle = color;
    for (;;) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // Filled circle built from horizontal runs
  function disc(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt((r + 0.5) ** 2 - dy * dy));
      ctx.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
    }
  }

  function ellipse(ctx, cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    for (let dy = -ry; dy <= ry; dy++) {
      const k = Math.max(0, 1 - (dy * dy) / ((ry + 0.5) ** 2));
      const dx = Math.floor(rx * Math.sqrt(k) + 0.25);
      ctx.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
    }
  }

  // Scanline polygon fill, no anti-aliasing
  function poly(ctx, pts, color) {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    ctx.fillStyle = color;
    for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
      const sy = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) {
          xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]);
        if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
      }
    }
  }

  // Soft light from stacked, stepped discs — reads as pixel-art lighting
  function glow(ctx, cx, cy, r, color, alpha, steps = 4) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    for (let i = 0; i < steps; i++) disc(ctx, cx, cy, Math.round(r * (1 - i / steps)), color);
    ctx.restore();
  }

  // Build a sprite canvas from text rows. Rows shorter than `width` are
  // left halves and get mirrored, which keeps faces symmetric.
  function sprite(rows, palette, width) {
    const c = canvas(width, rows.length), g = c.getContext('2d');
    rows.forEach((row, y) => {
      const full = row.length === width ? row : row + [...row].reverse().join('');
      if (full.length !== width) console.warn(`sprite row ${y} is ${full.length} wide, expected ${width}`);
      for (let x = 0; x < width; x++) {
        const col = palette[full[x]];
        if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
      }
    });
    return c;
  }

  // Tiny 3×5 pixel font for in-scene labels like "4.2 m"
  const FONT = {
    0: ['###', '#.#', '#.#', '#.#', '###'],
    1: ['.#.', '##.', '.#.', '.#.', '###'],
    2: ['###', '..#', '###', '#..', '###'],
    3: ['###', '..#', '.##', '..#', '###'],
    4: ['#.#', '#.#', '###', '..#', '..#'],
    5: ['###', '#..', '###', '..#', '###'],
    6: ['###', '#..', '###', '#.#', '###'],
    7: ['###', '..#', '..#', '.#.', '.#.'],
    8: ['###', '#.#', '###', '#.#', '###'],
    9: ['###', '#.#', '###', '..#', '###'],
    '.': ['.', '.', '.', '.', '#'],
    m: ['.....', '####.', '#.#.#', '#.#.#', '#.#.#'],
    ' ': ['.', '.', '.', '.', '.'],
  };

  function textWidth(str) {
    return [...str].reduce((w, ch) => w + (FONT[ch] || FONT[' '])[0].length + 1, -1);
  }

  function text(ctx, str, x, y, color) {
    ctx.fillStyle = color;
    for (const ch of str) {
      const glyph = FONT[ch] || FONT[' '];
      glyph.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(x + i, y + j, 1, 1);
      });
      x += glyph[0].length + 1;
    }
  }

  // Mirror a sprite left-to-right (walk cycles are drawn facing right)
  function flip(src) {
    const c = canvas(src.width, src.height), g = c.getContext('2d');
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
  }

  // Seeded random so the static scene looks the same on every load
  function rng(seed) {
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  // 4x4 ordered-dither threshold, for retro gradients
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  function bayer(x, y) {
    return BAYER[(y & 3) * 4 + (x & 3)];
  }

  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  return { canvas, rect, dot, line, disc, ellipse, poly, glow, sprite, flip, text, textWidth, rng, bayer, hex };
})();
