'use strict';
// Núcleo: estado, geração de mapas, mapa de aventura, herói, cidade, UI e laço principal.
// O combate fica em battle.js.

const VW = 960, VH = 600, TS = 48;
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const pick = (arr, R) => arr[Math.floor(R() * arr.length)];
const makeRng = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const fmt = n => Math.round(n).toLocaleString('pt-BR');
const costStr = c => Object.entries(c).map(([k, v]) => `${fmt(v)} ${RES_NAME[k].toLowerCase()}`).join(', ') || 'grátis';

let mode = 'menu';   // 'menu' | 'map' | 'battle' | 'busy'
let G = null;        // campanha/missão em andamento
let T = 0;           // tempo (s)
const FX = { parts: [], floats: [], shake: 0 };

/* ======================= Som ======================= */
const Sfx = (() => {
  let ac = null, muted = false;
  const ensure = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { } } if (ac && ac.state === 'suspended') ac.resume(); return ac; };
  function tone(f0, f1, dur, type = 'square', vol = .05, delay = 0) {
    if (muted) return; const a = ensure(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + delay; o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur);
  }
  function noise(dur, vol = .08) {
    if (muted) return; const a = ensure(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), g = a.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(a.destination); s.start();
  }
  return {
    setMuted(m) { muted = m; }, isMuted: () => muted,
    unlock: ensure, click: () => tone(660, 880, .06, 'triangle', .04),
    hit: () => { noise(.12, .1); tone(180, 60, .12, 'sawtooth', .05); }, shoot: () => tone(1000, 300, .12, 'triangle', .05),
    spell: () => { tone(300, 1400, .35, 'sine', .06); noise(.2, .04); }, coin: () => { tone(880, 1320, .09, 'square', .035); tone(1320, 1760, .12, 'square', .035, .08); },
    step: () => noise(.025, .015), boom: () => { noise(.35, .16); tone(120, 40, .35, 'sawtooth', .06); },
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, .22, 'triangle', .06, i * .14)), lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, f, .3, 'sawtooth', .04, i * .2)),
  };
})();

/* ======================= Perfil e save ======================= */
const PKEY = 'coroa.v2';
let profile = { done: [], carry: null, faction: 'ordem', muted: false, save: null };
try { Object.assign(profile, JSON.parse(localStorage.getItem(PKEY) || '{}')); } catch { }
const saveProfile = () => { try { localStorage.setItem(PKEY, JSON.stringify(profile)); } catch { } };
Sfx.setMuted(!!profile.muted);

/* ======================= Herói ======================= */
function newHero(hid, carry) {
  const base = HEROES[hid];
  if (carry && carry.hero && carry.hero.id === hid) return Object.assign({}, carry.hero, { x: 0, y: 0 });
  return { id: hid, name: base.name, att: base.att, def: base.def, power: base.power, knowledge: base.knowledge, logistics: 0, level: 1, xp: 0, spells: [...base.spells], items: [], x: 0, y: 0, mp: 0, mana: 0 };
}
const itemSum = (h, k) => h.items.reduce((s, id) => s + (ITEMS[id][k] || 0), 0);
const hs = k => G.hero[k] + itemSum(G.hero, k);                     // atributo total
const maxMp = () => 16 + G.hero.logistics * 2 + itemSum(G.hero, 'mp');
const maxMana = () => 10 + 5 * hs('knowledge');

function gainXp(n) {
  const h = G.hero; h.xp += n; const pend = [];
  while (h.xp >= LEVEL_XP(h.level)) { h.xp -= LEVEL_XP(h.level); h.level++; pend.push(h.level); }
  return pend.length;
}
function levelUpChoices() {
  const R = makeRng((Math.random() * 1e9) | 0), opts = [
    { k: 'att', t: '+1 Ataque', i: '⚔' }, { k: 'def', t: '+1 Defesa', i: '🛡' }, { k: 'power', t: '+1 Poder Mágico', i: '✦' },
    { k: 'knowledge', t: '+1 Conhecimento (mais mana)', i: '📖' }, { k: 'logistics', t: '+1 Logística (mais movimento)', i: '➤' },
  ];
  const left = Object.keys(SPELLS).filter(s => !G.hero.spells.includes(s));
  if (left.length) opts.push({ k: 'spell', t: 'Aprender magia: ' + SPELLS[left[0]].name, i: '✨', spell: left[0] });
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return opts.slice(0, 3);
}

/* ======================= Geração de mapa ======================= */
function bfsDist(tiles, W, H, from) {
  const d = new Map([[from.x + ',' + from.y, 0]]), q = [from];
  for (let i = 0; i < q.length; i++) {
    const c = q[i], dd = d.get(c.x + ',' + c.y);
    for (const [dx, dy] of DIRS) {
      const nx = c.x + dx, ny = c.y + dy, k = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || d.has(k) || tiles[ny][nx] !== 0) continue;
      d.set(k, dd + 1); q.push({ x: nx, y: ny });
    }
  }
  return d;
}

function genMap(m, fid) {
  const R = makeRng(m.seed * 7919 + 13), W = m.w, H = m.h, S = m.seed, biome = BIOMES[m.biome], fac = FACTIONS[fid];
  const tiles = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) return 2;
    if (Art.fbm(x / 5.5, y / 5.5, S) > 0.66) return 2;
    if (Art.fbm(x / 4 + 40, y / 4, S + 9) > 0.74) return 3;
    if (Art.fbm(x / 3.2 + 20, y / 3.2, S + 5) > 0.63) return 1;
    return 0;
  }));
  const start = { x: 2, y: Math.floor(H / 2) }, goal = { x: W - 3, y: Math.floor(H / 2) };
  const clear = (c, r) => { for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) if (x > 0 && y > 0 && x < W - 1 && y < H - 1) tiles[y][x] = 0; };
  clear(start, 2); clear(goal, 2);
  // caminho garantido (sinuoso)
  { let x = start.x, y = start.y; while (x < goal.x) { x++; if (R() < .45) y = clamp(y + (R() < .5 ? -1 : 1), 2, H - 3); tiles[y][x] = 0; tiles[y + 1][x] = 0; }
    while (y !== goal.y) { y += y < goal.y ? 1 : -1; tiles[y][x] = 0; } }
  let dist = bfsDist(tiles, W, H, start);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tiles[y][x] === 0 && !dist.has(x + ',' + y)) tiles[y][x] = 1;

  const objects = []; let nid = 1; const taken = new Set();
  const near = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (taken.has((x + dx) + ',' + (y + dy))) return true; return false; };
  const d0 = (x, y) => dist.get(x + ',' + y);
  const cands = []; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (tiles[y][x] === 0 && d0(x, y) !== undefined) cands.push({ x, y, d: d0(x, y) });
  const maxD = Math.max(...cands.map(c => c.d));
  function put(o, minF = 0, maxF = 1) {
    const pool = cands.filter(c => c.d >= 3 && c.d / maxD >= minF && c.d / maxD <= maxF && !near(c.x, c.y));
    if (!pool.length) return null; const c = pick(pool, R); taken.add(c.x + ',' + c.y);
    const ob = Object.assign({ id: nid++, x: c.x, y: c.y, d: c.d }, o); objects.push(ob); return ob;
  }
  function groupsFor(Sx) {
    const pool = biome.neutrals.filter(id => UNITS[id].cost.gold * 2.5 <= Sx); const ids = pool.length ? pool : [biome.neutrals[0]];
    const id = pick(ids, R), count = Math.max(2, Math.round(Sx / UNITS[id].cost.gold)), g = [{ u: id, count }];
    if (Sx > 1100 && R() < .5) { const lo = biome.neutrals.filter(i => UNITS[i].tier <= 2); const id2 = pick(lo, R); g.push({ u: id2, count: Math.max(3, Math.round(Sx * .3 / UNITS[id2].cost.gold)) }); }
    return g;
  }
  const strength = (d, mul = 1) => m.diff * mul * (140 + d * 60);
  const guard = (o, mul = 1.3) => { o.guard = { groups: groupsFor(strength(o.d, mul)) }; return o; };

  objects.push({ id: nid++, type: 'town', x: start.x, y: start.y, d: 0, owner: 1 }); taken.add(start.x + ',' + start.y);
  const boss = { id: nid++, type: 'monster', boss: true, name: m.boss.name, x: goal.x, y: goal.y, d: d0(goal.x, goal.y) || maxD, groups: m.boss.groups.map(g => ({ ...g })), reward: m.boss.reward };
  objects.push(boss); taken.add(goal.x + ',' + goal.y);

  for (const kind of ['gold', 'gold', 'wood', 'ore', 'crystal']) { const o = put({ type: 'mine', kind, owner: 0 }, .12, .9); if (o && o.d > 6) guard(o); }
  for (const t of [0, 1]) { const u = fac.units[t]; const o = put({ type: 'dwelling', u, avail: UNITS[u].growth * 2 }, .1, .8); if (o && o.d > 5) guard(o, 1.1); }
  for (let i = 0; i < 11; i++) {
    const kind = pick(['gold', 'gold', 'gold', 'wood', 'ore', 'crystal'], R);
    const amount = { gold: 300 + Math.floor(R() * 5) * 150, wood: 4 + Math.floor(R() * 5), ore: 4 + Math.floor(R() * 5), crystal: 2 + Math.floor(R() * 3) }[kind];
    put({ type: 'pile', kind, amount }, 0, 1);
  }
  for (let i = 0; i < 4; i++) put({ type: 'chest' }, .05, 1);
  for (let i = 0; i < 3; i++) { const o = put({ type: 'artifact', item: pick(Object.keys(ITEMS), R) }, .3, 1); if (o) guard(o, 1.5); }
  for (let i = 0; i < 2; i++) put({ type: 'shrine' }, .15, .9);
  for (let i = 0; i < 2; i++) put({ type: 'fountain' }, .1, 1);
  put({ type: 'sign', text: pick(['“Quem toma a Coroa, carrega o fogo.”', '“Cuidado: o pântano lembra de cada passo.”', '“Mais além, o vento cheira a enxofre.”', '“Ogros pastam onde as árvores terminam.”'], R) }, .1, .6);
  const free = Math.floor(W * H / 24);
  for (let i = 0; i < free; i++) { const c = pick(cands, R); if (c.d < 5 || near(c.x, c.y)) continue; taken.add(c.x + ',' + c.y); objects.push({ id: nid++, type: 'monster', x: c.x, y: c.y, d: c.d, groups: groupsFor(strength(c.d, 1)), reward: 0 }); }
  const heroStart = { x: start.x + 1, y: start.y }; // atenção: NÃO chamar de "hero" (o Object.assign do estado sobrescreveria o herói)
  return { tiles, objects, start, goal, heroStart, W, H, seed: S };
}

/* ======================= Montagem da arte do mapa ======================= */
function buildMapArt() {
  const m = G.mission, biome = BIOMES[m.biome], { W, H, tiles } = G;
  const t = Art.buildTerrain(tiles, W, H, TS, biome, G.seed);
  const gx = t.ground.getContext('2d'), R = makeRng(G.seed * 31 + 5);
  // estradas: da cidade até pontos de interesse
  const town = G.objects.find(o => o.type === 'town'), prev = new Map(), dist = new Map([[town.x + ',' + town.y, 0]]);
  const q = [{ x: town.x, y: town.y }];
  for (let i = 0; i < q.length; i++) { const c = q[i]; for (const [dx, dy] of DIRS.slice(0, 4)) { const nx = c.x + dx, ny = c.y + dy, k = nx + ',' + ny; if (nx < 0 || ny < 0 || nx >= W || ny >= H || dist.has(k) || tiles[ny][nx] !== 0) continue; dist.set(k, dist.get(c.x + ',' + c.y) + 1); prev.set(k, c); q.push({ x: nx, y: ny }); } }
  const paths = [];
  for (const o of G.objects) if (['mine', 'dwelling', 'shrine', 'artifact'].includes(o.type) || o.boss) {
    const p = []; let k = o.x + ',' + o.y; while (prev.get(k)) { const c = prev.get(k); p.push(c); k = c.x + ',' + c.y; } paths.push(p.reverse().concat([{ x: o.x, y: o.y }]));
  }
  const road = (w, col) => { gx.strokeStyle = col; gx.lineWidth = w; gx.lineCap = 'round'; gx.lineJoin = 'round'; for (const p of paths) { gx.beginPath(); p.forEach((c, i) => { const px = c.x * TS + TS / 2 + (Art.hash(c.x, c.y, 1) - .5) * 14, py = c.y * TS + TS / 2 + (Art.hash(c.x, c.y, 2) - .5) * 14; i ? gx.lineTo(px, py) : gx.moveTo(px, py); }); gx.stroke(); } };
  road(15, 'rgba(70,52,36,.28)'); road(11, m.biome === 'ash' ? 'rgba(120,98,84,.85)' : 'rgba(150,120,80,.8)'); road(5, 'rgba(190,160,115,.35)');
  // detalhes do chão
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tiles[y][x] === 0 || tiles[y][x] === 1) {
    for (let i = 0; i < 4; i++) {
      const px = x * TS + R() * TS, py = y * TS + R() * TS, r = R();
      if (r < .6) { gx.strokeStyle = m.biome === 'ash' ? 'rgba(160,140,120,.5)' : 'rgba(30,70,30,.45)'; gx.lineWidth = 1.2; gx.beginPath(); gx.moveTo(px, py); gx.lineTo(px - 1.5, py - 4); gx.moveTo(px, py); gx.lineTo(px + 1.5, py - 4.5); gx.stroke(); }
      else if (r < .75 && m.biome === 'grass') { gx.fillStyle = pick(['#f4e27a', '#f08fa8', '#ffffff', '#9ec8ff'], R); gx.beginPath(); gx.arc(px, py, 1.5, 0, 7); gx.fill(); }
      else if (r < .85) { gx.fillStyle = 'rgba(0,0,0,.18)'; gx.beginPath(); gx.ellipse(px, py, 3, 1.6, 0, 0, 7); gx.fill(); gx.fillStyle = biome.rock[1]; gx.beginPath(); gx.ellipse(px, py - 1, 2.6, 1.8, 0, 0, 7); gx.fill(); }
      else if (m.biome === 'ash') { gx.fillStyle = 'rgba(255,120,40,.5)'; gx.beginPath(); gx.arc(px, py, 1.2, 0, 7); gx.fill(); }
    }
  }
  G.art = { ground: t.ground, mask: t.mask, ripple: Art.ripplePattern(), trees: [0, 1, 2].map(i => Art.treeSprite(biome, i)), mounts: [0, 1].map(i => Art.mountainSprite(biome, i)),
    tmp: Art.mk(VW, VH), fog: Art.mk(W, H), scenery: [] };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (tiles[y][x] === 1) { for (let i = 0; i < 2; i++) G.art.scenery.push({ kind: 't', v: (x * 3 + y + i) % 3, x: x * TS + 6 + i * 22 + (Art.hash(x, y, i) - .5) * 12, y: y * TS + 30 + i * 8 + Art.hash(x, y, 9 + i) * 10, tx: x, ty: y }); }
    else if (tiles[y][x] === 3) G.art.scenery.push({ kind: 'm', v: (x + y) % 2, x: x * TS + TS / 2, y: y * TS + TS - 4, tx: x, ty: y });
  }
}

/* ======================= Missão: início/fim ======================= */
function startMission(mi, fid, opts = {}) {
  const m = MISSIONS.find(x => x.id === mi) || MISSIONS[0], fac = FACTIONS[fid], carry = opts.noCarry ? null : profile.carry;
  const map = genMap(m, fid), hero = newHero(fac.hero, carry);
  G = Object.assign({ mission: m, fid, faction: fac, hero, day: 1, res: { ...m.start }, army: (carry && carry.hero && carry.hero.id === fac.hero && carry.army) ? carry.army.map(s => ({ ...s })) : fac.startArmy.map(s => ({ ...s })),
    built: { 0: true }, avail: {}, guild: false, explored: new Uint8Array(map.W * map.H), visible: new Uint8Array(map.W * map.H), cam: { x: 0, y: 0 }, moving: false, hover: null, path: null, over: false }, map);
  fac.units.forEach((u, i) => { if (G.built[i]) G.avail[u] = UNITS[u].growth; });
  hero.x = map.heroStart.x; hero.y = map.heroStart.y; hero.mp = maxMp(); hero.mana = maxMana(); hero.px = hero.x * TS + TS / 2; hero.py = hero.y * TS + TS / 2;
  if (carry && opts.bonusGold) G.res.gold += opts.bonusGold;
  buildMapArt(); updateVisibility(); centerCam(true);
  mode = 'map'; hideAll(); $('side').classList.remove('hide'); $('topbar').classList.remove('hide');
  log(`${m.name}: ${m.desc}`, true); refreshUI(); persist();
}

function endMission(won) {
  if (G.over) return; G.over = true; mode = 'busy';
  if (won) {
    Sfx.win(); if (!profile.done.includes(G.mission.id)) profile.done.push(G.mission.id);
    profile.carry = { hero: JSON.parse(JSON.stringify(G.hero)), army: G.army.map(s => ({ ...s })) }; profile.save = null; saveProfile();
    const next = MISSIONS.find(x => x.id === G.mission.id + 1);
    showOverlay(`<h2>👑 Vitória!</h2><p>${G.mission.name} concluída em <b>${G.day}</b> dias.</p><p class="muted">Seu herói (nível ${G.hero.level}) e o exército sobrevivente seguem para a próxima missão.</p>
      <div class="actions">${next ? `<button class="pri" id="bNext">Próxima missão ›</button>` : ''}<button id="bMenu">Menu</button></div>`);
    if (next) $('bNext').onclick = () => startMission(next.id, G.fid, { bonusGold: 1000 }); $('bMenu').onclick = openMenu;
  } else {
    Sfx.lose(); profile.save = null; saveProfile();
    showOverlay(`<h2>💀 Derrota</h2><p>${G.day > G.mission.days ? 'O prazo da missão acabou.' : 'Seu herói caiu em batalha.'}</p><div class="actions"><button class="pri" id="bRetry">Tentar de novo</button><button id="bMenu">Menu</button></div>`);
    $('bRetry').onclick = () => startMission(G.mission.id, G.fid); $('bMenu').onclick = openMenu;
  }
}

function serialize() { return { mi: G.mission.id, fid: G.fid, day: G.day, res: G.res, army: G.army, hero: G.hero, built: G.built, avail: G.avail, guild: G.guild, tiles: G.tiles, objects: G.objects, explored: Array.from(G.explored) }; }
function persist() { if (!G || G.over) return; try { profile.save = serialize(); saveProfile(); } catch { } }
function resumeSave() {
  const s = profile.save; if (!s) return;
  const m = MISSIONS.find(x => x.id === s.mi), map = genMap(m, s.fid);
  G = Object.assign({ mission: m, fid: s.fid, faction: FACTIONS[s.fid], hero: s.hero, day: s.day, res: s.res, army: s.army, built: s.built, avail: s.avail, guild: s.guild, explored: Uint8Array.from(s.explored), visible: new Uint8Array(map.W * map.H), cam: { x: 0, y: 0 }, moving: false, hover: null, path: null, over: false }, map);
  G.tiles = s.tiles; G.objects = s.objects; G.hero.px = G.hero.x * TS + TS / 2; G.hero.py = G.hero.y * TS + TS / 2;
  buildMapArt(); updateVisibility(); centerCam(true); mode = 'map'; hideAll(); $('side').classList.remove('hide'); $('topbar').classList.remove('hide'); log('Jogo carregado.', true); refreshUI();
}

/* ======================= Visibilidade / câmera ======================= */
function updateVisibility() {
  const { W, H } = G; G.visible.fill(0);
  const reveal = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && y >= 0 && x < W && y < H && (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r) { G.visible[y * W + x] = 1; G.explored[y * W + x] = 1; } };
  reveal(G.hero.x, G.hero.y, 6);
  for (const o of G.objects) if (o.owner === 1) reveal(o.x, o.y, o.type === 'town' ? 5 : 3);
  const f = G.art.fog.getContext('2d'), img = f.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { img.data[i * 4 + 3] = G.visible[i] ? 0 : (G.explored[i] ? 120 : 246); img.data[i * 4] = 8; img.data[i * 4 + 1] = 10; img.data[i * 4 + 2] = 16; }
  f.putImageData(img, 0, 0);
}
const isExplored = (x, y) => x >= 0 && y >= 0 && x < G.W && y < G.H && G.explored[y * G.W + x];
const isVisible = (x, y) => x >= 0 && y >= 0 && x < G.W && y < G.H && G.visible[y * G.W + x];
function centerCam(snap) {
  const tx = G.hero.px - VW / 2, ty = G.hero.py - VH / 2, mw = G.W * TS, mh = G.H * TS;
  const cx = mw <= VW ? (mw - VW) / 2 : clamp(tx, 0, mw - VW), cy = mh <= VH ? (mh - VH) / 2 : clamp(ty, 0, mh - VH);
  if (snap) { G.cam.x = cx; G.cam.y = cy; } else { G.cam.x += (cx - G.cam.x) * .12; G.cam.y += (cy - G.cam.y) * .12; }
}
const objAt = (x, y) => G.objects.find(o => o.x === x && o.y === y);
const blocker = o => o && (o.type === 'monster' || o.guard);

/* ======================= Caminho do herói ======================= */
function findPath(target) {
  const { W, H, tiles } = G, from = { x: G.hero.x, y: G.hero.y }, key = (x, y) => y * W + x;
  const best = new Float32Array(W * H).fill(1e9), prev = new Int32Array(W * H).fill(-1), open = [{ x: from.x, y: from.y, c: 0 }]; best[key(from.x, from.y)] = 0;
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].c < open[bi].c) bi = i;
    const cur = open.splice(bi, 1)[0]; if (cur.c > best[key(cur.x, cur.y)]) continue; if (cur.x === target.x && cur.y === target.y) break;
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || tiles[ny][nx] !== 0) continue;
      const o = objAt(nx, ny); if (blocker(o) && !(nx === target.x && ny === target.y)) continue;
      const c = cur.c + (dx && dy ? 1.41 : 1), k = key(nx, ny); if (c < best[k]) { best[k] = c; prev[k] = key(cur.x, cur.y); open.push({ x: nx, y: ny, c }); }
    }
  }
  const tk = key(target.x, target.y); if (best[tk] >= 1e9) return null;
  const path = []; for (let k = tk; k !== key(from.x, from.y); k = prev[k]) path.push({ x: k % W, y: Math.floor(k / W), c: best[k] });
  return path.reverse();
}

function walk(target) {
  if (mode !== 'map' || G.moving) return;
  const path = findPath(target); if (!path || !path.length) return;
  G.moving = true; G.path = null; let prevC = 0;
  const stepNext = () => {
    if (!path.length) { G.moving = false; refreshUI(); return; }
    const p = path[0], cost = p.c - prevC;
    if (G.hero.mp < cost - 1e-6) { log('Movimento insuficiente. Passe o dia para continuar.'); G.moving = false; refreshUI(); return; }
    path.shift(); prevC = p.c; G.hero.mp -= cost;
    G.stepAnim = { fx: G.hero.px, fy: G.hero.py, tx: p.x * TS + TS / 2, ty: p.y * TS + TS / 2, t: 0, p, last: !path.length };
  };
  G.stepNext = stepNext; stepNext();
}

function finishStep(a) {
  G.hero.x = a.p.x; G.hero.y = a.p.y; G.hero.px = a.tx; G.hero.py = a.ty; G.stepAnim = null; updateVisibility(); Sfx.step();
  const o = objAt(a.p.x, a.p.y);
  if (o && o.type !== 'town' && a.last) { G.moving = false; interact(o); return; }
  if (o && o.type === 'town' && a.last) { G.moving = false; refreshUI(); openTown(); return; }
  if (o && (blocker(o))) { G.moving = false; interact(o); return; }
  if (G.stepNext) G.stepNext();
}

/* ======================= Interações ======================= */
function floater(x, y, text, color = '#fff') { FX.floats.push({ x, y, text, color, life: 1.4 }); }
function burst(x, y, color, n = 14, speed = 90) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = speed * (.3 + Math.random()); FX.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: .5 + Math.random() * .4, max: .9, color, size: 2 + Math.random() * 3 }); } }
const wx = o => o.x * TS + TS / 2, wy = o => o.y * TS + TS / 2;
function removeObj(o) { G.objects.splice(G.objects.indexOf(o), 1); }
function addToArmy(u, n) { const s = G.army.find(s => s.u === u); if (s) { s.count += n; return true; } if (G.army.length >= 5) return false; G.army.push({ u, count: n }); return true; }

async function interact(o) {
  if (blocker(o) && (o.type === 'monster' || o.guard)) {
    const groups = o.type === 'monster' ? o.groups : o.guard.groups;
    const res = await Battle.start(groups, { boss: o.boss, name: o.name, reward: o.reward || 0 });
    if (res.hero_dead || res.lost) { endMission(false); return; }
    G.army = res.army; const lv = gainXp(res.xp); log(`Vitória! +${res.xp} XP${res.reward ? `, +${fmt(res.reward)} de ouro` : ''}.`);
    if (res.reward) G.res.gold += res.reward;
    if (o.type === 'monster') { removeObj(o); burst(wx(o), wy(o), '#ffd24a', 20); } else delete o.guard;
    mode = 'map'; refreshUI(); persist();
    if (o.boss) { endMission(true); return; }
    await levelUps(lv);
    if (o.type !== 'monster' && !o.guard) await interact(o);
    return;
  }
  const x = wx(o), y = wy(o);
  switch (o.type) {
    case 'pile': G.res[o.kind] += o.amount; floater(x, y - 20, `+${o.amount} ${RES_NAME[o.kind]}`, '#ffe28a'); Sfx.coin(); burst(x, y, '#ffd24a'); removeObj(o); log(`Você coletou ${o.amount} de ${RES_NAME[o.kind].toLowerCase()}.`); break;
    case 'mine': if (o.owner !== 1) { o.owner = 1; Sfx.coin(); updateVisibility(); log(`Mina de ${RES_NAME[o.kind].toLowerCase()} conquistada (+${MINE_INCOME[o.kind]}/dia).`); burst(x, y, G.faction.color, 24); } break;
    case 'dwelling': openDwelling(o); break;
    case 'chest': return chestDialog(o);
    case 'artifact': { const it = ITEMS[o.item]; if (G.hero.items.includes(o.item)) { G.res.gold += 600; floater(x, y - 20, '+600 Ouro'); } else { G.hero.items.push(o.item); log(`Artefato: ${it.name}!`); floater(x, y - 20, it.name, '#ffd86a'); G.hero.mp = Math.min(maxMp(), G.hero.mp); } Sfx.coin(); burst(x, y, '#ffd86a', 26); removeObj(o); break; }
    case 'shrine': { if (o.used) { log('O santuário está silencioso.'); break; } o.used = true; const left = Object.keys(SPELLS).filter(s => !G.hero.spells.includes(s));
      if (left.length) { G.hero.spells.push(left[0]); log(`O santuário ensina: ${SPELLS[left[0]].name}.`); floater(x, y - 20, SPELLS[left[0]].name, '#9ae8ff'); } else { const lv = gainXp(200); floater(x, y - 20, '+200 XP', '#9ae8ff'); await levelUps(lv); } Sfx.spell(); burst(x, y, '#9ae8ff', 26); break; }
    case 'fountain': G.hero.mp = maxMp(); G.hero.mana = maxMana(); Sfx.spell(); burst(x, y, '#7fd0ff', 22); log('A fonte restaura seu movimento e sua mana.'); break;
    case 'sign': log(o.text); break;
  }
  refreshUI(); persist();
}
const MINE_INCOME = { gold: 500, wood: 2, ore: 2, crystal: 1 };

function chestDialog(o) {
  return new Promise(res => {
    mode = 'busy';
    showOverlay(`<h2>📦 Baú</h2><p>Dentro há ouro ou experiência. O que prefere?</p><div class="actions"><button class="pri" id="cGold">+1000 de ouro</button><button id="cXp">+${Math.round(LEVEL_XP(G.hero.level) * .6)} XP</button></div>`);
    $('cGold').onclick = () => { G.res.gold += 1000; Sfx.coin(); done(); };
    $('cXp').onclick = async () => { const lv = gainXp(Math.round(LEVEL_XP(G.hero.level) * .6)); done(); await levelUps(lv); };
    function done() { removeObj(o); hideAll(); mode = 'map'; refreshUI(); persist(); res(); }
  });
}

async function levelUps(n) {
  for (let i = 0; i < n; i++) await new Promise(res => {
    mode = 'busy'; const ch = levelUpChoices();
    showOverlay(`<h2>⭐ Nível ${G.hero.level - (n - 1 - i)}!</h2><p>Escolha uma melhoria:</p><div class="cards">${ch.map((c, j) => `<button class="card" data-j="${j}"><span class="big">${c.i}</span>${c.t}</button>`).join('')}</div>`);
    document.querySelectorAll('.card').forEach(b => b.onclick = () => { const c = ch[+b.dataset.j]; if (c.k === 'spell') G.hero.spells.push(c.spell); else G.hero[c.k]++; Sfx.coin(); hideAll(); mode = 'map'; refreshUI(); res(); });
  });
}

/* ======================= Dia ======================= */
function endDay() {
  if (mode !== 'map' || G.moving) return;
  G.day++;
  if (G.day > G.mission.days) { endMission(false); return; }
  G.hero.mp = maxMp(); G.hero.mana = maxMana();
  let inc = { gold: 500, wood: 0, ore: 0, crystal: 0 };
  for (const o of G.objects) if (o.type === 'mine' && o.owner === 1) inc[o.kind] += MINE_INCOME[o.kind];
  for (const k of RES) G.res[k] += inc[k];
  if ((G.day - 1) % 7 === 0) {
    G.faction.units.forEach((u, i) => { if (G.built[i]) G.avail[u] = (G.avail[u] || 0) + UNITS[u].growth; });
    for (const o of G.objects) if (o.type === 'dwelling') o.avail = (o.avail || 0) + UNITS[o.u].growth;
    log('Nova semana! As moradias reabastecem tropas.');
  }
  log(`Dia ${G.day}: ${RES.filter(k => inc[k]).map(k => `+${inc[k]} ${RES_NAME[k].toLowerCase()}`).join(', ')}.`);
  const b = $('banner'); b.textContent = `Dia ${G.day}`; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  refreshUI(); persist();
}

/* ======================= Recrutamento / Cidade ======================= */
const canPay = c => Object.entries(c).every(([k, v]) => G.res[k] >= v);
const pay = c => Object.entries(c).forEach(([k, v]) => { G.res[k] -= v; });
function maxAfford(u, avail) { let n = avail; for (const [k, v] of Object.entries(UNITS[u].cost)) n = Math.min(n, Math.floor(G.res[k] / v)); return Math.max(0, n); }
function recruit(u, n, source) {
  n = Math.min(n, source.avail, maxAfford(u, source.avail)); if (n <= 0) return 0;
  if (!addToArmy(u, n)) { log('Exército cheio (5 grupos).'); return 0; }
  for (const [k, v] of Object.entries(UNITS[u].cost)) G.res[k] -= v * n; source.avail -= n; Sfx.coin(); return n;
}
const heroInTown = () => { const t = G.objects.find(o => o.type === 'town'); return t.x === G.hero.x && t.y === G.hero.y; };

function unitCard(u) {
  const d = UNITS[u]; return `<canvas class="uicon" data-u="${u}" width="64" height="64"></canvas>`;
}
function paintIcons(root) {
  root.querySelectorAll('canvas.uicon').forEach(c => {
    const x = c.getContext('2d'), sc = UNITS[c.dataset.u].art.scale || 1, f = Math.min(1, 0.95 / sc);   // unidades grandes encolhem para caber
    x.clearRect(0, 0, 64, 64); x.save(); x.translate(32, 58); x.scale(f, f); Art.drawUnit(x, c.dataset.u, 0, 0, { t: 1.2, walk: false }); x.restore();
  });
}

function openTown() {
  if (mode !== 'map' || !heroInTown()) return; mode = 'busy';
  const body = () => {
    const f = G.faction, rows = f.units.map((u, i) => {
      const d = UNITS[u], built = G.built[i], av = G.avail[u] || 0;
      return `<div class="trow">${unitCard(u)}<div class="grow"><b>${d.name}</b> <span class="muted">${f.buildings[i]} · Tier ${d.tier}</span>
        <div class="muted small">PV ${d.hp} · ATQ ${d.att} · DEF ${d.def} · Dano ${d.min}-${d.max} · Vel ${d.speed} · Ini ${d.init}${d.ranged ? ' · Distância' : ''}${d.fly ? ' · Voa' : ''}${d.regen ? ' · Regenera' : ''}${d.charge ? ' · Investida' : ''}</div>
        <div class="muted small">${built ? `Disponível: <b>${av}</b> · ${costStr(d.cost)} cada` : `Construir: ${costStr(BUILD_COST[i])}`}</div></div>
        <div class="btns">${built ? `<button data-rec="${u}" data-n="1" ${av && maxAfford(u, av) ? '' : 'disabled'}>+1</button><button data-rec="${u}" data-n="10" ${av && maxAfford(u, av) ? '' : 'disabled'}>+10</button><button data-rec="${u}" data-n="999" ${av && maxAfford(u, av) ? '' : 'disabled'}>Máx</button>`
          : `<button class="pri" data-build="${i}" ${canPay(BUILD_COST[i]) ? '' : 'disabled'}>Construir</button>`}</div></div>`;
    }).join('');
    const known = G.hero.spells, buyable = Object.keys(SPELLS).filter(s => !known.includes(s));
    const guild = `<div class="trow"><div class="big">📖</div><div class="grow"><b>Guilda de Magos</b> <span class="muted">${G.guild ? 'construída' : costStr(GUILD_COST)}</span>
      <div class="muted small">${G.guild ? (buyable.length ? 'Aprenda feitiços (400 ouro + 1 cristal cada):' : 'Você já conhece todas as magias.') : 'Permite aprender novos feitiços.'}</div>
      <div class="chips">${G.guild ? buyable.map(s => `<button data-spell="${s}" ${G.res.gold >= 400 && G.res.crystal >= 1 ? '' : 'disabled'}>${SPELLS[s].name}</button>`).join('') : ''}</div></div>
      <div class="btns">${G.guild ? '' : `<button class="pri" data-guild="1" ${canPay(GUILD_COST) ? '' : 'disabled'}>Construir</button>`}</div></div>`;
    const rate = { wood: [100, 40], ore: [100, 40], crystal: [500, 200] };
    const market = `<div class="trow"><div class="big">⚖</div><div class="grow"><b>Mercado</b><div class="chips">${['wood', 'ore', 'crystal'].map(k => `<span>${RES_NAME[k]}: <button data-buy="${k}" ${G.res.gold >= rate[k][0] ? '' : 'disabled'}>Comprar 1 (${rate[k][0]}🪙)</button> <button data-sell="${k}" ${G.res[k] >= 1 ? '' : 'disabled'}>Vender 1 (+${rate[k][1]}🪙)</button></span>`).join('')}</div></div></div>`;
    return `<h2>🏰 Cidade — ${f.name}</h2><div class="muted">${RES.map(k => `${RES_NAME[k]}: <b>${fmt(G.res[k])}</b>`).join(' · ')}</div>${rows}${guild}${market}
      <div class="trow"><div class="grow"><b>Exército</b> <span class="muted">${G.army.map(s => `${UNITS[s.u].name} ×${s.count}`).join(' · ')}</span></div><div class="btns"><button class="pri" id="tClose">Fechar</button></div></div>`;
  };
  const render = () => {
    showOverlay(body(), true); paintIcons($('overlay'));
    $('tClose').onclick = () => { hideAll(); mode = 'map'; refreshUI(); persist(); };
    const rate = { wood: [100, 40], ore: [100, 40], crystal: [500, 200] };
    document.querySelectorAll('[data-rec]').forEach(b => b.onclick = () => { const u = b.dataset.rec; const n = recruit(u, +b.dataset.n, { get avail() { return G.avail[u]; }, set avail(v) { G.avail[u] = v; } }); if (n) log(`Recrutou ${n} ${UNITS[u].name}.`); render(); });
    document.querySelectorAll('[data-build]').forEach(b => b.onclick = () => { const i = +b.dataset.build; if (!canPay(BUILD_COST[i])) return; pay(BUILD_COST[i]); G.built[i] = true; G.avail[G.faction.units[i]] = UNITS[G.faction.units[i]].growth; Sfx.coin(); render(); });
    document.querySelectorAll('[data-guild]').forEach(b => b.onclick = () => { if (!canPay(GUILD_COST)) return; pay(GUILD_COST); G.guild = true; Sfx.coin(); render(); });
    document.querySelectorAll('[data-spell]').forEach(b => b.onclick = () => { if (G.res.gold < 400 || G.res.crystal < 1) return; G.res.gold -= 400; G.res.crystal -= 1; G.hero.spells.push(b.dataset.spell); Sfx.spell(); render(); });
    document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const k = b.dataset.buy; if (G.res.gold < rate[k][0]) return; G.res.gold -= rate[k][0]; G.res[k]++; Sfx.coin(); render(); });
    document.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const k = b.dataset.sell; if (G.res[k] < 1) return; G.res[k]--; G.res.gold += rate[k][1]; Sfx.coin(); render(); });
  };
  render();
}

function openDwelling(o) {
  mode = 'busy'; const u = o.u, d = UNITS[u];
  const render = () => {
    showOverlay(`<h2>🛖 Acampamento de ${d.name}</h2><div class="trow">${unitCard(u)}<div class="grow"><div class="muted small">PV ${d.hp} · ATQ ${d.att} · DEF ${d.def} · Dano ${d.min}-${d.max}</div><div>Disponível: <b>${o.avail}</b> · ${costStr(d.cost)} cada</div><div class="muted small">Ouro: ${fmt(G.res.gold)}</div></div>
      <div class="btns"><button data-n="1" ${o.avail && maxAfford(u, o.avail) ? '' : 'disabled'}>+1</button><button data-n="999" ${o.avail && maxAfford(u, o.avail) ? '' : 'disabled'}>Máx</button></div></div><div class="actions"><button class="pri" id="dClose">Fechar</button></div>`, true);
    paintIcons($('overlay')); $('dClose').onclick = () => { hideAll(); mode = 'map'; refreshUI(); persist(); };
    document.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { const n = recruit(u, +b.dataset.n, o); if (n) log(`Recrutou ${n} ${d.name}.`); render(); refreshUI(); });
  };
  render();
}

/* ======================= Desenho do mapa ======================= */
function drawMap() {
  const { W, H } = G, art = G.art, cam = G.cam;
  ctx.save();
  const sh = FX.shake > 0 ? [(Math.random() - .5) * FX.shake, (Math.random() - .5) * FX.shake] : [0, 0];
  ctx.translate(-Math.round(cam.x) + sh[0], -Math.round(cam.y) + sh[1]);
  ctx.fillStyle = '#0b0e13'; ctx.fillRect(cam.x - 40, cam.y - 40, VW + 80, VH + 80);
  ctx.drawImage(art.ground, 0, 0);
  // água animada
  const tc = art.tmp.getContext('2d'); tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, VW, VH);
  tc.save(); tc.translate(-(T * 14) % 256, (Math.sin(T * .6) * 4)); const pat = tc.createPattern(art.ripple, 'repeat'); tc.fillStyle = pat; tc.fillRect(0, -10, VW + 300, VH + 40); tc.restore();
  tc.globalCompositeOperation = 'destination-in'; tc.drawImage(art.mask, Math.round(cam.x), Math.round(cam.y), VW, VH, 0, 0, VW, VH);
  ctx.globalAlpha = .28; ctx.drawImage(art.tmp, Math.round(cam.x), Math.round(cam.y)); ctx.globalAlpha = 1;
  // desenhos ordenados por y
  const list = [], x0 = cam.x - 80, x1 = cam.x + VW + 80, y0 = cam.y - 80, y1 = cam.y + VH + 120;
  for (const s of art.scenery) if (s.x > x0 && s.x < x1 && s.y > y0 && s.y < y1) list.push({ y: s.y, f: () => s.kind === 't' ? ctx.drawImage(art.trees[s.v], s.x - 32, s.y - 76, 64, 84) : ctx.drawImage(art.mounts[s.v], s.x - 38, s.y - 74, 76, 84) });
  for (const o of G.objects) {
    if (!isExplored(o.x, o.y)) continue; const vis = isVisible(o.x, o.y), bx = o.x * TS + TS / 2, by = o.y * TS + TS - 8;
    if (o.type === 'monster') { if (!vis) continue; list.push({ y: by, f: () => drawMonsterGroup(o.groups, bx, by, o.boss, o) }); }
    else list.push({ y: by, f: () => {
      const sp = Art.objectSprite(o, G.faction); const bob = (o.type === 'artifact' || o.type === 'shrine') ? Math.sin(T * 2 + o.id) * 2 : 0;
      ctx.globalAlpha = vis ? 1 : .6; ctx.drawImage(sp, o.x * TS - 8, o.y * TS - 14 + bob, 64, 64); ctx.globalAlpha = 1;
      if (o.owner === 1 && o.type === 'mine') { ctx.fillStyle = G.faction.color; ctx.fillRect(o.x * TS + 38, o.y * TS - 6, 8, 6); }
      if (o.guard && vis) drawMonsterGroup(o.guard.groups, bx + 12, by + 6, false, o, .75);
    } });
  }
  const hh = G.hero;
  list.sort((a, b) => a.y - b.y); for (const it of list) it.f();
  Art.drawHero(ctx, hh.id, hh.px, hh.py + 16, { t: T, walk: !!G.stepAnim, flip: G.heroFlip }); // o herói fica sempre por cima do cenário
  // marcador do herói (anel)
  ctx.strokeStyle = G.faction.color; ctx.lineWidth = 2; ctx.globalAlpha = .6 + Math.sin(T * 4) * .2; ctx.beginPath(); ctx.ellipse(hh.px, hh.py + 17, 18, 7, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  // prévia do caminho
  if (G.path && !G.moving) { let mpLeft = G.hero.mp; G.path.forEach((p, i) => { const ok = p.c <= G.hero.mp + 1e-6; ctx.fillStyle = ok ? 'rgba(255,255,255,.85)' : 'rgba(255,120,80,.85)'; ctx.beginPath(); ctx.arc(p.x * TS + TS / 2, p.y * TS + TS / 2, i === G.path.length - 1 ? 6 : 3.2, 0, 7); ctx.fill(); }); }
  // neblina
  ctx.imageSmoothingEnabled = true; ctx.drawImage(art.fog, 0, 0, W * TS, H * TS);
  // partículas e textos
  drawFx();
  ctx.restore();
  drawMinimap();
}

function drawMonsterGroup(groups, x, y, boss, o, scale = 1) {
  groups.slice(0, 3).forEach((g, i) => { const ox = (i - (Math.min(groups.length, 3) - 1) / 2) * 16 * scale; ctx.save(); ctx.translate(ox, 0); ctx.scale(scale, scale); Art.drawUnit(ctx, g.u, x / scale, y / scale, { t: T + i, walk: false, flip: true }); ctx.restore(); });
  const tot = groups.reduce((s, g) => s + g.count, 0); ctx.font = 'bold 12px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = boss ? '#ffd24a' : '#fff'; ctx.strokeText(tot, x, y + 14); ctx.fillText(tot, x, y + 14);
  if (boss) { ctx.strokeStyle = 'rgba(255,200,60,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 2, 26, 10, 0, 0, 7); ctx.stroke(); }
}

function drawFx() {
  for (const p of FX.parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * Math.max(.3, p.life / p.max), 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
  for (const f of FX.floats) { ctx.globalAlpha = Math.min(1, f.life * 1.5); ctx.font = 'bold 16px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); } ctx.globalAlpha = 1;
}
function updateFx(dt) {
  for (const p of FX.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g == null ? 120 : p.g) * dt; p.life -= dt; } FX.parts = FX.parts.filter(p => p.life > 0);
  for (const f of FX.floats) { f.y -= 26 * dt; f.life -= dt; } FX.floats = FX.floats.filter(f => f.life > 0); FX.shake = Math.max(0, FX.shake - dt * 30);
}

function drawMinimap() {
  const mc = $('mini'), x = mc.getContext('2d'), { W, H } = G, sx = mc.width / W, sy = mc.height / H;
  x.fillStyle = '#0b0e13'; x.fillRect(0, 0, mc.width, mc.height);
  const col = ['#3d5f35', '#264a2a', '#1f4a72', '#8a8d92'];
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) { if (!G.explored[ty * W + tx]) continue; x.fillStyle = col[G.tiles[ty][tx]]; x.fillRect(tx * sx, ty * sy, Math.ceil(sx), Math.ceil(sy)); if (!G.visible[ty * W + tx]) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(tx * sx, ty * sy, Math.ceil(sx), Math.ceil(sy)); } }
  for (const o of G.objects) { if (!isExplored(o.x, o.y)) continue; x.fillStyle = o.type === 'monster' ? '#e0483a' : o.type === 'town' ? '#fff' : o.owner === 1 ? G.faction.color : '#ffd24a'; x.fillRect(o.x * sx - 1, o.y * sy - 1, 3, 3); }
  x.fillStyle = '#fff'; x.fillRect(G.hero.x * sx - 2, G.hero.y * sy - 2, 5, 5);
  x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 1; x.strokeRect(G.cam.x / TS * sx, G.cam.y / TS * sy, VW / TS * sx, VH / TS * sy);
}

/* ======================= UI (DOM) ======================= */
function banner(text) { const b = $('banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function log(msg, reset) { const el = $('log'); if (reset) el.innerHTML = ''; const d = document.createElement('div'); d.textContent = msg; el.prepend(d); while (el.children.length > 7) el.lastChild.remove(); }
function showOverlay(html, wide) { const o = $('overlay'); o.innerHTML = `<div class="box ${wide ? 'wide' : ''}">${html}</div>`; o.classList.add('show'); }
function hideAll() { $('overlay').classList.remove('show'); $('overlay').innerHTML = ''; }

function refreshUI() {
  if (!G) return;
  $('resbar').innerHTML = RES.map(k => `<span title="${RES_NAME[k]}"><i class="ri ${k}"></i><b>${fmt(G.res[k])}</b></span>`).join('') + `<span>📅 Dia <b>${G.day}</b>/${G.mission.days}</span><span class="muted">${G.mission.name}</span>`;
  const h = G.hero, p = $('portrait').getContext('2d'); Art.drawHeroPortrait(p, HEROES[h.id], 96, 112, 1);
  const need = LEVEL_XP(h.level);
  $('heroInfo').innerHTML = `<b>${h.name}</b> <span class="muted">Nv ${h.level}</span><div class="bar"><i style="width:${h.xp / need * 100}%"></i></div><div class="muted small">XP ${h.xp}/${need}</div>
    <div class="stats"><span title="Ataque">⚔ ${hs('att')}</span><span title="Defesa">🛡 ${hs('def')}</span><span title="Poder mágico">✦ ${hs('power')}</span><span title="Conhecimento">📖 ${hs('knowledge')}</span></div>
    <div class="small">➤ Movimento <b>${Math.floor(h.mp)}/${maxMp()}</b> · ✨ Mana <b>${h.mana}/${maxMana()}</b></div>
    <div class="small items">${h.items.map(i => `<span title="${ITEMS[i].name}">${ITEMS[i].icon}</span>`).join('') || '<span class="muted">Sem artefatos</span>'}</div>`;
  $('army').innerHTML = G.army.map((s, i) => `<div class="slot" title="${UNITS[s.u].name} — PV ${UNITS[s.u].hp} ATQ ${UNITS[s.u].att} DEF ${UNITS[s.u].def}"><canvas class="uicon" data-u="${s.u}" width="64" height="64"></canvas><b>${s.count}</b><button class="x" data-dis="${i}" title="Dispensar">✕</button></div>`).join('');
  paintIcons($('army'));
  $('army').querySelectorAll('[data-dis]').forEach(b => b.onclick = () => { if (G.army.length > 1 && confirm('Dispensar este grupo?')) { G.army.splice(+b.dataset.dis, 1); refreshUI(); } });
  $('bTown').disabled = !(mode === 'map' && heroInTown()); $('bEnd').disabled = mode !== 'map';
}

function openMenu() {
  mode = 'menu'; G = G && G.over ? null : G; $('side').classList.add('hide'); $('topbar').classList.add('hide');
  const done = new Set(profile.done), unlocked = id => id === 1 || done.has(id - 1);
  showOverlay(`<div class="title">◆ Coroa de Brasas ◆</div><p class="muted center">Estratégia por turnos com heróis, exércitos e combate tático.</p>
    <h3>Facção</h3><div class="cards">${Object.entries(FACTIONS).map(([id, f]) => `<button class="card fac ${profile.faction === id ? 'on' : ''}" data-f="${id}" style="--c:${f.color}"><b>${f.name}</b><span class="small muted">${HEROES[f.hero].name} — ${f.desc}</span></button>`).join('')}</div>
    <h3>Campanha</h3><div class="cards">${MISSIONS.map(m => `<button class="card ms" data-m="${m.id}" ${unlocked(m.id) ? '' : 'disabled'}><b>${m.id}. ${m.name}</b><span class="small muted">${m.desc}</span><span class="small">${done.has(m.id) ? '✅ Concluída' : unlocked(m.id) ? 'Disponível' : '🔒 Bloqueada'}</span></button>`).join('')}</div>
    <div class="actions">${profile.save ? '<button class="pri" id="mCont">Continuar jogo salvo</button>' : ''}<button id="mRand">Mapa aleatório</button><button id="mReset">Apagar progresso</button></div>`, true);
  document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { profile.faction = b.dataset.f; saveProfile(); Sfx.click(); openMenu(); });
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { Sfx.unlock(); Sfx.click(); const id = +b.dataset.m; if (id === 1) profile.carry = null; startMission(id, profile.faction, { noCarry: id === 1, bonusGold: id > 1 ? 1000 : 0 }); });
  if ($('mCont')) $('mCont').onclick = () => { Sfx.unlock(); resumeSave(); };
  $('mRand').onclick = () => { Sfx.unlock(); const seed = 100 + Math.floor(Math.random() * 9000), base = MISSIONS[1]; MISSIONS.push({ ...base, id: 99, name: 'Mapa aleatório #' + seed, seed, biome: pick(['grass', 'swamp', 'ash'], makeRng(seed)) }); startMission(99, profile.faction, { noCarry: true }); MISSIONS.pop(); };
  $('mReset').onclick = () => { if (confirm('Apagar todo o progresso?')) { profile = { done: [], carry: null, faction: profile.faction, muted: profile.muted, save: null }; saveProfile(); openMenu(); } };
}

/* ======================= Entrada ======================= */
const keys = {};
addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (mode === 'map') { if (e.key === ' ') { e.preventDefault(); endDay(); } else if (e.key.toLowerCase() === 't') openTown(); else if (e.key === 'Escape') openMenu(); }
  else if (mode === 'battle') Battle.key(e);
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
const canvasPos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * VW / r.width, y: (e.clientY - r.top) * VH / r.height }; };
cv.addEventListener('mousemove', e => {
  const p = canvasPos(e); if (mode === 'battle') return Battle.hover(p.x, p.y, e);
  if (mode !== 'map' || G.moving) return;
  const tx = Math.floor((p.x + G.cam.x) / TS), ty = Math.floor((p.y + G.cam.y) / TS); G.hover = { x: tx, y: ty };
  const tip = $('tip'); let txt = '';
  if (isExplored(tx, ty)) {
    const o = objAt(tx, ty);
    if (o) txt = describeObj(o, isVisible(tx, ty));
    if (G.tiles[ty] && G.tiles[ty][tx] === 0) { G.path = findPath({ x: tx, y: ty }); } else G.path = null;
  } else G.path = null;
  if (txt) { tip.innerHTML = txt; tip.style.display = 'block'; tip.style.left = Math.min(e.clientX + 14, innerWidth - 240) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; } else tip.style.display = 'none';
  cv.style.cursor = G.path ? 'pointer' : 'default';
});
cv.addEventListener('mouseleave', () => { $('tip').style.display = 'none'; if (mode === 'battle') Battle.hover(-1, -1); });
cv.addEventListener('click', e => {
  Sfx.unlock(); const p = canvasPos(e); if (mode === 'battle') return Battle.click(p.x, p.y, e);
  if (mode !== 'map' || G.moving) return;
  const tx = Math.floor((p.x + G.cam.x) / TS), ty = Math.floor((p.y + G.cam.y) / TS);
  if (!isExplored(tx, ty)) return;
  if (tx === G.hero.x && ty === G.hero.y) { const o = objAt(tx, ty); if (o && o.type === 'town') openTown(); return; }
  if (G.tiles[ty] && G.tiles[ty][tx] === 0) { G.heroFlip = tx < G.hero.x; walk({ x: tx, y: ty }); }
});
$('mini').addEventListener('click', e => { if (mode !== 'map') return; const r = $('mini').getBoundingClientRect(); const tx = (e.clientX - r.left) / r.width * G.W, ty = (e.clientY - r.top) / r.height * G.H; G.cam.x = clamp(tx * TS - VW / 2, 0, Math.max(0, G.W * TS - VW)); G.cam.y = clamp(ty * TS - VH / 2, 0, Math.max(0, G.H * TS - VH)); G.free = 3; });
$('bTown').onclick = () => { Sfx.click(); openTown(); }; $('bEnd').onclick = () => { Sfx.click(); endDay(); };
$('bMenu').onclick = () => { Sfx.click(); if (mode === 'map') { persist(); openMenu(); } };
$('bMute').onclick = () => { profile.muted = !profile.muted; Sfx.setMuted(profile.muted); $('bMute').textContent = profile.muted ? '🔇' : '🔊'; saveProfile(); };
$('bMute').textContent = profile.muted ? '🔇' : '🔊';

function describeObj(o, vis) {
  const nm = { town: 'Cidade', mine: 'Mina de ' + (o.kind ? RES_NAME[o.kind].toLowerCase() : ''), dwelling: 'Acampamento', chest: 'Baú', artifact: 'Artefato', shrine: 'Santuário', pile: o.kind ? `${o.amount} ${RES_NAME[o.kind].toLowerCase()}` : '', sign: 'Placa', fountain: 'Fonte' };
  const lines = []; if (o.type === 'monster') { if (!vis) return ''; lines.push(`<b>${o.name || 'Monstros'}</b>`); lines.push(o.groups.map(g => `${g.count}× ${UNITS[g.u].name}`).join(', ')); lines.push(difficulty(o.groups)); return lines.join('<br>'); }
  lines.push(`<b>${nm[o.type]}</b>`); if (o.owner === 1 && o.type === 'mine') lines.push('Sua'); if (o.guard && vis) { lines.push('Guardada por: ' + o.guard.groups.map(g => `${g.count}× ${UNITS[g.u].name}`).join(', ')); lines.push(difficulty(o.guard.groups)); }
  return lines.join('<br>');
}
function difficulty(groups) {
  const pw = (id, n) => { const u = UNITS[id]; return n * u.hp * ((u.min + u.max) / 2) * (1 + (u.att + u.def) / 40); };
  const mine = G.army.reduce((s, a) => s + pw(a.u, a.count), 0) * (1 + .05 * (hs('att') + hs('def'))), foe = groups.reduce((s, g) => s + pw(g.u, g.count), 0), r = foe / Math.max(1, mine);
  const [t, c] = r < .25 ? ['Trivial', '#7fe08a'] : r < .6 ? ['Fácil', '#b6e07f'] : r < 1 ? ['Equilibrado', '#ffe07f'] : r < 1.7 ? ['Difícil', '#ffab5a'] : ['Mortal', '#ff6a5a'];
  return `<span style="color:${c}">⚔ ${t}</span>`;
}

/* ======================= Laço principal ======================= */
let last = 0;
function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts; T += dt; updateFx(dt);
  if (G && (mode === 'map' || mode === 'busy' && !Battle.active)) {
    const a = G.stepAnim;
    if (a) { a.t += dt * 7; const k = Math.min(1, a.t); G.hero.px = a.fx + (a.tx - a.fx) * k; G.hero.py = a.fy + (a.ty - a.fy) * k; if (a.tx !== a.fx) G.heroFlip = a.tx < a.fx; if (k >= 1) finishStep(a); }
    if (G.free > 0) { G.free -= dt; } else if (!keys['arrowleft'] && !keys['a'] && !keys['arrowright'] && !keys['d'] && !keys['arrowup'] && !keys['w'] && !keys['arrowdown'] && !keys['s']) centerCam(false);
    const sp = 520 * dt; if (mode === 'map') { if (keys['arrowleft'] || keys['a']) { G.cam.x -= sp; G.free = 2; } if (keys['arrowright'] || keys['d']) { G.cam.x += sp; G.free = 2; } if (keys['arrowup'] || keys['w']) { G.cam.y -= sp; G.free = 2; } if (keys['arrowdown'] || keys['s']) { G.cam.y += sp; G.free = 2; }
      G.cam.x = clamp(G.cam.x, Math.min(0, (G.W * TS - VW) / 2), Math.max(0, G.W * TS - VW)); G.cam.y = clamp(G.cam.y, Math.min(0, (G.H * TS - VH) / 2), Math.max(0, G.H * TS - VH)); }
    drawMap();
  }
  if (Battle.active) { Battle.update(dt); Battle.draw(); }
  if (mode === 'menu' || !G) drawTitle();
  requestAnimationFrame(frame);
}
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#1b2433'); g.addColorStop(1, '#3a2418'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  for (let i = 0; i < 40; i++) { const x = (Art.hash(i, 1, 3) * VW + T * 12 * (.3 + Art.hash(i, 2, 3))) % VW, y = VH - ((T * 30 * (.4 + Art.hash(i, 3, 3)) + Art.hash(i, 4, 3) * VH) % VH); ctx.fillStyle = `rgba(255,${120 + Art.hash(i, 5, 3) * 100},60,${.2 + Art.hash(i, 6, 3) * .4})`; ctx.beginPath(); ctx.arc(x, y, 1 + Art.hash(i, 7, 3) * 2, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#0d1016'; ctx.beginPath(); ctx.moveTo(0, VH); for (let x = 0; x <= VW; x += 20) ctx.lineTo(x, VH - 90 - Art.fbm(x / 120, 3, 4) * 140); ctx.lineTo(VW, VH); ctx.fill();
  ctx.save(); ctx.globalAlpha = .95; Art.drawUnit(ctx, 'wyrm', 700 + Math.sin(T * .5) * 14, 250 + Math.sin(T) * 6, { t: T, walk: false, flip: true }); ctx.restore();
}

// Início. Parâmetros de URL (capturas de tela e atalhos): ?go=map|battle|town|menu &m=1..3 &f=ordem|silvestre
window.addEventListener('load', () => {
  openMenu(); requestAnimationFrame(frame);
  const q = k => (location.search.match(new RegExp('[?&]' + k + '=([\\w-]+)')) || [])[1], go = q('go');
  if (!go || go === 'menu') return;
  const m = +q('m') || 1, f = q('f') || profile.faction;
  startMission(m, f, { noCarry: true });
  // &auto=1: o jogador também é controlado pela IA (usado nas capturas de combate em ação)
  // &steps=N: avança a simulação N quadros (o navegador sem janela quase não dispara animações); só para capturas
  if (q('steps')) (async () => { await new Promise(r => setTimeout(r, 700)); for (let i = 0; i < +q('steps'); i++) { T += .016; Battle.update(.016); updateFx(.016); await new Promise(r => setTimeout(r, 0)); } })();
  if (q('auto')) setTimeout(() => { const s = Battle._t && Battle._t.state(); if (s) { s.auto = true; if (s.awaiting) { const r = s.awaiting; s.awaiting = null; s.reach = null; r(); } } }, 300);
  if (go === 'map') { G.hero.x += 4; G.hero.px = G.hero.x * TS + TS / 2; updateVisibility(); G.hero.mp = maxMp() - 5; G.res.gold = 3200; centerCam(true); refreshUI(); }
  else if (go === 'town') { const t = G.objects.find(o => o.type === 'town'); G.hero.x = t.x; G.hero.y = t.y; G.hero.px = wx(t); G.hero.py = wy(t); G.res.gold = 6000; refreshUI(); openTown(); }
  else if (go === 'battle') { G.hero.spells = ['ember', 'stoneskin', 'heal', 'slow', 'meteor']; G.hero.level = 3; G.army = f === 'ordem' ? [{ u: 'squire', count: 24 }, { u: 'crossbow', count: 12 }, { u: 'skyhawk', count: 4 }, { u: 'knight', count: 2 }] : [{ u: 'sprite', count: 30 }, { u: 'archer', count: 12 }, { u: 'stag', count: 5 }, { u: 'ent', count: 2 }]; refreshUI(); Battle.start([{ u: m === 3 ? 'wyrm' : m === 2 ? 'golem' : 'ogre', count: m === 3 ? 1 : 5 }, { u: m === 2 ? 'wraith' : 'wolf', count: 8 }], { reward: 500 }); }
});
