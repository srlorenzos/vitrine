'use strict';
// Coroa de Brasas — combate tático por iniciativa: grade 14×9, animações, magias, status e IA.
// Interface com game.js: Battle.start(groups, opts) → Promise<{lost, army, xp, reward}>, Battle.update/draw/click/hover/key.

const Battle = (() => {
  const COLS = 14, ROWS = 9, CS = 56, OX = (960 - COLS * CS) / 2, OY = 46;
  const cellX = x => OX + x * CS + CS / 2, cellY = y => OY + y * CS + CS * 0.84;
  const inGrid = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
  const key = (x, y) => x + ',' + y;
  let B = null, anims = [], idc = 1;
  const api = { active: false, fast: false };

  /* ---------- animação por tweens (Promise) ---------- */
  const anim = (dur, fn) => new Promise(res => { if (api.fast) { fn(1); return res(); } anims.push({ t: 0, dur, fn, res }); });
  const wait = ms => anim(ms / 1000, () => { });
  api.update = dt => {
    for (const a of anims) { a.t += dt; a.fn(Math.min(1, a.t / a.dur)); }
    const done = anims.filter(a => a.t >= a.dur); anims = anims.filter(a => a.t < a.dur); done.forEach(a => a.res());
    if (!B) return;
    for (const u of B.units) { if (u.hurt > 0) u.hurt = Math.max(0, u.hurt - dt * 3); if (u.dead && u.fade > 0) u.fade = Math.max(0, u.fade - dt * 2.2); }
  };

  /* ---------- estatísticas efetivas ---------- */
  const U = u => UNITS[u.u];
  const stat = (u, k) => (k === 'att' ? U(u).att + (u.side === 0 ? hs('att') : 0) : k === 'def' ? U(u).def + (u.side === 0 ? hs('def') : 0) + (u.def ? 3 : 0) : U(u)[k]) + u.fx.reduce((s, f) => s + (f[k] || 0), 0);
  const speedOf = u => Math.max(1, stat(u, 'speed')), initOf = u => stat(u, 'init');
  const totalHp = u => (u.count - 1) * U(u).hp + u.topHp;
  const alive = () => B.units.filter(u => !u.dead);
  const foesOf = u => alive().filter(x => x.side !== u.side);
  const at = (x, y) => alive().find(u => u.x === x && u.y === y);
  const free = (x, y) => inGrid(x, y) && !B.obst.has(key(x, y)) && !at(x, y);
  const cheb2 = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  /* ---------- movimento ---------- */
  function reach(u) {
    const sp = speedOf(u), res = new Map([[key(u.x, u.y), { d: 0, prev: null }]]);
    if (U(u).fly) { for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const d = cheb2(u, { x, y }); if (d > 0 && d <= sp && free(x, y)) res.set(key(x, y), { d, prev: key(u.x, u.y) }); } return res; }
    const q = [{ x: u.x, y: u.y }];
    for (let i = 0; i < q.length; i++) { const c = q[i], d = res.get(key(c.x, c.y)).d; if (d >= sp) continue;
      for (const [dx, dy] of DIRS) { const nx = c.x + dx, ny = c.y + dy, k = key(nx, ny); if (!res.has(k) && free(nx, ny)) { res.set(k, { d: d + 1, prev: key(c.x, c.y) }); q.push({ x: nx, y: ny }); } } }
    return res;
  }
  const pathTo = (r, x, y) => { const p = []; let k = key(x, y); while (k && r.get(k) && r.get(k).prev) { const [cx, cy] = k.split(',').map(Number); p.unshift({ x: cx, y: cy }); k = r.get(k).prev; } return p; };

  async function moveUnit(u, tx, ty, r) {
    const path = pathTo(r, tx, ty); if (!path.length) return; u.moved = path.length;
    u.walk = true;
    for (const p of path) {
      const fx = u.px, fy = u.py, nx = cellX(p.x), ny = cellY(p.y); if (nx !== fx) u.face = nx < fx ? -1 : 1;
      await anim(U(u).fly ? 0.06 : 0.11, k => { u.px = fx + (nx - fx) * k; u.py = fy + (ny - fy) * k; }); u.x = p.x; u.y = p.y; if (!api.fast) Sfx.step();
    }
    u.walk = false;
  }

  /* ---------- dano ---------- */
  function dmgRange(a, d, spellDmg) {
    if (spellDmg) return { min: spellDmg, max: spellDmg, avg: spellDmg };
    const A = U(a), diff = stat(a, 'att') - stat(d, 'def');
    let mult = diff >= 0 ? 1 + Math.min(0.05 * diff, 3) : 1 - Math.min(0.025 * -diff, 0.7);
    if (A.charge && a.moved) mult *= 1 + Math.min(0.05 * a.moved, 0.25);
    const f = r => Math.max(1, Math.floor(a.count * r * mult));
    return { min: f(A.min), max: f(A.max), avg: f((A.min + A.max) / 2) };
  }
  const rollDamage = (a, d, spellDmg) => { if (spellDmg) return spellDmg; const r = dmgRange(a, d), A = U(a); return Math.max(1, Math.floor(r.min + (Math.floor(Math.random() * (A.max - A.min + 1)) / Math.max(1, A.max - A.min)) * (r.max - r.min))); };
  function hit(d, dmg, from) {
    const hp = U(d).hp, before = d.count, total = Math.max(0, totalHp(d) - dmg); d.count = Math.ceil(total / hp); d.topHp = d.count ? total - (d.count - 1) * hp : hp;
    const killed = before - d.count, x = d.px, y = d.py - 44;
    FX.floats.push({ x, y, text: `-${dmg}${killed ? ` (☠${killed})` : ''}`, color: '#ff7a5a', life: 1.2 }); burst(x, y + 16, '#e0483a', 10, 110); FX.shake = Math.max(FX.shake, killed ? 9 : 5); d.hurt = 1; Sfx.hit();
    if (d.count <= 0) { d.dead = true; d.fade = 1; burst(x, y + 20, '#ffd2a0', 18, 120); }
    return killed;
  }
  const lunge = async (a, d) => { const dx = Math.sign(d.px - a.px) || 1; a.face = dx; const ox = a.px, oy = a.py; await anim(0.32, k => { a.atk = k; const s = Math.sin(k * Math.PI); a.px = ox + dx * 16 * s; a.py = oy + Math.sign(d.py - oy) * 6 * s; }); a.px = ox; a.py = oy; a.atk = 0; };

  async function strike(a, d, ranged) {
    if (ranged) {
      a.face = Math.sign(d.px - a.px) || a.face; Sfx.shoot(); const sx = a.px, sy = a.py - 28, ex = d.px, ey = d.py - 24;
      await anim(Math.max(.18, Math.hypot(ex - sx, ey - sy) / 900), k => { B.proj = { x: sx + (ex - sx) * k, y: sy + (ey - sy) * k - Math.sin(k * Math.PI) * 18, ang: Math.atan2(ey - sy, ex - sx), color: '#e8d6a0' }; }); B.proj = null;
      const dm = rollDamage(a, d); const kl = hit(d, dm, a); log(`${U(a).name} atirou em ${U(d).name}: ${dm} de dano, ${kl} baixas.`);
    } else {
      const dm = rollDamage(a, d); await lunge(a, d); const kl = hit(d, dm, a); log(`${U(a).name} atacou ${U(d).name}: ${dm} de dano, ${kl} baixas.`);
      if (!d.dead && d.ctr > 0 && !a.dead) { d.ctr--; await wait(120); const d2 = rollDamage(d, a); await lunge(d, a); const k2 = hit(a, d2, d); log(`  Contra-ataque: ${d2} de dano, ${k2} baixas.`); }
    }
  }

  /* ---------- magias ---------- */
  const spellPower = () => hs('power');
  async function castSpell(id, target, cell) {
    const S = SPELLS[id]; B.mana -= S.cost; B.castUsed = true; Sfx.spell();
    const hx = cellX(0) - 40, hy = OY + CS * 4;
    const bolt = async (to, color, n = 12) => { const tx = to.px, ty = to.py - 28; await anim(.35, k => { B.proj = { x: hx + (tx - hx) * k, y: hy + (ty - hy) * k + Math.sin(k * 20) * 6, ang: 0, color, orb: true }; }); B.proj = null; burst(tx, ty, color, n, 130); };
    const ring = async (to, color) => { await anim(.5, k => { B.rings.push({ x: to.px, y: to.py - 20, r: 8 + k * 46, a: 1 - k, color, f: B.frame }); }); };
    if (S.target === 'enemy' && S.dmg) { await bolt(target, S.color); const dm = S.dmg(spellPower()), kl = hit(target, dm); log(`${S.name} em ${U(target).name}: ${dm} de dano, ${kl} baixas.`); }
    else if (S.target === 'enemy') { await bolt(target, S.color, 8); target.fx.push({ ...S.effect, name: S.name }); await ring(target, S.color); log(`${S.name} afeta ${U(target).name}.`); }
    else if (S.target === 'ally' && S.heal) { await ring(target, S.color); const hp = U(target).hp, healed = Math.min(S.heal(spellPower()), (target.maxCount * hp) - totalHp(target)), tot = totalHp(target) + healed; target.count = Math.ceil(tot / hp); target.topHp = tot - (target.count - 1) * hp; FX.floats.push({ x: target.px, y: target.py - 48, text: `+${Math.round(healed)}`, color: '#7dff9a', life: 1.2 }); log(`${S.name}: ${U(target).name} recupera ${Math.round(healed)} de vida.`); }
    else if (S.target === 'ally') { await ring(target, S.color); target.fx.push({ ...S.effect, name: S.name }); log(`${S.name} protege ${U(target).name}.`); }
    else if (S.target === 'area') {
      const cx = cell.x, cy = cell.y; Sfx.boom();
      for (let i = 0; i < 6; i++) { const rx = cellX(cx + (Math.random() * 3 - 1.5)), ry = cellY(cy + (Math.random() * 3 - 1.5)); const sx = rx + 120, sy = -20; await anim(.12, k => { B.proj = { x: sx + (rx - sx) * k, y: sy + (ry - sy) * k, ang: Math.PI * .75, color: '#ff6a2a', orb: true, big: true }; }); B.proj = null; burst(rx, ry, '#ff8a3a', 14, 150); FX.shake = 10; }
      await anim(.4, k => { B.rings.push({ x: cellX(cx), y: cellY(cy) - 10, r: 10 + k * 90, a: 1 - k, color: '#ff8a3a', f: B.frame }); });
      const dm = S.dmg(spellPower());
      for (const u of alive().filter(u => u.side === 1 && Math.abs(u.x - cx) <= S.radius && Math.abs(u.y - cy) <= S.radius)) { const kl = hit(u, dm); log(`${S.name}: ${dm} em ${U(u).name}, ${kl} baixas.`); }
    }
  }
  const spellTargets = id => { const S = SPELLS[id]; return S.target === 'enemy' ? alive().filter(u => u.side === 1) : S.target === 'ally' ? alive().filter(u => u.side === 0) : []; };

  /* ---------- fluxo do combate ---------- */
  function setup(groups, opts) {
    const units = [], mk = (g, side, x, y, slot) => { const px = cellX(x), py = cellY(y); return { id: idc++, u: g.u, side, count: g.count, maxCount: g.count, topHp: UNITS[g.u].hp, x, y, px, py, ctr: UNITS[g.u].counters || 1, waited: false, def: false, fx: [], dead: false, fade: 1, face: side === 0 ? 1 : -1, walk: false, atk: 0, hurt: 0, moved: 0, slot }; };
    const place = (list, side, x, getSlot) => list.forEach((g, i) => { const y = Math.round((ROWS - 1) / 2 + (i - (list.length - 1) / 2) * 2); units.push(mk(g, side, x, clamp(y, 0, ROWS - 1), getSlot ? i : -1)); });
    place(G.army, 0, 0, true); place(groups, 1, COLS - 1, false);
    const obst = new Set(), R2 = makeRng(((Date.now() % 100000) + 7) | 0), kinds = [];
    for (let i = 0; i < 9; i++) { const x = 3 + Math.floor(R2() * (COLS - 6)), y = Math.floor(R2() * ROWS); if (!units.some(u => u.x === x && u.y === y) && !obst.has(key(x, y))) { obst.add(key(x, y)); kinds.push({ x, y, v: i % 3 }); } }
    const biome = BIOMES[G.mission.biome], bg = Art.mk(960, 600), bx = bg.getContext('2d'), img = bx.createImageData(960, 600), d = img.data, [g0, g1] = biome.ground;
    for (let py = 0; py < 600; py++) for (let px = 0; px < 960; px++) { const n = Art.fbm(px / 40, py / 40, G.seed + 5), n2 = Art.vnoise(px / 4, py / 4, G.seed + 9), v = 0.25 + n * 0.5 + (n2 - .5) * .08, i = (py * 960 + px) * 4, vg = Math.max(0, 1 - Math.hypot(px - 480, py - 300) / 620); d[i] = (g0[0] + (g1[0] - g0[0]) * v) * (0.55 + vg * .45); d[i + 1] = (g0[1] + (g1[1] - g0[1]) * v) * (0.55 + vg * .45); d[i + 2] = (g0[2] + (g1[2] - g0[2]) * v) * (0.55 + vg * .45); d[i + 3] = 255; }
    bx.putImageData(img, 0, 0);
    return { units, obst, obstKinds: kinds, bg, trees: [0, 1, 2].map(i => Art.treeSprite(biome, i)), rocks: [0, 1].map(i => Art.mountainSprite(biome, i)), round: 1, queue: [], cur: null, reach: null, mana: maxMana(), castUsed: false, spell: null, hover: null, busy: true, awaiting: null, auto: false, over: false, proj: null, rings: [], frame: 0, opts, startCost: groups.reduce((s, g) => s + UNITS[g.u].cost.gold * g.count, 0), msg: '', msgT: 0 };
  }

  api.start = (groups, opts = {}) => new Promise(resolve => {
    mode = 'battle'; api.active = true; anims = []; FX.parts = []; FX.floats = [];
    B = setup(groups, opts); B.resolve = resolve; $('side').classList.remove('hide');
    log(opts.boss ? `${opts.name || 'O chefe'} bloqueia o caminho!` : 'Um grupo hostil ataca!', true);
    banner(opts.boss ? 'Batalha final' : 'Batalha!'); refreshUI(); loop();
  });

  const order = () => alive().sort((a, b) => initOf(b) - initOf(a) || a.side - b.side);
  function newRound() {
    B.round++; B.units.forEach(u => { u.ctr = U(u).counters || 1; u.waited = false; u.fx.forEach(f => f.rounds--); u.fx = u.fx.filter(f => f.rounds > 0); });
    B.castUsed = false;
    alive().filter(u => U(u).regen).forEach(u => { const hp = U(u).hp, tot = Math.min(u.maxCount * hp, totalHp(u) + Math.ceil(u.maxCount * hp * .1)); if (tot > totalHp(u)) { u.count = Math.ceil(tot / hp); u.topHp = tot - (u.count - 1) * hp; FX.floats.push({ x: u.px, y: u.py - 48, text: '+regen', color: '#9bd05a', life: 1 }); } });
    B.queue = order();
  }
  const sideAlive = s => alive().some(u => u.side === s);

  async function loop() {
    B.queue = order(); B.busy = false;
    while (!B.over) {
      if (!sideAlive(0) || !sideAlive(1)) break;
      if (!B.queue.length) newRound();
      const u = B.queue.shift(); if (u.dead) continue;
      B.cur = u; u.def = false; u.moved = 0; B.spell = null; B.turnId = (B.turnId || 0) + 1;
      if (u.side === 0 && !B.auto) await playerTurn(u); else await aiTurn(u);
      B.cur = null; B.reach = null; B.busy = false; refreshBattleUI();
      await wait(60);
    }
    await finish();
  }

  function playerTurn(u) {
    return new Promise(res => { B.reach = reach(u); B.awaiting = res; B.busy = false; refreshBattleUI(); });
  }
  const endPlayerTurn = () => { const r = B.awaiting; B.awaiting = null; B.reach = null; if (r) r(); };

  /* ---------- IA ---------- */
  const worth = (a, d) => { const r = dmgRange(a, d), dead = Math.min(r.avg, totalHp(d)) / U(d).hp; return dead * (U(d).cost.gold || 50) * (1 + U(d).tier * .15); };
  async function aiTurn(u) {
    B.busy = true; await wait(260);
    const foes = foesOf(u); if (!foes.length) return;
    const rr = reach(u); let best = null;
    if (U(u).ranged) { for (const f of foes) { const s = worth(u, f); if (!best || s > best.s) best = { s, f, type: 'shoot' }; } }
    else {
      for (const f of foes) {
        let cell = null; if (cheb2(u, f) <= 1) cell = { x: u.x, y: u.y, d: 0 };
        else for (const [k, v] of rr) { const [x, y] = k.split(',').map(Number); if (cheb2({ x, y }, f) === 1 && (!cell || v.d < cell.d)) cell = { x, y, d: v.d }; }
        if (!cell) continue;
        const counter = f.ctr > 0 ? worth(f, u) * .55 : 0, s = worth(u, f) - counter - cell.d * 4; if (!best || s > best.s) best = { s, f, cell, type: 'melee' };
      }
    }
    if (best && best.type === 'shoot') await strike(u, best.f, true);
    else if (best) { if (best.cell.d > 0) await moveUnit(u, best.cell.x, best.cell.y, rr); await strike(u, best.f, false); }
    else { // sem alvo ao alcance: aproxima do inimigo mais perto
      const tgt = foes.sort((a, b) => cheb2(u, a) - cheb2(u, b))[0]; let bestC = null, bd = cheb2(u, tgt);
      for (const [k] of rr) { const [x, y] = k.split(',').map(Number), d = cheb2({ x, y }, tgt) + (Math.abs(y - tgt.y) * .01); if (d < bd) { bd = d; bestC = { x, y }; } }
      if (bestC) await moveUnit(u, bestC.x, bestC.y, rr);
    }
    B.busy = false;
  }

  /* ---------- entrada do jogador ---------- */
  const spellsKnown = () => G.hero.spells.filter(s => SPELLS[s]);
  const canCast = id => B.cur && B.cur.side === 0 && !B.castUsed && B.mana >= SPELLS[id].cost && !B.busy;
  function buttons() {
    const y = OY + ROWS * CS + 8, list = []; let x = 8;
    const add = (id, label, en, w = 84) => { list.push({ id, label, x, y, w, h: 32, en }); x += w + 6; };
    const mine = B.cur && B.cur.side === 0 && !B.busy;
    add('wait', 'Esperar (W)', mine && !B.cur.waited, 90); add('def', 'Defender (D)', mine, 96); add('auto', B.auto ? 'Manual (A)' : 'Auto (A)', true, 84);
    spellsKnown().forEach((s, i) => add('spell:' + s, `${i + 1} ${SPELLS[s].short || SPELLS[s].name} · ${SPELLS[s].cost}`, canCast(s), Math.max(80, (SPELLS[s].short || SPELLS[s].name).length * 7 + 44)));
    return list;
  }
  // Executa uma ação do jogador. O "ocupado" só é liberado se ainda for o mesmo turno (evita liberar durante o turno da IA).
  async function act(fn) { if (B.busy) return; const tid = B.turnId; B.busy = true; try { await fn(); } finally { if (B && B.turnId === tid) B.busy = false; } }
  const cellOf = (px, py) => ({ x: Math.floor((px - OX) / CS), y: Math.floor((py - OY) / CS) });

  api.click = (px, py) => {
    if (!B || B.over) return;
    const btn = buttons().find(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
    if (btn) { if (btn.id === 'auto') { B.auto = !B.auto; if (B.auto && B.awaiting && !B.busy) { const r = B.awaiting; B.awaiting = null; B.reach = null; r(); } refreshBattleUI(); Sfx.click(); return; } if (!btn.en) return; Sfx.click(); return doButton(btn.id); }
    const u = B.cur, c = cellOf(px, py); if (!u || u.side !== 0 || B.busy || !inGrid(c.x, c.y)) return;
    const t = at(c.x, c.y);
    if (B.spell) {
      const S = SPELLS[B.spell];
      if (S.target === 'area') { const id = B.spell; B.spell = null; return act(async () => { await castSpell(id, null, c); afterAction(); }); }
      if (t && spellTargets(B.spell).includes(t)) { const id = B.spell; B.spell = null; return act(async () => { await castSpell(id, t); afterAction(); }); }
      B.spell = null; return; // clicou fora: cancela
    }
    if (t && t.side === 1) return act(async () => {
      if (U(u).ranged) await strike(u, t, true);
      else {
        let cell = null; if (cheb2(u, t) <= 1) cell = { x: u.x, y: u.y };
        else for (const [k, v] of B.reach) { const [x, y] = k.split(',').map(Number); if (cheb2({ x, y }, t) === 1 && (!cell || v.d < cell.d)) cell = { x, y, d: v.d }; }
        if (!cell) { say('Fora de alcance.'); return; }
        if (cell.x !== u.x || cell.y !== u.y) await moveUnit(u, cell.x, cell.y, B.reach);
        await strike(u, t, false);
      }
      endPlayerTurn();
    });
    if (!t && B.reach && B.reach.has(key(c.x, c.y)) && B.reach.get(key(c.x, c.y)).d > 0) return act(async () => { await moveUnit(u, c.x, c.y, B.reach); endPlayerTurn(); });
  };
  const afterAction = () => { refreshBattleUI(); };
  function doButton(id) {
    const u = B.cur; if (!u) return;
    if (id === 'wait') { u.waited = true; B.queue.push(u); endPlayerTurn(); }
    else if (id === 'def') { u.def = true; log(`${U(u).name} defende (+3 DEF).`); endPlayerTurn(); }
    else if (id.startsWith('spell:')) { const s = id.slice(6); B.spell = B.spell === s ? null : s; say(B.spell ? `${SPELLS[s].name}: escolha ${SPELLS[s].target === 'area' ? 'o centro da área' : 'o alvo'}.` : ''); }
  }
  api.key = e => {
    if (!B || B.over) return; const k = e.key.toLowerCase();
    if (k === 'escape') { B.spell = null; say(''); return; }
    const map = { w: 'wait', d: 'def' }; if (map[k]) { const b = buttons().find(x => x.id === map[k]); if (b && b.en) doButton(b.id); return; }
    if (k === 'a') { api.click(buttons().find(x => x.id === 'auto').x + 4, OY + ROWS * CS + 10); return; }
    if (/^[1-5]$/.test(k)) { const s = spellsKnown()[+k - 1]; if (s && canCast(s)) doButton('spell:' + s); }
  };
  api.hover = (px, py) => { if (!B) return; B.hover = px < 0 ? null : cellOf(px, py); const cv = $('cv'); const t = B.hover && at(B.hover.x, B.hover.y); cv.style.cursor = B.cur && B.cur.side === 0 && !B.busy ? (B.spell ? 'crosshair' : t && t.side === 1 ? (U(B.cur).ranged ? 'crosshair' : 'pointer') : B.reach && B.hover && B.reach.has(key(B.hover.x, B.hover.y)) ? 'pointer' : 'default') : 'default'; };
  const say = m => { B.msg = m; B.msgT = 3; };
  function refreshBattleUI() { /* o desenho lê o estado a cada quadro */ }

  /* ---------- fim ---------- */
  async function finish() {
    B.over = true; B.cur = null; B.reach = null; const won = sideAlive(0);
    won ? Sfx.win() : Sfx.lose(); banner(won ? 'Vitória!' : 'Derrota…'); await wait(1300);
    const army = []; if (won) G.army.forEach((s, i) => { const u = B.units.find(x => x.side === 0 && x.slot === i && !x.dead); if (u) army.push({ u: s.u, count: u.count }); });
    const xp = Math.floor(B.startCost / 6), reward = won ? Math.floor(B.startCost * .3) + (B.opts.reward || 0) : 0;
    api.active = false; const res = B.resolve; B = null; anims = []; mode = won ? 'busy' : 'busy'; $('tip').style.display = 'none'; refreshUI();
    res({ lost: !won, army, xp: won ? xp : 0, reward });
  }
  api.abort = () => { if (!B) return; B.over = true; if (B.awaiting) { const r = B.awaiting; B.awaiting = null; r(); } };
  api._t = { state: () => B, cellX, cellY, cast: (id, target, cell) => castSpell(id, target, cell), dmgRange, reach, buttons: () => buttons(), at }; // ganchos para os testes

  /* ---------- desenho ---------- */
  const isAttackable = u => B && B.cur && B.cur.side === 0 && !B.busy && u.side === 1 && !B.spell && (U(B.cur).ranged || cheb2(B.cur, u) <= 1 || (B.reach && [...B.reach.keys()].some(k => { const [x, y] = k.split(',').map(Number); return cheb2({ x, y }, u) === 1; })));
  api.draw = () => {
    if (!B) return; const c = ctx; B.frame++;
    c.save(); const sh = FX.shake > 0 ? [(Math.random() - .5) * FX.shake, (Math.random() - .5) * FX.shake] : [0, 0]; c.translate(sh[0], sh[1]);
    c.drawImage(B.bg, 0, 0);
    // grade
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const px = OX + x * CS, py = OY + y * CS; c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; c.strokeRect(px + .5, py + .5, CS - 1, CS - 1);
      if (B.reach && B.reach.has(key(x, y)) && B.reach.get(key(x, y)).d > 0 && !B.spell) { c.fillStyle = 'rgba(255,200,90,.16)'; c.fillRect(px + 1, py + 1, CS - 2, CS - 2); }
    }
    // alcance de magia em área / alvo
    if (B.spell && B.hover && inGrid(B.hover.x, B.hover.y)) { const S = SPELLS[B.spell]; c.fillStyle = 'rgba(255,90,40,.22)'; if (S.target === 'area') for (let dy = -S.radius; dy <= S.radius; dy++) for (let dx = -S.radius; dx <= S.radius; dx++) { const x = B.hover.x + dx, y = B.hover.y + dy; if (inGrid(x, y)) c.fillRect(OX + x * CS + 1, OY + y * CS + 1, CS - 2, CS - 2); } }
    if (B.hover && inGrid(B.hover.x, B.hover.y)) { c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.strokeRect(OX + B.hover.x * CS + 1, OY + B.hover.y * CS + 1, CS - 2, CS - 2); }
    // objetos + unidades ordenados por y
    const list = [];
    B.obstKinds.forEach(o => list.push({ y: cellY(o.y), f: () => o.v === 2 ? c.drawImage(B.rocks[o.v % 2], cellX(o.x) - 34, cellY(o.y) - 62, 68, 76) : c.drawImage(B.trees[o.v], cellX(o.x) - 30, cellY(o.y) - 72, 60, 78) }));
    B.units.forEach(u => { if (u.dead && u.fade <= 0) return; list.push({ y: u.py, f: () => drawStack(u) }); });
    list.sort((a, b) => a.y - b.y).forEach(i => i.f());
    // projétil, anéis, partículas
    if (B.proj) { const p = B.proj; if (p.orb) { const g = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.big ? 16 : 11); g.addColorStop(0, '#fff'); g.addColorStop(.4, p.color); g.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.big ? 16 : 11, 0, 7); c.fill(); } else { c.save(); c.translate(p.x, p.y); c.rotate(p.ang); c.strokeStyle = '#3a2a18'; c.lineWidth = 2; c.beginPath(); c.moveTo(-10, 0); c.lineTo(8, 0); c.stroke(); c.fillStyle = '#d6dde4'; c.beginPath(); c.moveTo(8, -3); c.lineTo(14, 0); c.lineTo(8, 3); c.fill(); c.restore(); } }
    B.rings = B.rings.filter(r => r.f >= B.frame - 1); B.rings.forEach(r => { c.strokeStyle = r.color; c.globalAlpha = Math.max(0, r.a); c.lineWidth = 3; c.beginPath(); c.ellipse(r.x, r.y, r.r, r.r * .45, 0, 0, 7); c.stroke(); }); c.globalAlpha = 1;
    drawFx(); c.restore();
    drawHud();
  };

  function drawStack(u) {
    const c = ctx, sc = 1.1; c.save(); c.globalAlpha = u.dead ? u.fade : 1;
    if (u === B.cur) { c.strokeStyle = u.side === 0 ? '#ffd24a' : '#ff6a5a'; c.lineWidth = 2.5; c.globalAlpha *= .5 + Math.sin(T * 6) * .3 + .3; c.beginPath(); c.ellipse(u.px, u.py + 1, 25, 9, 0, 0, 7); c.stroke(); c.globalAlpha = u.dead ? u.fade : 1; }
    if (isAttackable(u)) { c.strokeStyle = '#ff5a4a'; c.lineWidth = 2; c.beginPath(); c.ellipse(u.px, u.py + 1, 27, 10, 0, 0, 7); c.stroke(); }
    if (B.spell && spellTargets(B.spell).includes(u)) { c.strokeStyle = SPELLS[B.spell].color; c.lineWidth = 2.5; c.beginPath(); c.ellipse(u.px, u.py + 1, 27, 10, 0, 0, 7); c.stroke(); }
    c.translate(u.px, u.py); c.scale(sc, sc); c.translate(-u.px, -u.py);
    const hurtFlash = u.hurt > 0 ? u.hurt : 0; if (hurtFlash) c.filter = `brightness(${1 + hurtFlash * 1.2}) saturate(${1 - hurtFlash * .5})`;
    Art.drawUnit(c, u.u, u.px, u.py, { t: T + u.id, walk: u.walk, atk: u.atk, flip: u.face < 0 });
    c.filter = 'none'; c.restore();
    if (u.dead) return;
    // plaquinha de quantidade + barra de vida do topo
    const bx = u.px, by = u.py + 6; c.font = 'bold 12px "Segoe UI", sans-serif'; c.textAlign = 'center'; const w = Math.max(24, String(u.count).length * 9 + 12);
    c.fillStyle = u.side === 0 ? 'rgba(30,70,130,.92)' : 'rgba(130,40,36,.92)'; Art.rr(c, bx - w / 2, by, w, 17, 5); c.fill(); c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(u.count, bx, by + 9);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(bx - 17, by + 19, 34, 4); c.fillStyle = u.topHp / U(u).hp > .5 ? '#6fd36f' : u.topHp / U(u).hp > .25 ? '#e8c04a' : '#e0583a'; c.fillRect(bx - 17, by + 19, 34 * u.topHp / U(u).hp, 4);
    u.fx.forEach((f, i) => { c.font = '12px sans-serif'; c.fillText(f.name === 'Lentidão' ? '❄' : '🛡', bx - 19 + i * 13, by - 52 - (U(u).art.scale > 1.3 ? 14 : 0)); });
    if (u.waited) { c.font = '11px sans-serif'; c.fillStyle = '#ffd24a'; c.fillText('⏳', bx + 22, by - 40); }
    if (u.def) { c.font = '11px sans-serif'; c.fillText('🛡', bx + 22, by - 28); }
  }

  function drawHud() {
    const c = ctx;
    // barra superior: rodada, mana e ordem de iniciativa
    c.fillStyle = 'rgba(8,10,14,.82)'; c.fillRect(0, 0, 960, 40); c.font = 'bold 13px "Segoe UI", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#e8d6a0'; c.fillText(`Rodada ${B.round}`, 14, 14); c.fillStyle = '#7ab8ff'; c.fillText(`✨ ${B.mana}/${maxMana()}`, 14, 30);
    const q = [B.cur, ...B.queue].filter(u => u && !u.dead).slice(0, 14);
    q.forEach((u, i) => { const x = 130 + i * 54, y = 20; c.fillStyle = u.side === 0 ? '#2b4f86' : '#86302b'; c.strokeStyle = i === 0 ? '#ffd24a' : 'rgba(255,255,255,.25)'; c.lineWidth = i === 0 ? 2.5 : 1; Art.rr(c, x - 22, 3, 44, 34, 6); c.fill(); c.stroke(); c.save(); c.beginPath(); c.rect(x - 21, 4, 42, 32); c.clip(); c.translate(x, 36); c.scale(.55, .55); Art.drawUnit(c, u.u, 0, 0, { t: 1, walk: false, flip: u.side === 1 }); c.restore(); });
    // barra inferior: botões + informações
    c.fillStyle = 'rgba(8,10,14,.88)'; c.fillRect(0, OY + ROWS * CS, 960, 600 - OY - ROWS * CS);
    c.font = '13px "Segoe UI", sans-serif'; c.textBaseline = 'middle';
    buttons().forEach(b => { const active = b.id.startsWith('spell:') && B.spell === b.id.slice(6) || (b.id === 'auto' && B.auto); c.globalAlpha = b.en ? 1 : .4; c.fillStyle = active ? '#c9572b' : '#2a3140'; Art.rr(c, b.x, b.y, b.w, b.h, 8); c.fill(); c.strokeStyle = active ? '#ffd24a' : '#4a5468'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#f1e6d6'; c.textAlign = 'center'; c.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2); c.globalAlpha = 1; });
    // quem está sob o cursor
    const hu = B.hover && inGrid(B.hover.x, B.hover.y) ? at(B.hover.x, B.hover.y) : null;
    if (hu) {
      const U0 = U(hu), r = B.cur && B.cur.side === 0 && hu.side === 1 && !B.busy ? dmgRange(B.cur, hu) : null, px = Math.min(960 - 330, Math.max(8, cellX(hu.x) + 34)), py = Math.max(46, cellY(hu.y) - 130);
      c.fillStyle = 'rgba(14,17,24,.95)'; Art.rr(c, px, py, 322, r ? 104 : 90, 9); c.fill(); c.strokeStyle = hu.side === 0 ? '#3f78c4' : '#c4483f'; c.lineWidth = 1.5; c.stroke(); c.textAlign = 'left'; c.fillStyle = '#f1e6d6'; c.font = 'bold 14px "Segoe UI", sans-serif'; c.fillText(`${hu.count}× ${U0.name}`, px + 12, py + 16);
      c.font = '12.5px "Segoe UI", sans-serif'; c.fillStyle = '#bfc8d6'; c.fillText(`PV ${U0.hp} (topo ${hu.topHp}) · ATQ ${stat(hu, 'att')} · DEF ${stat(hu, 'def')} · Dano ${U0.min}-${U0.max}`, px + 12, py + 38); c.fillText(`Vel ${speedOf(hu)} · Ini ${initOf(hu)}${U0.ranged ? ' · Distância' : ''}${U0.fly ? ' · Voa' : ''}${U0.regen ? ' · Regenera' : ''}${U0.charge ? ' · Investida' : ''}`, px + 12, py + 56); c.fillText(hu.fx.length ? 'Efeitos: ' + hu.fx.map(f => f.name + ` (${f.rounds})`).join(', ') : U0.desc || '', px + 12, py + 74);
      if (r) { const kills = Math.min(hu.count, Math.floor(r.avg / U0.hp)); c.fillStyle = '#ffb27a'; c.fillText(`Seu golpe: ${r.min}–${r.max} de dano (~${kills} baixa${kills === 1 ? '' : 's'})`, px + 12, py + 92); }
    }
    if (B.msgT > 0) { B.msgT -= 1 / 60; c.textAlign = 'center'; c.fillStyle = 'rgba(0,0,0,.7)'; Art.rr(c, 330, 52, 300, 28, 8); c.fill(); c.fillStyle = '#ffd24a'; c.font = '14px "Segoe UI", sans-serif'; c.fillText(B.msg, 480, 66); }
    if (B.cur && B.cur.side === 0 && !B.busy && !B.over) { c.textAlign = 'center'; c.fillStyle = 'rgba(0,0,0,.55)'; Art.rr(c, 380, OY + 4, 200, 24, 8); c.fill(); c.fillStyle = '#ffd24a'; c.font = 'bold 13px "Segoe UI", sans-serif'; c.fillText(`Sua vez: ${U(B.cur).name}`, 480, OY + 17); }
  }
  return api;
})();
