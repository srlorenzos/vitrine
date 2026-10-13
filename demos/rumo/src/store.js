'use strict';
// Rumo — estado, persistência local (localStorage), migração v1→v2, desfazer e backup.

R.KEY = 'rumo.v2';
R.OLD_KEY = 'rumo.v1';

R.defaults = () => ({
  v: 2,
  settings: { theme: 'auto', workStart: '08:00', workEnd: '18:00', weekStart: 0, google: { clientId: '' }, ms: { clientId: '' }, ai: { endpoint: '', key: '', model: 'ilimitado' }, of: { provider: 'pluggy', itemIds: [] }, demo: false },
  lists: [{ id: 'pessoal', name: 'Pessoal', color: '#0e9f8c' }, { id: 'trabalho', name: 'Trabalho', color: '#3b82c4' }],
  contexts: ['casa', 'pc', 'rua', 'telefone', 'online', 'energia-baixa'].map(n => ({ id: n, name: n })),
  projects: [], tasks: [], events: [], habits: [], focus: {},
  fin: {
    accounts: [{ id: 'carteira', name: 'Carteira', type: 'cash', initial: 0, color: '#0e9f8c' }],
    cats: [
      ['salario', 'Salário', 'in'], ['freela', 'Renda extra', 'in'], ['invest-in', 'Rendimentos', 'in'],
      ['moradia', 'Moradia', 'out'], ['mercado', 'Mercado', 'out'], ['alimentacao', 'Alimentação', 'out'], ['transporte', 'Transporte', 'out'],
      ['saude', 'Saúde', 'out'], ['lazer', 'Lazer', 'out'], ['assinaturas', 'Assinaturas', 'out'], ['educacao', 'Educação', 'out'], ['compras', 'Compras', 'out'], ['outros', 'Outros', 'out'],
    ].map(([id, name, kind]) => ({ id, name, kind })),
    txs: [], recurring: [], budgets: {}, goals: [], rules: [], ofItems: [],
  },
  lastReview: '', inboxZeroStreak: 0,
});

/* ---------- migração da v1 (app antigo) ---------- */
R.migrate = old => {
  const S = R.defaults(); if (!old) return S;
  if (old.v === 2) { return Object.assign(S, old, { settings: Object.assign(S.settings, old.settings || {}), fin: Object.assign(S.fin, old.fin || {}) }); }
  // v1: tasks[{done,list,...}], lists, accounts, cats, txs, budgets, habits, focus, theme
  S.settings.theme = old.theme === 'dark' ? 'dark' : 'auto';
  S.lists = (old.lists || []).filter(l => l.id !== 'inbox').map((l, i) => ({ id: l.id, name: l.name, color: R.PALETTE[i % R.PALETTE.length] }));
  S.tasks = (old.tasks || []).map(t => ({
    id: t.id, title: t.title, notes: t.notes || '', status: t.done ? 'done' : (t.list === 'inbox' ? 'inbox' : 'next'), due: t.due || '', time: t.time || '', dur: 0, prio: t.prio || 0,
    list: t.list === 'inbox' ? '' : t.list, project: '', contexts: [], tags: t.tags || [], subs: t.subs || [], repeat: t.repeat || '', waitingFor: '', start: '', energy: '',
    source: null, created: t.created || Date.now(), doneAt: t.doneAt || '',
  }));
  S.habits = old.habits || []; S.focus = old.focus || {};
  S.fin.accounts = (old.accounts || S.fin.accounts).map((a, i) => ({ id: a.id, name: a.name, type: /cart/i.test(a.name) ? 'card' : 'cash', initial: a.initial || 0, color: R.PALETTE[i % R.PALETTE.length] }));
  S.fin.cats = old.cats && old.cats.length ? old.cats : S.fin.cats;
  S.fin.txs = (old.txs || []).map(t => ({ id: t.id, date: t.date, amount: t.amount, kind: t.kind, desc: t.desc, acc: t.acc, cat: t.cat, paid: true, tags: [], notes: '', inst: t.inst || '' }));
  S.fin.budgets = { default: old.budgets || {} };
  return S;
};

R.load = () => {
  let raw = null;
  try { raw = localStorage.getItem(R.KEY) || localStorage.getItem(R.OLD_KEY); } catch { }
  let data = null; try { data = raw ? JSON.parse(raw) : (window.RUMO_SEED || null); } catch { }
  R.S = R.migrate(data);
  R.history = [];
};

R.save = () => { try { localStorage.setItem(R.KEY, JSON.stringify(R.S)); } catch { } };
// commit: registra ponto de desfazer e salva. Use antes de mutações destrutivas.
R.checkpoint = () => { R.history.push(JSON.stringify(R.S)); if (R.history.length > 30) R.history.shift(); };
R.undo = () => { const h = R.history.pop(); if (!h) { R.toast('Nada para desfazer.'); return; } R.S = JSON.parse(h); R.save(); R.render(); R.toast('Desfeito.'); };
R.commit = (rerender = true) => { R.save(); if (rerender) R.render(); };

R.exportJSON = () => R.download(`rumo-backup-${R.today()}.json`, JSON.stringify(R.S, null, 2));
R.importJSON = async file => {
  try { const d = JSON.parse(await R.readFile(file)); if (!d.tasks && !d.fin && !d.txs) throw 0; R.checkpoint(); R.S = R.migrate(d); R.save(); R.render(); R.toast('Backup importado.'); }
  catch { R.toast('Arquivo de backup inválido.'); }
};

/* ---------- acessores de dados ---------- */
R.task = id => R.S.tasks.find(t => t.id === id);
R.project = id => R.S.projects.find(p => p.id === id);
R.list = id => R.S.lists.find(l => l.id === id);
R.acc = id => R.S.fin.accounts.find(a => a.id === id);
R.cat = id => R.S.fin.cats.find(c => c.id === id);
R.setTheme = () => { const t = R.S.settings.theme; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); };
