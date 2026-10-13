'use strict';
// Arte procedural: terreno, árvores, montanhas, objetos de mapa e personagens desenhados por código.
// Estilo "ilustração com contorno": gradientes, sombras e animação leve.

const Art = (() => {
  /* ---------- utilidades ---------- */
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const sm = t => t * t * (3 - 2 * t);
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s), u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.55 + vnoise(x * 2, y * 2, s + 7) * 0.3 + vnoise(x * 4, y * 4, s + 13) * 0.15;
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

  function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function shade(h, amt) { // amt -1..1
    const [r, g, b] = hex2rgb(h), f = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return `rgb(${Math.round(lerp(r, f, p))},${Math.round(lerp(g, f, p))},${Math.round(lerp(b, f, p))})`;
  }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2); }
  function grad(c, x0, y0, x1, y1, base, a = 0.25, b = -0.3) {
    const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, shade(base, a)); g.addColorStop(1, shade(base, b)); return g;
  }
  const OUT = '#1b1410';
  function fillOut(c, fill, w = 2) { c.fillStyle = fill; c.fill(); c.lineWidth = w; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); }

  /* ---------- terreno do mapa de aventura ---------- */
  // tiles: 0 grama, 1 floresta, 2 água, 3 montanha. Retorna canvas do chão + máscara de água.
  function buildTerrain(tiles, W, H, TS, biome, seed) {
    const pw = W * TS, ph = H * TS, ground = mk(pw, ph), mask = mk(pw, ph);
    const gx = ground.getContext('2d'), mx = mask.getContext('2d');
    const img = gx.createImageData(pw, ph), mimg = mx.createImageData(pw, ph), d = img.data, md = mimg.data;
    const water = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 1 : (tiles[y][x] === 2 ? 1 : 0);
    const rocky = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : (tiles[y][x] === 3 ? 1 : 0);
    const dark = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : (tiles[y][x] === 1 ? 1 : 0);
    const [g0, g1] = biome.ground, [w0, w1] = biome.water;
    for (let py = 0; py < ph; py++) {
      for (let px = 0; px < pw; px++) {
        const fx = px / TS - 0.5, fy = py / TS - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
        const bil = f => lerp(lerp(f(x0, y0), f(x0 + 1, y0), u), lerp(f(x0, y0 + 1), f(x0 + 1, y0 + 1), u), v);
        const n = fbm(px / 26, py / 26, seed), n2 = vnoise(px / 5, py / 5, seed + 3);
        const wf = bil(water) + (n - 0.5) * 0.7;
        const i = (py * pw + px) * 4;
        let col;
        if (wf > 0.5) {
          const depth = Math.min(1, (wf - 0.5) * 2.4);
          col = mix(mix(w0, w1, depth), [255, 255, 255], 0);
          const wave = vnoise(px / 9 + 3, py / 14, seed + 9);
          col = mix(col, [255, 255, 255], Math.max(0, wave - 0.62) * 0.35);
          if (wf < 0.54) col = mix(col, [255, 255, 255], 0.25);
          md[i + 3] = 255;
        } else {
          let t = n * 0.9 + n2 * 0.12;
          col = mix(g0, g1, t);
          const r = bil(rocky) + (n - 0.5) * 0.5;
          if (r > 0.45) col = mix(col, [110, 108, 104], Math.min(0.75, (r - 0.45) * 2));
          const dk = bil(dark);
          if (dk > 0.2) col = mix(col, g0, Math.min(0.55, dk * 0.55));
          if (wf > 0.4) col = mix(col, biome.shore, Math.min(1, (wf - 0.4) * 9)); // praia
          col = mix(col, [0, 0, 0], (n2 - 0.5) * 0.08);
        }
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        md[i] = 255; md[i + 1] = 255; md[i + 2] = 255;
      }
    }
    gx.putImageData(img, 0, 0); mx.putImageData(mimg, 0, 0);
    return { ground, mask };
  }

  // Padrão de ondulação (ladrilhável) usado na animação da água.
  function ripplePattern() {
    const s = 256, c = mk(s, s), x = c.getContext('2d');
    x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 1.5; x.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const px = hash(i, 1, 5) * s, py = hash(i, 2, 5) * s, len = 10 + hash(i, 3, 5) * 18;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { x.beginPath(); x.moveTo(px + ox, py + oy); x.quadraticCurveTo(px + ox + len / 2, py + oy - 3, px + ox + len, py + oy); x.stroke(); }
    }
    return c;
  }

  /* ---------- árvores e montanhas (pré-renderizadas) ---------- */
  function treeSprite(biome, variant) {
    const c = mk(64, 84), x = c.getContext('2d'), [d, m, l] = biome.tree, r = k => hash(variant, k, 77);
    x.fillStyle = 'rgba(0,0,0,.28)'; ell(x, 32, 76, 20, 6); x.fill();
    x.fillStyle = '#4a3322'; rr(x, 28, 50, 8, 26, 3); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.5; x.stroke();
    const blobs = [[32, 44, 21], [20, 36, 15], [44, 36, 15], [32, 26, 17], [24, 20, 11], [42, 22, 12]];
    for (const [bx, by, br] of blobs) { const jx = (r(bx) - .5) * 4, jy = (r(by) - .5) * 4; x.beginPath(); x.arc(bx + jx, by + jy, br, 0, 7); x.fillStyle = d; x.fill(); }
    for (const [bx, by, br] of blobs) { x.beginPath(); x.arc(bx - 2, by - 3, br * .82, 0, 7); x.fillStyle = m; x.fill(); }
    for (const [bx, by, br] of blobs.slice(1, 5)) { x.beginPath(); x.arc(bx - 4, by - 7, br * .5, 0, 7); x.fillStyle = l; x.fill(); }
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1.5; for (const [bx, by, br] of blobs.slice(0, 3)) { x.beginPath(); x.arc(bx, by, br, 0.3, 2.8); x.stroke(); }
    return c;
  }
  function mountainSprite(biome, variant) {
    const c = mk(72, 80), x = c.getContext('2d'), [lo, hi] = biome.rock;
    x.fillStyle = 'rgba(0,0,0,.3)'; ell(x, 36, 72, 30, 7); x.fill();
    const peaks = [[36, 10, 30], [16, 30, 20], [56, 28, 22]];
    peaks.sort((a, b) => a[1] - b[1]);
    for (const [px, py, w] of [peaks[1], peaks[2], peaks[0]]) {
      x.beginPath(); x.moveTo(px - w, 70); x.lineTo(px - 3 + (hash(variant, px, 4) - .5) * 4, py); x.lineTo(px + w, 70); x.closePath();
      x.fillStyle = hi; x.fill();
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + w, 70); x.lineTo(px + 4, 70); x.closePath(); x.fillStyle = lo; x.fill();
      x.beginPath(); x.moveTo(px - 3, py); x.lineTo(px - 11, py + 14); x.lineTo(px - 5, py + 11); x.lineTo(px, py + 16); x.lineTo(px + 6, py + 11); x.lineTo(px + 10, py + 14); x.closePath();
      x.fillStyle = '#f4f6f8'; x.fill();
      x.beginPath(); x.moveTo(px - w, 70); x.lineTo(px - 3, py); x.lineTo(px + w, 70); x.closePath(); x.lineWidth = 1.8; x.strokeStyle = OUT; x.lineJoin = 'round'; x.stroke();
    }
    return c;
  }

  /* ---------- objetos de mapa (64×64) ---------- */
  function shadowFor(x, w = 22) { x.fillStyle = 'rgba(0,0,0,.3)'; ell(x, 32, 56, w, 6); x.fill(); }
  const objectSprites = {};
  function flag(x, px, py, color) { x.strokeStyle = '#3a2a1a'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - 16); x.stroke(); x.beginPath(); x.moveTo(px, py - 16); x.lineTo(px + 11, py - 12); x.lineTo(px, py - 8); x.closePath(); fillOut(x, color, 1.4); }

  function drawTown(x, color, trim) {
    shadowFor(x, 28);
    x.fillStyle = grad(x, 0, 24, 0, 56, '#9a8f84', .2, -.25); rr(x, 14, 28, 36, 28, 3); fillOut(x, x.fillStyle);
    for (const tx of [8, 46]) { x.fillStyle = grad(x, 0, 18, 0, 56, '#a89c90', .25, -.3); rr(x, tx, 18, 12, 38, 3); fillOut(x, x.fillStyle); x.beginPath(); x.moveTo(tx - 3, 20); x.lineTo(tx + 6, 6); x.lineTo(tx + 15, 20); x.closePath(); fillOut(x, color); }
    x.beginPath(); x.moveTo(24, 30); x.lineTo(32, 14); x.lineTo(40, 30); x.closePath(); fillOut(x, shade(color, -.1));
    x.fillStyle = '#2a1c14'; x.beginPath(); x.moveTo(26, 56); x.lineTo(26, 44); x.quadraticCurveTo(32, 36, 38, 44); x.lineTo(38, 56); x.fill();
    x.fillStyle = trim; for (const wx of [18, 42]) { x.fillRect(wx, 34, 4, 6); }
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(15, 32 + i * 5); x.lineTo(49, 32 + i * 5); x.stroke(); }
    flag(x, 32, 14, trim);
  }
  function drawMine(x, kind) {
    shadowFor(x, 24);
    x.beginPath(); x.moveTo(6, 56); x.quadraticCurveTo(10, 14, 32, 12); x.quadraticCurveTo(54, 14, 58, 56); x.closePath(); fillOut(x, grad(x, 0, 12, 0, 56, '#8a8378', .2, -.3));
    x.beginPath(); x.moveTo(20, 56); x.lineTo(20, 38); x.quadraticCurveTo(32, 26, 44, 38); x.lineTo(44, 56); x.closePath(); x.fillStyle = '#120d0a'; x.fill();
    x.strokeStyle = '#6a4a2a'; x.lineWidth = 4; x.beginPath(); x.moveTo(20, 56); x.lineTo(20, 38); x.moveTo(44, 56); x.lineTo(44, 38); x.moveTo(18, 38); x.lineTo(46, 38); x.stroke();
    const gem = { gold: '#ffd24a', wood: '#a0713c', ore: '#8fa0b0', crystal: '#b46bff' }[kind];
    for (const [gx, gy] of [[10, 52], [14, 49], [52, 52], [48, 50]]) { x.beginPath(); x.arc(gx, gy, 3.4, 0, 7); fillOut(x, gem, 1.2); }
    x.fillStyle = gem; x.globalAlpha = .9; x.beginPath(); x.moveTo(30, 33); x.lineTo(34, 33); x.lineTo(32, 28); x.fill(); x.globalAlpha = 1;
  }
  function drawDwelling(x, color) {
    shadowFor(x, 24);
    x.beginPath(); x.moveTo(8, 56); x.lineTo(12, 30); x.lineTo(52, 30); x.lineTo(56, 56); x.closePath(); fillOut(x, grad(x, 0, 30, 0, 56, '#b99a6c', .2, -.25));
    x.beginPath(); x.moveTo(4, 32); x.lineTo(32, 8); x.lineTo(60, 32); x.closePath(); fillOut(x, grad(x, 0, 8, 0, 32, color, .15, -.3));
    x.fillStyle = '#2a1c14'; rr(x, 26, 40, 12, 16, 4); x.fill();
    flag(x, 32, 8, '#ffd24a');
  }
  function drawChest(x) {
    shadowFor(x, 16);
    rr(x, 16, 34, 32, 22, 4); fillOut(x, grad(x, 0, 34, 0, 56, '#9a6a34', .2, -.3));
    x.beginPath(); x.moveTo(16, 36); x.quadraticCurveTo(32, 14, 48, 36); x.closePath(); fillOut(x, grad(x, 0, 18, 0, 36, '#b07a3c', .25, -.2));
    x.fillStyle = '#e8c04a'; rr(x, 28, 34, 8, 10, 2); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.2; x.stroke();
    x.strokeStyle = '#e8c04a'; x.lineWidth = 3; x.beginPath(); x.moveTo(16, 46); x.lineTo(48, 46); x.stroke();
  }
  function drawArtifact(x) {
    shadowFor(x, 18);
    x.fillStyle = grad(x, 0, 42, 0, 56, '#9a9288', .2, -.3); rr(x, 18, 42, 28, 14, 3); fillOut(x, x.fillStyle);
    const g = x.createRadialGradient(32, 30, 2, 32, 30, 22); g.addColorStop(0, 'rgba(255,240,170,.95)'); g.addColorStop(1, 'rgba(255,200,80,0)'); x.fillStyle = g; x.fillRect(8, 8, 48, 46);
    x.beginPath(); x.moveTo(32, 14); x.lineTo(40, 28); x.lineTo(32, 42); x.lineTo(24, 28); x.closePath(); fillOut(x, grad(x, 0, 14, 0, 42, '#ffd86a', .3, -.15), 1.8);
  }
  function drawShrine(x) {
    shadowFor(x, 22);
    x.fillStyle = grad(x, 0, 14, 0, 56, '#a9b4c4', .25, -.25);
    rr(x, 12, 18, 10, 38, 3); fillOut(x, x.fillStyle); rr(x, 42, 18, 10, 38, 3); fillOut(x, x.fillStyle); rr(x, 10, 12, 44, 10, 3); fillOut(x, x.fillStyle);
    const g = x.createRadialGradient(32, 38, 1, 32, 38, 16); g.addColorStop(0, 'rgba(150,230,255,.95)'); g.addColorStop(1, 'rgba(120,200,255,0)'); x.fillStyle = g; x.fillRect(16, 22, 32, 34);
  }
  function drawPile(x, kind) {
    shadowFor(x, 16);
    if (kind === 'gold') { for (const [gx, gy, r] of [[24, 50, 7], [38, 50, 7], [31, 44, 7], [20, 44, 5], [43, 44, 5], [31, 36, 6]]) { x.beginPath(); ell(x, gx, gy, r, r * .55); fillOut(x, grad(x, 0, gy - 4, 0, gy + 4, '#ffd24a', .3, -.25), 1.4); } }
    else if (kind === 'wood') { for (const [gy, n] of [[50, 3], [43, 2], [36, 1]]) for (let i = 0; i < n; i++) { const gx = 32 + (i - (n - 1) / 2) * 15; rr(x, gx - 9, gy - 5, 18, 10, 5); fillOut(x, grad(x, 0, gy - 5, 0, gy + 5, '#a0713c', .25, -.25), 1.4); x.beginPath(); x.arc(gx - 8, gy, 3.6, 0, 7); x.fillStyle = '#d8b078'; x.fill(); } }
    else if (kind === 'ore') { for (const [gx, gy, r] of [[24, 48, 9], [40, 48, 9], [32, 38, 8]]) { x.beginPath(); x.moveTo(gx - r, gy + 4); x.lineTo(gx - r * .6, gy - r); x.lineTo(gx + r * .5, gy - r * .9); x.lineTo(gx + r, gy + 4); x.closePath(); fillOut(x, grad(x, 0, gy - r, 0, gy + 4, '#98a8b8', .3, -.25), 1.5); } }
    else { for (const [gx, gy, r, h] of [[24, 52, 6, 20], [34, 52, 7, 26], [43, 52, 5, 16]]) { x.beginPath(); x.moveTo(gx - r, gy); x.lineTo(gx - r * .6, gy - h * .7); x.lineTo(gx, gy - h); x.lineTo(gx + r * .6, gy - h * .7); x.lineTo(gx + r, gy); x.closePath(); fillOut(x, grad(x, 0, gy - h, 0, gy, '#c58bff', .35, -.2), 1.5); } }
  }
  function drawSign(x) { shadowFor(x, 10); x.strokeStyle = '#4a331f'; x.lineWidth = 4; x.beginPath(); x.moveTo(32, 56); x.lineTo(32, 26); x.stroke(); rr(x, 16, 16, 32, 18, 3); fillOut(x, '#c89a5a', 1.6); }
  function drawFountain(x) {
    shadowFor(x, 20); x.beginPath(); ell(x, 32, 48, 20, 8); fillOut(x, '#8f98a4', 1.8); x.beginPath(); ell(x, 32, 47, 15, 5); x.fillStyle = '#5fb8e8'; x.fill();
    x.fillStyle = grad(x, 0, 24, 0, 48, '#a9b4c4', .2, -.2); rr(x, 28, 26, 8, 22, 3); fillOut(x, x.fillStyle, 1.6); x.strokeStyle = 'rgba(180,230,255,.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(32, 26); x.quadraticCurveTo(26, 16, 22, 30); x.moveTo(32, 26); x.quadraticCurveTo(38, 16, 42, 30); x.stroke();
  }

  function objectSprite(o, faction) {
    const key = o.type + (o.kind || '') + (o.owner || '');
    if (objectSprites[key]) return objectSprites[key];
    const c = mk(64, 64), x = c.getContext('2d');
    switch (o.type) {
      case 'town': drawTown(x, faction.color, faction.trim); break;
      case 'mine': drawMine(x, o.kind); break;
      case 'dwelling': drawDwelling(x, '#b04a3a'); break;
      case 'chest': drawChest(x); break;
      case 'artifact': drawArtifact(x); break;
      case 'shrine': drawShrine(x); break;
      case 'pile': drawPile(x, o.kind); break;
      case 'sign': drawSign(x); break;
      case 'fountain': drawFountain(x); break;
    }
    return objectSprites[key] = c;
  }

  /* ---------- personagens ---------- */
  function limb(c, x0, y0, x1, y1, w, fill) { c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = w + 3; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = fill; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }

  function weapon(c, kind, a, s) {
    c.save(); c.rotate(a);
    if (kind === 'sword') { c.fillStyle = '#d6dde4'; c.beginPath(); c.moveTo(0, -2); c.lineTo(22, -1); c.lineTo(25, 0); c.lineTo(22, 2); c.lineTo(0, 2); c.closePath(); fillOut(c, '#d6dde4', 1.3); c.fillStyle = '#7a5a2a'; c.fillRect(-4, -4, 4, 8); c.fillRect(-1, -6, 3, 12); }
    else if (kind === 'dagger') { c.beginPath(); c.moveTo(0, -1.5); c.lineTo(12, -.5); c.lineTo(14, 0); c.lineTo(12, 1.5); c.lineTo(0, 1.5); c.closePath(); fillOut(c, '#c9d1d8', 1.2); }
    else if (kind === 'club') { c.beginPath(); c.moveTo(-2, -3); c.lineTo(18, -7); c.lineTo(26, -6); c.lineTo(26, 6); c.lineTo(18, 7); c.lineTo(-2, 3); c.closePath(); fillOut(c, '#7a5a34', 1.6); }
    else if (kind === 'staff') { c.strokeStyle = '#6a4a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, 0); c.lineTo(30, 0); c.stroke(); c.beginPath(); c.arc(32, 0, 5, 0, 7); fillOut(c, s.accent || '#7fe8ff', 1.4); }
    else if (kind === 'bow') { c.strokeStyle = '#7a5a2a'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 15, -1.2, 1.2); c.stroke(); c.strokeStyle = '#e8e0d0'; c.lineWidth = 1; c.beginPath(); c.moveTo(Math.cos(-1.2) * 15, Math.sin(-1.2) * 15); c.lineTo(Math.cos(1.2) * 15, Math.sin(1.2) * 15); c.stroke(); }
    else if (kind === 'crossbow') { c.fillStyle = '#6a4a2a'; c.fillRect(-4, -2, 18, 4); c.strokeStyle = '#4a3320'; c.lineWidth = 3; c.beginPath(); c.moveTo(10, -10); c.quadraticCurveTo(15, 0, 10, 10); c.stroke(); c.strokeStyle = '#ddd'; c.lineWidth = 1; c.beginPath(); c.moveTo(10, -10); c.lineTo(6, 0); c.lineTo(10, 10); c.stroke(); }
    else if (kind === 'lance') { c.strokeStyle = '#8a6a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, 0); c.lineTo(34, 0); c.stroke(); c.beginPath(); c.moveTo(34, -3); c.lineTo(44, 0); c.lineTo(34, 3); c.closePath(); fillOut(c, '#d6dde4', 1.2); }
    c.restore();
  }

  function human(c, s, o) {
    const t = o.t, walk = o.walk, step = walk ? Math.sin(t * 13) * 6 : 0, bob = walk ? -Math.abs(Math.sin(t * 13)) * 2.2 : Math.sin(t * 2.4) * -1.1, k = s.scale || 1;
    c.scale(k, k); c.translate(0, bob);
    const dark = shade(s.secondary, -.15);
    // capa
    if (s.cape) { c.beginPath(); c.moveTo(-6, -36); c.quadraticCurveTo(-18, -22, -14 + step * .3, -6); c.lineTo(2, -14); c.closePath(); fillOut(c, grad(c, 0, -36, 0, -6, s.secondary, .1, -.3), 1.8); }
    // pernas
    limb(c, -4, -17, -4 + step, -2, 6, dark); limb(c, 4, -17, 4 - step, -2, 6, dark);
    c.fillStyle = '#2a1e16'; rr(c, -9 + step, -4, 10, 5, 2); c.fill(); rr(c, -1 - step, -4, 10, 5, 2); c.fill();
    // tronco
    c.beginPath(); c.moveTo(-9, -35); c.lineTo(9, -35); c.lineTo(8, -16); c.lineTo(-8, -16); c.closePath(); fillOut(c, grad(c, -9, -35, 9, -16, s.primary, .22, -.28));
    c.fillStyle = s.secondary; c.fillRect(-8, -19, 16, 3);
    if (s.undead) { c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.4; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-6, -31 + i * 4); c.lineTo(6, -31 + i * 4); c.stroke(); } }
    // braço de trás + escudo
    limb(c, -8, -32, -13, -22, 5, s.skin);
    if (s.shield) { c.beginPath(); c.moveTo(-18, -34); c.lineTo(-6, -34); c.lineTo(-6, -20); c.quadraticCurveTo(-12, -13, -18, -20); c.closePath(); fillOut(c, grad(c, -18, -34, -6, -14, s.secondary, .2, -.2), 1.8); c.fillStyle = s.metal; c.beginPath(); c.arc(-12, -26, 3, 0, 7); c.fill(); }
    // cabeça
    c.beginPath(); c.arc(0, -43, 8, 0, 7); fillOut(c, s.skin, 2);
    if (s.ears) { c.beginPath(); c.moveTo(7, -46); c.lineTo(15, -50); c.lineTo(8, -41); c.closePath(); fillOut(c, s.skin, 1.4); }
    c.fillStyle = s.undead ? '#8ff0ff' : '#1b1410'; c.beginPath(); c.arc(3.5, -43, 1.3, 0, 7); c.fill();
    // elmo
    if (s.helm === 'helm' || s.helm === 'crest') { c.beginPath(); c.arc(0, -44, 9, Math.PI, 0); c.lineTo(9, -40); c.lineTo(-9, -40); c.closePath(); fillOut(c, grad(c, 0, -53, 0, -40, s.metal, .3, -.25), 1.8); c.fillStyle = '#1b1410'; c.fillRect(1, -44, 8, 2.4); if (s.helm === 'crest') { c.beginPath(); c.moveTo(-2, -53); c.quadraticCurveTo(-12, -58, -14 + Math.sin(t * 3) * 1.5, -46); c.lineTo(-5, -52); c.closePath(); fillOut(c, '#d6401e', 1.4); } }
    else if (s.helm === 'hood') { c.beginPath(); c.arc(0, -44, 10, Math.PI * .95, Math.PI * 2.05); c.lineTo(8, -36); c.lineTo(-9, -36); c.closePath(); fillOut(c, grad(c, 0, -54, 0, -34, s.secondary, .1, -.3), 1.8); c.beginPath(); c.arc(1, -43, 7, 0, 7); fillOut(c, s.skin, 1.2); c.fillStyle = '#1b1410'; c.beginPath(); c.arc(4, -43, 1.2, 0, 7); c.fill(); }
    else if (s.helm === 'cap') { c.beginPath(); c.arc(0, -45, 8.5, Math.PI, 0); c.lineTo(11, -45); c.lineTo(-8, -44); c.closePath(); fillOut(c, s.secondary, 1.6); }
    // braço da frente + arma
    const swing = o.atk ? Math.sin(o.atk * Math.PI) * 1.9 - .5 : (walk ? Math.sin(t * 13) * .12 : Math.sin(t * 2.4) * .05);
    c.save(); c.translate(8, -32);
    limb(c, 0, 0, 8, 6, 5, s.skin);
    c.translate(8, 6);
    const wk = s.weapon;
    if (wk === 'bow') { weapon(c, 'bow', -swing * .3, s); }
    else if (wk === 'crossbow') { weapon(c, 'crossbow', -.1, s); }
    else if (wk) { weapon(c, wk, -1.1 + swing, s); }
    c.restore();
  }

  function beast(c, s, o) {
    const t = o.t, walk = o.walk, ph = walk ? t * 14 : t * 2, k = s.scale || 1; c.scale(k, k);
    const bob = walk ? -Math.abs(Math.sin(ph)) * 2 : Math.sin(t * 2.2) * -1;
    c.translate(0, bob);
    const dark = shade(s.primary, -.3);
    // cauda
    c.beginPath(); c.moveTo(-17, -22); c.quadraticCurveTo(-30, -26 + Math.sin(t * 5) * 3, -28, -12); c.lineTo(-17, -17); c.closePath(); fillOut(c, s.primary, 1.8);
    // pernas
    for (const [lx, sg] of [[-12, 1], [-6, -1], [8, -1], [14, 1]]) { const sw = walk ? Math.sin(ph) * 5 * sg : 0; limb(c, lx, -14, lx + sw, -1, 5, lx > 0 ? s.primary : dark); }
    // corpo
    ell(c, 0, -20, 20, 10); fillOut(c, grad(c, 0, -30, 0, -10, s.primary, .22, -.25));
    ell(c, 2, -15, 14, 5); c.fillStyle = s.secondary; c.globalAlpha = .7; c.fill(); c.globalAlpha = 1;
    // cabeça
    c.save(); c.translate(19, -26 + (walk ? 0 : Math.sin(t * 2.2) * .8));
    if (s.antlers) { c.strokeStyle = '#d8c9a3'; c.lineWidth = 2.4; c.lineCap = 'round'; for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(-1 + sg, -8); c.quadraticCurveTo(-4 + sg * 3, -20, -2 + sg * 6, -26); c.moveTo(-3 + sg * 2, -16); c.lineTo(-9 + sg * 6, -18); c.moveTo(-2 + sg * 4, -22); c.lineTo(3 + sg * 6, -24); c.stroke(); } }
    ell(c, 0, 0, 9, 7); fillOut(c, grad(c, 0, -7, 0, 7, s.primary, .22, -.2), 1.8);
    ell(c, 8, 2, 6, 4); fillOut(c, s.secondary, 1.5);
    c.beginPath(); c.moveTo(-3, -6); c.lineTo(-1, -14); c.lineTo(3, -6); c.closePath(); fillOut(c, s.primary, 1.4);
    c.fillStyle = '#1b1410'; c.beginPath(); c.arc(3, -2, 1.5, 0, 7); c.fill(); c.beginPath(); c.arc(13, 1, 1.4, 0, 7); c.fill();
    c.restore();
  }

  function bird(c, s, o) {
    const t = o.t, k = s.scale || 1, flap = Math.sin(t * (o.walk ? 12 : 6)); c.scale(k, k); c.translate(0, -14 + Math.sin(t * 2.5) * -2);
    const wing = (sg, back) => { c.save(); c.translate(-2, -4); c.rotate(sg * (-0.5 + flap * .55)); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-8, -30 * (back ? .85 : 1), -26, -22 + flap * 6); c.lineTo(-14, -8); c.lineTo(-20, -4); c.lineTo(-8, 4); c.closePath(); fillOut(c, grad(c, 0, -30, 0, 4, s.primary, .25, -.3), 1.8); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.2; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-i * 5, -2 - i); c.lineTo(-i * 6 - 6, -14 - i * 2); c.stroke(); } c.restore(); };
    wing(-1, true);
    c.beginPath(); c.moveTo(-18, 6); c.lineTo(-30, 12); c.lineTo(-24, 3); c.closePath(); fillOut(c, s.primary, 1.5); // cauda
    ell(c, 0, 0, 16, 9, -.2); fillOut(c, grad(c, 0, -9, 0, 9, s.primary, .22, -.25));
    ell(c, 3, 3, 10, 5, -.2); c.fillStyle = s.secondary; c.globalAlpha = .85; c.fill(); c.globalAlpha = 1;
    c.beginPath(); c.arc(15, -8, 8, 0, 7); fillOut(c, s.secondary, 1.8);
    c.beginPath(); c.moveTo(21, -9); c.lineTo(31, -5); c.lineTo(21, -3); c.closePath(); fillOut(c, s.accent, 1.4);
    c.fillStyle = '#1b1410'; c.beginPath(); c.arc(17, -10, 1.7, 0, 7); c.fill();
    c.strokeStyle = s.accent; c.lineWidth = 2; for (const lx of [-3, 5]) { c.beginPath(); c.moveTo(lx, 8); c.lineTo(lx + 2, 15); c.lineTo(lx + 6, 16); c.stroke(); }
    wing(1, false);
  }

  function pixie(c, s, o) {
    const t = o.t, k = s.scale || 1; c.scale(k, k); c.translate(0, -22 + Math.sin(t * 3) * -3);
    const flap = Math.sin(t * 28);
    for (const sg of [-1, 1]) { c.save(); c.translate(-2, -4); c.rotate(sg * (0.4 + flap * .3)); ell(c, -10, -10, 12, 6, -.6); c.fillStyle = 'rgba(214,245,168,.7)'; c.fill(); c.strokeStyle = 'rgba(40,90,40,.6)'; c.lineWidth = 1.2; c.stroke(); c.restore(); }
    limb(c, -3, 6, -4, 16, 3, shade(s.primary, -.2)); limb(c, 3, 6, 4, 16, 3, shade(s.primary, -.2));
    ell(c, 0, 0, 7, 10); fillOut(c, grad(c, 0, -10, 0, 10, s.primary, .3, -.2), 1.8);
    c.beginPath(); c.arc(0, -13, 6.5, 0, 7); fillOut(c, '#f6d9b8', 1.8);
    c.beginPath(); c.moveTo(-6, -16); c.lineTo(0, -26); c.lineTo(6, -16); c.closePath(); fillOut(c, s.secondary, 1.5);
    c.fillStyle = '#1b1410'; c.beginPath(); c.arc(2.5, -13, 1.2, 0, 7); c.fill();
    c.fillStyle = s.accent; c.globalAlpha = .6 + Math.sin(t * 6) * .3; c.beginPath(); c.arc(9, -3, 3, 0, 7); c.fill(); c.globalAlpha = 1;
  }

  function wraith(c, s, o) {
    const t = o.t, k = s.scale || 1; c.scale(k, k); c.translate(0, -12 + Math.sin(t * 2.2) * -3);
    c.beginPath(); c.moveTo(-14, -34); c.quadraticCurveTo(-20, -8, -15, 12);
    for (let i = 0; i < 5; i++) c.lineTo(-15 + i * 7.5, 12 + (i % 2 ? 7 : -1) + Math.sin(t * 4 + i) * 2);
    c.quadraticCurveTo(20, -8, 14, -34); c.closePath();
    const g = c.createLinearGradient(0, -34, 0, 18); g.addColorStop(0, s.secondary); g.addColorStop(.5, s.primary); g.addColorStop(1, 'rgba(60,70,120,0)'); c.fillStyle = g; c.globalAlpha = .92; c.fill(); c.globalAlpha = 1; c.lineWidth = 1.8; c.strokeStyle = 'rgba(20,20,50,.6)'; c.stroke();
    c.beginPath(); c.arc(0, -36, 10, Math.PI, 0); c.lineTo(10, -28); c.quadraticCurveTo(0, -22, -10, -28); c.closePath(); fillOut(c, shade(s.primary, -.35), 1.8);
    c.fillStyle = s.accent; c.shadowColor = s.accent; c.shadowBlur = 8; c.beginPath(); c.arc(-3.5, -33, 2, 0, 7); c.arc(3.5, -33, 2, 0, 7); c.fill(); c.shadowBlur = 0;
    limb(c, 12, -20, 22, -10 + Math.sin(t * 3) * 3, 3, s.secondary);
  }

  function rider(c, s, o) {
    const t = o.t, walk = o.walk, ph = walk ? t * 13 : t * 2, k = s.scale || 1; c.scale(k, k);
    const bob = walk ? -Math.abs(Math.sin(ph)) * 2 : Math.sin(t * 2.2) * -1; c.translate(0, bob);
    const hd = s.horse;
    c.beginPath(); c.moveTo(-18, -26); c.quadraticCurveTo(-30, -24 + Math.sin(t * 5) * 3, -28, -8); c.lineTo(-16, -20); c.closePath(); fillOut(c, shade(hd, -.2), 1.6);
    for (const [lx, sg] of [[-13, 1], [-7, -1], [9, -1], [15, 1]]) { const sw = walk ? Math.sin(ph) * 6 * sg : 0; limb(c, lx, -15, lx + sw, -1, 5, lx > 0 ? hd : shade(hd, -.2)); }
    ell(c, 0, -22, 21, 10); fillOut(c, grad(c, 0, -32, 0, -12, hd, .2, -.25));
    c.beginPath(); c.moveTo(-10, -26); c.lineTo(10, -26); c.lineTo(12, -16); c.lineTo(-12, -16); c.closePath(); fillOut(c, s.primary, 1.6); // manta
    c.save(); c.translate(19, -28); c.rotate(.5); ell(c, 4, -4, 10, 6); fillOut(c, grad(c, 0, -10, 0, 2, hd, .2, -.2), 1.8); c.restore();
    c.fillStyle = '#111'; c.beginPath(); c.arc(21, -34, 1.5, 0, 7); c.fill();
    // cavaleiro
    c.save(); c.translate(0, -30);
    c.beginPath(); c.moveTo(-7, -2); c.lineTo(7, -2); c.lineTo(6, -20); c.lineTo(-6, -20); c.closePath(); fillOut(c, grad(c, 0, -20, 0, 0, s.metal, .3, -.25), 1.8);
    c.beginPath(); c.arc(0, -27, 7.5, 0, 7); fillOut(c, grad(c, 0, -34, 0, -20, s.metal, .3, -.2), 1.8);
    c.fillStyle = '#1b1410'; c.fillRect(1, -28, 7, 2.2);
    c.beginPath(); c.moveTo(-1, -34); c.quadraticCurveTo(-10, -40, -13 + Math.sin(t * 3) * 1.5, -28); c.lineTo(-4, -33); c.closePath(); fillOut(c, s.primary, 1.2);
    limb(c, 5, -16, 12, -10, 5, s.metal);
    c.save(); c.translate(12, -10); weapon(c, 'lance', -.35 + (o.atk ? Math.sin(o.atk * Math.PI) * .6 : 0), s); c.restore();
    c.restore();
  }

  function hulk(c, s, o) {
    const t = o.t, walk = o.walk, step = walk ? Math.sin(t * 9) * 6 : 0, bob = walk ? -Math.abs(Math.sin(t * 9)) * 2 : Math.sin(t * 1.8) * -1.2, k = s.scale || 1;
    c.scale(k, k); c.translate(0, bob);
    const dark = shade(s.primary, -.3);
    if (s.style === 'ent') {
      limb(c, -6, -18, -7 + step, -1, 9, dark); limb(c, 6, -18, 7 - step, -1, 9, dark);
      c.beginPath(); c.moveTo(-12, -42); c.quadraticCurveTo(-16, -22, -10, -14); c.lineTo(10, -14); c.quadraticCurveTo(16, -22, 12, -42); c.closePath(); fillOut(c, grad(c, -12, -42, 12, -14, s.primary, .2, -.35), 2);
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.4; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-8 + i * 5, -40); c.quadraticCurveTo(-10 + i * 5, -28, -8 + i * 5, -16); c.stroke(); }
      limb(c, -12, -38, -24, -26 + Math.sin(t * 2) * 2, 6, s.primary); limb(c, 12, -38, 22, -30 + (o.atk ? Math.sin(o.atk * Math.PI) * -10 : 0), 6, s.primary);
      c.beginPath(); ell(c, 0, -52, 12, 11); fillOut(c, grad(c, 0, -62, 0, -42, s.primary, .2, -.3), 2);
      c.fillStyle = s.accent; c.shadowColor = s.accent; c.shadowBlur = 6; c.beginPath(); c.arc(-4, -53, 2, 0, 7); c.arc(4, -53, 2, 0, 7); c.fill(); c.shadowBlur = 0;
      for (const [bx, by, br] of [[-14, -60, 11], [0, -68, 13], [14, -60, 11], [-6, -62, 9], [8, -64, 9]]) { c.beginPath(); c.arc(bx + Math.sin(t * 1.5 + bx) * 1.2, by, br, 0, 7); fillOut(c, bx % 2 ? s.secondary : shade(s.secondary, -.2), 1.4); }
      return;
    }
    const golem = s.style === 'golem';
    limb(c, -7, -18, -8 + step, -1, 10, dark); limb(c, 7, -18, 8 - step, -1, 10, dark);
    c.beginPath(); c.moveTo(-14, -42); c.lineTo(14, -42); c.lineTo(11, -14); c.lineTo(-11, -14); c.closePath(); fillOut(c, grad(c, -14, -42, 14, -14, s.primary, .22, -.3), 2);
    if (golem) { c.strokeStyle = s.accent; c.shadowColor = s.accent; c.shadowBlur = 6; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, -38); c.lineTo(-2, -30); c.lineTo(-8, -24); c.moveTo(6, -36); c.lineTo(3, -26); c.lineTo(8, -20); c.stroke(); c.shadowBlur = 0; }
    else { c.fillStyle = s.secondary; c.fillRect(-12, -24, 24, 5); c.fillStyle = s.accent; c.fillRect(-11, -42, 5, 8); }
    limb(c, -13, -38, -22, -24, 9, s.primary);
    c.beginPath(); c.arc(0, -48, golem ? 9 : 8, 0, 7); fillOut(c, grad(c, 0, -56, 0, -40, s.primary, .25, -.25), 2);
    c.fillStyle = golem ? s.accent : '#2a1a10'; if (golem) { c.shadowColor = s.accent; c.shadowBlur = 6; } c.beginPath(); c.arc(3, -49, 1.8, 0, 7); c.arc(-1, -49, 1.8, 0, 7); c.fill(); c.shadowBlur = 0;
    if (!golem) { c.fillStyle = '#e9e2cf'; c.beginPath(); c.moveTo(-4, -43); c.lineTo(-2, -39); c.lineTo(0, -43); c.moveTo(2, -43); c.lineTo(4, -39); c.lineTo(6, -43); c.fill(); }
    c.save(); c.translate(13, -36); limb(c, 0, 0, 8, 8, 9, s.primary); c.translate(8, 8); if (!golem) weapon(c, 'club', -1.2 + (o.atk ? Math.sin(o.atk * Math.PI) * 2.2 : Math.sin(t * 2) * .05), s); c.restore();
  }

  function wyrm(c, s, o) {
    const t = o.t, k = s.scale || 1; c.scale(k, k); c.translate(0, -16 + Math.sin(t * 2) * -3);
    const flap = Math.sin(t * 4);
    const wingD = (sg) => { c.save(); c.translate(-2, -14); c.rotate(sg * flap * .22); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-22, -34, -34, -26 + flap * 6); c.quadraticCurveTo(-26, -14, -34, -6); c.quadraticCurveTo(-18, -8, -14, 4); c.quadraticCurveTo(-8, -2, 0, 6); c.closePath(); fillOut(c, grad(c, 0, -34, 0, 6, s.primary, .1, -.35), 2); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.6; for (const [ex, ey] of [[-26, -22], [-30, -12], [-20, -2]]) { c.beginPath(); c.moveTo(0, 0); c.lineTo(ex, ey); c.stroke(); } c.restore(); };
    wingD(-1);
    // cauda sinuosa
    c.beginPath(); c.moveTo(-6, 6); for (let i = 0; i <= 8; i++) c.lineTo(-6 - i * 4.5, 6 + Math.sin(t * 3 + i * .8) * 4 + i * 1.2); for (let i = 8; i >= 0; i--) c.lineTo(-6 - i * 4.5, 12 + Math.sin(t * 3 + i * .8) * 4 + i * 1.2 - i * .6); c.closePath(); fillOut(c, s.primary, 1.8);
    ell(c, 0, -2, 18, 12, -.15); fillOut(c, grad(c, 0, -14, 0, 10, s.primary, .2, -.3), 2);
    ell(c, 3, 3, 12, 7, -.15); c.fillStyle = s.secondary; c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; for (let i = -3; i < 4; i++) { c.beginPath(); c.moveTo(3 + i * 3.4, -3); c.lineTo(3 + i * 3.4, 9); c.stroke(); }
    // pescoço e cabeça
    c.beginPath(); c.moveTo(10, -8); c.quadraticCurveTo(22, -26, 26, -30); c.lineTo(34, -26); c.quadraticCurveTo(26, -10, 14, 2); c.closePath(); fillOut(c, s.primary, 1.8);
    c.save(); c.translate(32, -30); ell(c, 0, 0, 10, 7, -.1); fillOut(c, grad(c, 0, -7, 0, 7, s.primary, .2, -.25), 1.8); c.beginPath(); c.moveTo(6, -3); c.lineTo(18, 0); c.lineTo(6, 4); c.closePath(); fillOut(c, s.primary, 1.6);
    c.fillStyle = '#e9e2cf'; c.beginPath(); c.moveTo(9, 2); c.lineTo(11, 6); c.lineTo(13, 2); c.fill();
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(-4, -5); c.quadraticCurveTo(-12, -16 * sg * sg, -16, -12 + sg * 2); c.lineTo(-6, -3); c.closePath(); fillOut(c, '#e9d9b0', 1.2); break; }
    c.fillStyle = s.accent; c.shadowColor = s.accent; c.shadowBlur = 8; c.beginPath(); c.arc(2, -2, 2.2, 0, 7); c.fill(); c.shadowBlur = 0;
    const fire = (Math.sin(t * 7) + 1) / 2; c.fillStyle = `rgba(255,${150 + fire * 80},60,${.35 + fire * .35})`; c.beginPath(); c.arc(19, 0, 3 + fire * 3, 0, 7); c.fill();
    c.restore();
    wingD(1);
  }

  // Desenha qualquer unidade. (x,y) = pés. o: { t, walk, atk, flip, alpha, size }
  function drawUnit(c, id, x, y, o) {
    const s = UNITS[id].art, fly = UNITS[id].fly;
    c.save();
    c.globalAlpha = o.alpha == null ? 1 : o.alpha;
    // sombra
    c.fillStyle = 'rgba(0,0,0,.3)'; const sc = (s.scale || 1); ell(c, x, y + 1, 16 * sc * (fly ? .7 : 1), 5 * sc); c.fill();
    c.translate(x, y); if (o.flip) c.scale(-1, 1);
    const fn = { human, beast, bird, pixie, wraith, rider, hulk, wyrm }[s.kind];
    fn(c, s, o);
    c.restore();
  }

  // Herói no mapa de aventura: cavaleiro montado nas cores da facção.
  function drawHero(c, heroId, x, y, o) {
    const h = HEROES[heroId], a = h.art, spec = { kind: 'rider', primary: a.primary, secondary: a.secondary, metal: a.metal, horse: heroId === 'alba' ? '#8a6a46' : '#4a3a30', scale: 1.05 };
    c.save(); c.fillStyle = 'rgba(0,0,0,.3)'; ell(c, x, y + 1, 18, 6); c.fill(); c.translate(x, y); if (o.flip) c.scale(-1, 1); rider(c, spec, o); c.restore();
  }

  // Retrato de herói (busto) para o painel.
  function drawHeroPortrait(c, hero, w, h, t) {
    const a = hero.art, bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#31404f'); bg.addColorStop(1, '#171d25');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w / 2, h * .99); c.scale(h / 108, h / 108);
    human(c, Object.assign({ weapon: null, scale: 1.5 }, a), { t: t || 0, walk: false });
    c.restore();
  }

  function drawUnitIcon(c, id, w, h, t) {
    c.clearRect(0, 0, w, h); const sc = Math.min(w, h) / 64, fly = UNITS[id].fly;
    drawUnit(c, id, w / 2, h * .86 - (fly ? 0 : 0), { t: t || 0, walk: false, flip: false, alpha: 1 }); void sc;
  }

  return { buildTerrain, ripplePattern, treeSprite, mountainSprite, objectSprite, drawUnit, drawHero, drawHeroPortrait, drawUnitIcon, hash, fbm, vnoise, mk, ell, rr, shade, hex2rgb };
})();
