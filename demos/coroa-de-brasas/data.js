'use strict';
// Dados do jogo. Tudo que é regra/conteúdo fica aqui; arte em art.js; lógica em game.js e battle.js.
// Nomes, números e arte são originais.

const RES = ['gold', 'wood', 'ore', 'crystal'];
const RES_NAME = { gold: 'Ouro', wood: 'Madeira', ore: 'Minério', crystal: 'Cristal' };

// art: parâmetros do desenhista procedural (art.js). Estatísticas no padrão do gênero.
const UNITS = {
  // ── Ordem das Cinzas ──
  squire:   { name: 'Escudeiro',  tier: 1, hp: 14, att: 5,  def: 5,  min: 1,  max: 3,  init: 7,  speed: 4, cost: { gold: 50 },  growth: 24,
              desc: 'Infantaria leal, barata e resistente.',
              art: { kind: 'human', skin: '#e8b890', primary: '#c9572b', secondary: '#7a3a1e', metal: '#aab4bd', helm: 'helm', weapon: 'sword', shield: true, cape: false } },
  crossbow: { name: 'Besteiro',   tier: 2, hp: 12, att: 6,  def: 3,  min: 2,  max: 4,  init: 8,  speed: 4, cost: { gold: 100 }, growth: 14, ranged: true,
              desc: 'Atira de longe sem sofrer contra-ataque.',
              art: { kind: 'human', skin: '#e0b088', primary: '#8a5a32', secondary: '#4f3420', metal: '#9aa4ad', helm: 'cap', weapon: 'crossbow' } },
  skyhawk:  { name: 'Falcão-do-Céu', tier: 3, hp: 35, att: 9, def: 8, min: 5, max: 9, init: 9, speed: 7, cost: { gold: 300, crystal: 1 }, growth: 6, fly: true,
              desc: 'Predador alado que ignora obstáculos.',
              art: { kind: 'bird', primary: '#b8863f', secondary: '#f1e2b8', accent: '#e8a42a', scale: 1.2 } },
  knight:   { name: 'Cavaleiro de Cinzas', tier: 4, hp: 70, att: 12, def: 11, min: 10, max: 16, init: 6, speed: 6, cost: { gold: 700, ore: 2 }, growth: 3, charge: true,
              desc: 'Cavalaria pesada: +5% de dano por casa percorrida (até +25%).',
              art: { kind: 'rider', primary: '#d6642a', secondary: '#f2d29a', metal: '#c3ccd4', horse: '#4a3a30', scale: 1.15 } },
  // ── Conclave Silvestre ──
  sprite:   { name: 'Duende',     tier: 1, hp: 10, att: 5,  def: 4,  min: 1,  max: 3,  init: 9,  speed: 5, cost: { gold: 45 },  growth: 26, fly: true,
              desc: 'Pequeno e ágil; voa sobre o campo.',
              art: { kind: 'pixie', primary: '#7fd36a', secondary: '#d6f5a8', accent: '#fff2a0', scale: 0.8 } },
  archer:   { name: 'Arqueira Élfica', tier: 2, hp: 11, att: 7, def: 3, min: 2, max: 5, init: 8, speed: 4, cost: { gold: 110 }, growth: 12, ranged: true,
              desc: 'Precisão letal à distância.',
              art: { kind: 'human', skin: '#f0cfa8', primary: '#3f8f52', secondary: '#24563a', metal: '#8a6a3a', helm: 'hood', weapon: 'bow', ears: true } },
  stag:     { name: 'Cervo Ancião', tier: 3, hp: 40, att: 9, def: 7, min: 6, max: 10, init: 8, speed: 8, cost: { gold: 320, crystal: 1 }, growth: 5, charge: true,
              desc: 'Veloz; investe com seus chifres.',
              art: { kind: 'beast', primary: '#9a7a52', secondary: '#e8d8b8', accent: '#6b4a2a', antlers: true, scale: 1.25, legs: 4 } },
  ent:      { name: 'Ent Guardião', tier: 4, hp: 110, att: 11, def: 13, min: 12, max: 20, init: 4, speed: 3, cost: { gold: 800, crystal: 2 }, growth: 2, regen: true,
              desc: 'Gigante de madeira; regenera 10% da vida por rodada.',
              art: { kind: 'hulk', style: 'ent', primary: '#6b4e32', secondary: '#4f9a3c', accent: '#9bd05a', scale: 1.45 } },
  // ── Neutros ──
  wolf:     { name: 'Lobo',       tier: 1, hp: 10, att: 5,  def: 3,  min: 1,  max: 3,  init: 9,  speed: 7, cost: { gold: 40 },
              art: { kind: 'beast', primary: '#7d7f86', secondary: '#c9cbd0', accent: '#4c4e55', legs: 4, scale: 0.95 } },
  bandit:   { name: 'Bandido',    tier: 2, hp: 14, att: 6,  def: 4,  min: 2,  max: 4,  init: 7,  speed: 5, cost: { gold: 70 },
              art: { kind: 'human', skin: '#d9a77c', primary: '#5a4a6b', secondary: '#2f2640', metal: '#8d949b', helm: 'hood', weapon: 'dagger' } },
  skeleton: { name: 'Esqueleto',  tier: 1, hp: 12, att: 5,  def: 5,  min: 1,  max: 3,  init: 6,  speed: 4, cost: { gold: 50 },
              art: { kind: 'human', skin: '#e9e4d2', primary: '#bfb9a3', secondary: '#7d7866', metal: '#a9a58f', helm: 'none', weapon: 'sword', shield: true, undead: true } },
  wraith:   { name: 'Espectro',   tier: 3, hp: 22, att: 7,  def: 5,  min: 3,  max: 6,  init: 8,  speed: 7, cost: { gold: 160 }, fly: true,
              art: { kind: 'wraith', primary: '#5b6fa8', secondary: '#c9d6ff', accent: '#8ff0ff', scale: 1.1 } },
  ogre:     { name: 'Ogro',       tier: 4, hp: 60, att: 10, def: 8,  min: 6,  max: 12, init: 5,  speed: 4, cost: { gold: 250 },
              art: { kind: 'hulk', style: 'ogre', primary: '#8d9c5a', secondary: '#6a4a30', accent: '#b0402a', scale: 1.35 } },
  golem:    { name: 'Golem de Pedra', tier: 4, hp: 90, att: 10, def: 14, min: 8, max: 12, init: 4, speed: 3, cost: { gold: 400 },
              art: { kind: 'hulk', style: 'golem', primary: '#8a8f98', secondary: '#5d6068', accent: '#ffb347', scale: 1.4 } },
  wyrm:     { name: 'Serpe das Brasas', tier: 7, hp: 200, att: 18, def: 16, min: 30, max: 45, init: 10, speed: 7, cost: { gold: 3000 }, fly: true, counters: 2,
              art: { kind: 'wyrm', primary: '#9b2e1c', secondary: '#e8742a', accent: '#ffd36a', scale: 1.7 } },
};

const FACTIONS = {
  ordem: {
    name: 'Ordem das Cinzas', color: '#d6642a', trim: '#f2d29a', hero: 'ysolde', units: ['squire', 'crossbow', 'skyhawk', 'knight'],
    desc: 'Disciplina e aço. Exército equilibrado, forte no corpo a corpo.',
    buildings: ['Quartel', 'Campo de Arqueiros', 'Aviário', 'Cavalaria'],
    startArmy: [{ u: 'squire', count: 22 }, { u: 'crossbow', count: 8 }],
  },
  silvestre: {
    name: 'Conclave Silvestre', color: '#3f9b5a', trim: '#c7e8a0', hero: 'alba', units: ['sprite', 'archer', 'stag', 'ent'],
    desc: 'Velocidade e magia. Unidades aéreas e regeneração.',
    buildings: ['Clareira', 'Atiradores', 'Recanto dos Cervos', 'Bosque Ancestral'],
    startArmy: [{ u: 'sprite', count: 24 }, { u: 'archer', count: 9 }],
  },
};

const HEROES = {
  ysolde: { name: 'Capitã Ysolde', faction: 'ordem', att: 3, def: 3, power: 1, knowledge: 1, spells: ['ember', 'stoneskin'], bio: 'Veterana das guerras de cinzas.',
            art: { skin: '#e8b890', primary: '#c9572b', secondary: '#7a3a1e', metal: '#c3ccd4', helm: 'crest', cape: true } },
  alba:   { name: 'Druida Alba',   faction: 'silvestre', att: 1, def: 2, power: 3, knowledge: 3, spells: ['ember', 'heal'], bio: 'Guardiã do bosque antigo.',
            art: { skin: '#f0cfa8', primary: '#3f8f52', secondary: '#24563a', metal: '#8a6a3a', helm: 'hood', cape: true } },
};

const SPELLS = {
  ember:     { name: 'Raio de Brasa', short: 'Brasa',     cost: 5, target: 'enemy', dmg: p => 20 + 12 * p, fx: 'bolt', color: '#ff8a3a', desc: 'Dano de fogo a um alvo.' },
  stoneskin: { name: 'Pele de Pedra', short: 'Pedra',     cost: 4, target: 'ally',  effect: { def: 4, rounds: 3 }, fx: 'aura', color: '#b9a98a', desc: '+4 de defesa por 3 rodadas.' },
  heal:      { name: 'Cura', short: 'Cura',              cost: 6, target: 'ally',  heal: p => 25 + 20 * p, fx: 'aura', color: '#7dff9a', desc: 'Restaura vida a um aliado.' },
  slow:      { name: 'Lentidão', short: 'Lentidão',          cost: 4, target: 'enemy', effect: { speed: -2, init: -3, rounds: 3 }, fx: 'aura', color: '#7ab8ff', desc: 'Reduz velocidade e iniciativa do alvo.' },
  meteor:    { name: 'Chuva de Meteoros', short: 'Meteoros', cost: 12,target: 'area',  dmg: p => 30 + 15 * p, radius: 1, fx: 'meteor', color: '#ff5a2a', desc: 'Dano em área 3×3.' },
};

const ITEMS = {
  blade:   { name: 'Lâmina Rubra',     att: 2, icon: '⚔' }, shield:  { name: 'Égide de Ferro', def: 2, icon: '⛨' },
  tome:    { name: 'Tomo Cinzento',    power: 2, icon: '✦' }, crown:  { name: 'Diadema Antigo', knowledge: 2, icon: '♛' },
  boots:   { name: 'Botas do Viajante', mp: 4, icon: '➤' },  amulet: { name: 'Amuleto da Aurora', att: 1, def: 1, power: 1, icon: '◈' },
};

const BUILD_COST = [{}, { gold: 500, wood: 5 }, { gold: 1200, wood: 5, ore: 5 }, { gold: 2500, ore: 10, crystal: 5 }];
const GUILD_COST = { gold: 800, wood: 5, crystal: 2 };
const MARKET_RATE = { buy: 10, sell: 5 }; // 10 de ouro compra 1 de recurso; vender 1 recurso dá 5 de ouro... ajustado em game.js

const LEVEL_XP = lvl => Math.round(120 * Math.pow(lvl, 1.55));

// Missões: mapas gerados por semente (mesma semente = mesmo mapa).
const MISSIONS = [
  { id: 1, name: 'Vale das Cinzas',   w: 22, h: 14, seed: 11, biome: 'grass', diff: 0.8, days: 30,
    desc: 'Um bando de ogros saqueia o vale. Derrote o Capitão Gorak antes que o inverno chegue.',
    start: { gold: 2500, wood: 12, ore: 10, crystal: 3 },
    boss: { name: 'Capitão Gorak', groups: [{ u: 'ogre', count: 18 }], reward: 3000 } },   // equilíbrio medido: exército médio (50/24/6/3) vence com ~35% de perdas
  { id: 2, name: 'Pântano Esquecido', w: 26, h: 16, seed: 23, biome: 'swamp', diff: 1.0, days: 36,
    desc: 'Mortos inquietos guardam a Torre do Pântano. Derrube o Guardião e liberte a região.',
    start: { gold: 2000, wood: 10, ore: 8, crystal: 4 },
    boss: { name: 'Guardião do Pântano', groups: [{ u: 'golem', count: 10 }, { u: 'wraith', count: 14 }], reward: 4000 } },
  { id: 3, name: 'Coroa de Brasas',   w: 30, h: 18, seed: 37, biome: 'ash', diff: 1.25, days: 45,
    desc: 'A Serpe das Brasas dorme sobre a Coroa. Reúna um grande exército e tome-a.',
    start: { gold: 2000, wood: 10, ore: 10, crystal: 5 },
    boss: { name: 'Serpe das Brasas', groups: [{ u: 'wyrm', count: 6 }], reward: 0 } },
];

const BIOMES = {
  grass: { name: 'Planícies', ground: [[44, 74, 38], [86, 128, 60]], shore: [92, 140, 120], water: [[40, 108, 150], [22, 62, 104]], tree: ['#2f6b34', '#4c9a48', '#78bf5a'], rock: ['#7b7f86', '#aab0b8'], neutrals: ['wolf', 'bandit', 'ogre', 'golem'], sky: '#5a8fb8' },
  swamp: { name: 'Pântano',   ground: [[40, 56, 40], [74, 92, 54]],  shore: [96, 110, 70],  water: [[52, 92, 82], [28, 56, 56]],   tree: ['#2c4a34', '#456b45', '#6a8a50'], rock: ['#6d7268', '#98a090'], neutrals: ['skeleton', 'wraith', 'golem', 'bandit'], sky: '#6b8678' },
  ash:   { name: 'Terras Cinzentas', ground: [[52, 46, 44], [104, 90, 82]], shore: [140, 110, 90], water: [[120, 52, 30], [70, 26, 18]], tree: ['#3b3030', '#5c4638', '#7a5a42'], rock: ['#6a625f', '#a1958c'], neutrals: ['wolf', 'ogre', 'golem', 'wraith'], sky: '#8a5a48' },
};
