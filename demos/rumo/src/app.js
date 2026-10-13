'use strict';
// Rumo — roteador, navegação, paleta de comandos, atalhos e inicialização.

R.ui = { view: 'tasks', sel: { type: 'today' }, layout: 'list', month: R.monthKey(R.today()), mTab: 'visao', cal: { mode: 'month', date: R.today() }, hTab: 'habitos' };

R.nav = (view, sel) => { R.ui.view = view; if (sel) R.ui.sel = sel; if (view === 'tasks') R.ui.layout = R.ui.layout || 'list'; R.render(); const m = R.$('#main'); if (m) m.scrollTop = 0; };

R.renderNav = () => {
  const c = R.counts(), u = R.ui, tv = u.view === 'tasks', on = (v, t, id) => (u.view === v && (t === undefined || (u.sel.type === t && (id === undefined || u.sel.id === id)))) ? 'on' : '';
  const item = (icon, label, cnt, attrs, cls, extra = '') => `<button class="nav-item ${cls}" data-act="nav" ${attrs}><span class="ic">${icon}</span>${label}${cnt ? `<span class="cnt" ${extra}>${cnt}</span>` : ''}</button>`;
  const tags = [...new Set(R.S.tasks.filter(R.isActive).flatMap(t => t.tags))].slice(0, 12);
  const review = R.S.lastReview ? R.daysBetween(R.S.lastReview, R.today()) : null;
  return `
    <div class="nav-sec">Capturar e fazer</div>
    ${item('📥', 'Caixa de entrada', c.inbox || '', 'data-v="tasks" data-t="inbox"', on('tasks', 'inbox'))}
    ${item('📆', 'Hoje', c.today || '', 'data-v="tasks" data-t="today"', on('tasks', 'today'), c.late ? 'style="color:var(--danger);font-weight:700"' : '')}
    ${item('🗓', 'Próximos 7 dias', c.week || '', 'data-v="tasks" data-t="week"', on('tasks', 'week'))}
    ${item('⚡', 'Próximas ações', c.next || '', 'data-v="tasks" data-t="next"', on('tasks', 'next'))}
    ${item('⏳', 'Aguardando', c.waiting || '', 'data-v="tasks" data-t="waiting"', on('tasks', 'waiting'))}
    ${item('◈', 'Projetos', c.projects ? (c.stalled ? `${c.projects} · ⚠${c.stalled}` : c.projects) : '', 'data-v="tasks" data-t="projects"', on('tasks', 'projects') || on('tasks', 'project'))}
    ${item('💭', 'Algum dia/talvez', c.someday || '', 'data-v="tasks" data-t="someday"', on('tasks', 'someday'))}
    ${item('📋', 'Todas', '', 'data-v="tasks" data-t="all"', on('tasks', 'all'))}
    ${item('✅', 'Concluídas', '', 'data-v="tasks" data-t="done"', on('tasks', 'done'))}
    ${item('📎', 'Referência', '', 'data-v="tasks" data-t="reference"', on('tasks', 'reference'))}
    <div class="nav-sec">Planejar</div>
    ${item('📅', 'Agenda', '', 'data-v="agenda"', on('agenda'))}
    ${item('🏁', 'Revisão semanal', review === null ? '!' : review >= 7 ? `${review}d` : '', 'data-act2="x"', '', review === null || review >= 7 ? 'style="color:var(--amber);font-weight:700"' : '').replace('data-act="nav"', 'data-act="review"')}
    ${item('🔥', 'Hábitos e foco', '', 'data-v="habits"', on('habits'))}
    <div class="nav-sec">Dinheiro</div>
    ${item('💰', 'Finanças', '', 'data-v="money"', on('money'))}
    <div class="nav-sec"><span>Listas</span><button class="ghost sm" data-act="list-new" title="Nova lista">＋</button></div>
    ${R.S.lists.map(l => item(`<span style="color:${l.color}">●</span>`, R.esc(l.name), R.S.tasks.filter(t => R.isActive(t) && t.list === l.id).length || '', `data-v="tasks" data-t="list" data-id="${l.id}"`, on('tasks', 'list', l.id))).join('')}
    <div class="nav-sec">Contextos</div>
    ${R.S.contexts.map(x => item('@', R.esc(x.name), R.S.tasks.filter(t => R.isActive(t) && t.contexts.includes(x.id)).length || '', `data-v="tasks" data-t="context" data-id="${R.esc(x.id)}"`, on('tasks', 'context', x.id))).join('')}
    ${tags.length ? `<div class="nav-sec">Tags</div>${tags.map(g => item('#', R.esc(g), '', `data-v="tasks" data-t="tag" data-id="${R.esc(g)}"`, on('tasks', 'tag', g))).join('')}` : ''}
    <div class="nav-sec">Sistema</div>
    ${item('🔌', 'Integrações', '', 'data-v="settings" data-t="int"', on('settings'))}`;
};

R.render = () => {
  if (!R.S) return;
  R.setTheme();
  const main = R.$('#main'), top = main.scrollTop;
  R.$('#navscroll').innerHTML = R.renderNav();
  const v = R.views[R.ui.view] || R.views.tasks;
  main.innerHTML = v();
  main.scrollTop = top;
  R.hooks.forEach(h => { try { h(); } catch (e) { console.error(e); } });
  document.title = (R.counts().inbox ? `(${R.counts().inbox}) ` : '') + 'Rumo';
  R.$('#demoBanner').classList.toggle('hide', !R.S.settings.demo);
};

/* ---------- ações globais ---------- */
Object.assign(R.acts, {
  nav: el => { const v = el.dataset.v, t = el.dataset.t; R.nav(v, t ? { type: t, id: el.dataset.id } : undefined); },
  review: () => R.weeklyReview(),
  'close-modal': () => R.closeModal(),
  'open-of': () => { R.ui.mTab = 'of'; R.nav('money'); },
  'list-new': () => { const n = prompt('Nome da lista:'); if (n && n.trim()) { R.S.lists.push({ id: R.uid(), name: n.trim(), color: R.PALETTE[R.S.lists.length % R.PALETTE.length] }); R.save(); R.render(); } },
});

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const fn = R.acts[a.dataset.act]; if (fn) { fn(a, e); }
});

/* ---------- paleta de comandos ---------- */
R.paletteItems = q => {
  const nav = (label, v, sel) => ({ label, hint: 'ir para', run: () => R.nav(v, sel) });
  const cmds = [
    nav('Caixa de entrada', 'tasks', { type: 'inbox' }), nav('Hoje', 'tasks', { type: 'today' }), nav('Próximos 7 dias', 'tasks', { type: 'week' }), nav('Próximas ações', 'tasks', { type: 'next' }),
    nav('Aguardando', 'tasks', { type: 'waiting' }), nav('Projetos', 'tasks', { type: 'projects' }), nav('Algum dia/talvez', 'tasks', { type: 'someday' }), nav('Agenda', 'agenda'), nav('Finanças', 'money'), nav('Hábitos e foco', 'habits'), nav('Integrações', 'settings'),
    { label: 'Processar caixa de entrada', hint: 'GTD', run: () => R.processInbox() }, { label: 'Revisão semanal', hint: 'GTD', run: () => R.weeklyReview() },
    { label: 'Novo lançamento financeiro', hint: 'criar', run: () => { R.nav('money'); R.txDialog && R.txDialog(); } },
    { label: 'Alternar tema claro/escuro', hint: 'ação', run: () => { R.S.settings.theme = R.S.settings.theme === 'dark' ? 'light' : 'dark'; R.save(); R.render(); } },
    { label: 'Exportar backup (JSON)', hint: 'ação', run: () => R.exportJSON() }, { label: 'Desfazer', hint: 'Ctrl+Z', run: () => R.undo() },
  ];
  const ql = q.toLowerCase().trim();
  if (!ql) return cmds.slice(0, 12);
  const res = cmds.filter(c => c.label.toLowerCase().includes(ql));
  const ts = R.S.tasks.filter(t => (t.title + ' ' + t.notes).toLowerCase().includes(ql)).slice(0, 8).map(t => ({ label: t.title, hint: R.STATUS[t.status], run: () => R.taskDialog(t.id) }));
  const tx = ((R.S.fin && R.S.fin.txs) || []).filter(t => t.desc.toLowerCase().includes(ql)).slice(0, 5).map(t => ({ label: `${t.desc} — ${R.brl(t.kind === 'in' ? t.amount : -t.amount)}`, hint: 'lançamento', run: () => { R.ui.month = t.date.slice(0, 7); R.nav('money'); } }));
  if (R.parseQuick(q).title) res.unshift({ label: `Capturar: "${q}"`, hint: 'Enter', run: () => { R.capture(q); R.render(); R.toast('Capturado.'); } });
  return [...res, ...ts, ...tx];
};
R.openPalette = () => {
  const d = R.$('#palette'), inp = R.$('#pin'), list = R.$('#plist'); let items = [], idx = 0;
  const draw = () => { items = R.paletteItems(inp.value); idx = Math.min(idx, Math.max(0, items.length - 1)); list.innerHTML = items.map((it, i) => `<div class="pitem ${i === idx ? 'on' : ''}" data-i="${i}"><span>${R.esc(it.label)}</span><span class="muted small">${R.esc(it.hint)}</span></div>`).join('') || '<div class="empty">Nada encontrado</div>'; };
  inp.value = ''; draw(); if (!d.open) d.showModal(); inp.focus();
  inp.oninput = () => { idx = 0; draw(); };
  inp.onkeydown = e => { if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); draw(); e.preventDefault(); } else if (e.key === 'Enter') { const it = items[idx]; d.close(); if (it) it.run(); } };
  list.onclick = e => { const el = e.target.closest('[data-i]'); if (el) { const it = items[+el.dataset.i]; d.close(); it.run(); } };
};
R.$('#bPalette').onclick = R.openPalette;
R.$('#bTheme').onclick = () => { R.S.settings.theme = R.S.settings.theme === 'dark' ? 'light' : 'dark'; R.save(); R.render(); };

/* ---------- atalhos de teclado ---------- */
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || R.$('dialog[open]');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); R.openPalette(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); R.undo(); return; }
  if (typing) return;
  if (e.key === 'n' || e.key === 'c') { e.preventDefault(); if (R.ui.view !== 'tasks' || ['projects', 'done', 'reference'].includes(R.ui.sel.type)) R.nav('tasks', { type: 'inbox' }); const q = R.$('#quickIn'); q && q.focus(); }
  else if (e.key === '?') R.modal(`<h3>Atalhos</h3><div class="list-i"><span>Paleta de comandos</span><kbd>Ctrl K</kbd></div><div class="list-i"><span>Nova tarefa / capturar</span><kbd>N</kbd></div><div class="list-i"><span>Desfazer</span><kbd>Ctrl Z</kbd></div><div class="list-i"><span>Atalho de ir para: Hoje / Entrada / Próx.</span><kbd>g t</kbd> <kbd>g i</kbd> <kbd>g n</kbd></div><div class="actions"><button class="pri" data-act="close-modal">Fechar</button></div>`);
  else if (e.key === 'g') { R._g = Date.now(); }
  else if (R._g && Date.now() - R._g < 900) { const m = { t: { type: 'today' }, i: { type: 'inbox' }, n: { type: 'next' }, w: { type: 'week' }, p: { type: 'projects' } }[e.key]; if (m) { R.nav('tasks', m); } R._g = 0; }
});

/* ---------- lembretes (tarefas com horário e contas a vencer) ---------- */
R.notified = new Set();
R.notify = (title, body) => { try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: 'assets/icon-192.png' }); else R.toast(`${title} — ${body}`, null, 9000); } catch { R.toast(`${title} — ${body}`, null, 9000); } };
R.remind = () => {
  if (!R.S) return; const now = new Date(), T = R.iso(now), mins = now.getHours() * 60 + now.getMinutes();
  R.S.tasks.filter(t => R.isActive(t) && t.due === T && t.time && !R.hiddenByStart(t)).forEach(t => {
    const m = R.toMin(t.time), key = 't' + t.id + T + t.time;
    if (mins >= m - 10 && mins <= m + 30 && !R.notified.has(key)) { R.notified.add(key); R.notify(mins >= m ? 'Agora: ' + t.title : `Em ${m - mins} min: ${t.title}`, t.due + ' ' + t.time); }
  });
  const tomorrow = R.addDays(T, 1); // resumo de contas: uma vez por dia, a partir das 8h
  if (mins >= 480 && !R.notified.has('bills' + T)) {
    const due = R.S.fin.txs.filter(x => x.paid === false && x.kind === 'out' && x.date >= T && x.date <= tomorrow);
    R.notified.add('bills' + T); if (due.length) R.notify(`${due.length} conta(s) a pagar hoje/amanhã`, due.slice(0, 3).map(x => `${x.desc} ${R.brl(x.amount)}`).join(' · '));
  }
};
document.addEventListener('click', () => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }, { once: true });

/* ---------- inicialização ---------- */
R.init = () => {
  const fresh = !(() => { try { return localStorage.getItem(R.KEY) || localStorage.getItem(R.OLD_KEY); } catch { return null; } })() && !window.RUMO_SEED;
  R.load();
  // Site de demonstração (?demo ou RUMO_DEMO): começa com dados fictícios.
  if (fresh && (window.RUMO_DEMO || /[?&]demo\b/.test(location.search))) R.loadSample();
  R.runRecurring(); R.setTheme();
  // Atalhos de URL: ?go=inbox|today|week|next|projects|agenda|money|money-rel|money-cartoes|habits|focus|settings
  const go = (location.search.match(/[?&]go=([\w-]+)/) || [])[1];
  if (go) { const t = { inbox: ['tasks', { type: 'inbox' }], today: ['tasks', { type: 'today' }], week: ['tasks', { type: 'week' }], next: ['tasks', { type: 'next' }], projects: ['tasks', { type: 'projects' }], agenda: ['agenda'], money: ['money'], habits: ['habits'], focus: ['habits'], settings: ['settings'], wizard: ['tasks', { type: 'inbox' }], review: ['tasks', { type: 'week' }], palette: ['tasks', { type: 'today' }] }[go.split('-')[0]]; if (t) { R.ui.view = t[0]; if (t[1]) R.ui.sel = t[1]; } if (go === 'money-rel') R.ui.mTab = 'rel'; if (go === 'money-cartoes') R.ui.mTab = 'cartoes'; if (go === 'agenda-day') R.ui.cal.mode = 'day'; if (go === 'focus') R.ui.hTab = 'foco'; }
  // Parâmetros extras (capturas de tela e atalhos): &theme=light|dark &layout=kanban|matrix &tab=lanc|cartoes|... &cal=day|week &go=wizard|review|palette
  const qp = k => (location.search.match(new RegExp('[?&]' + k + '=([\\w-]+)')) || [])[1];
  if (qp('theme')) R.S.settings.theme = qp('theme'); if (qp('layout')) R.ui.layout = qp('layout'); if (qp('tab')) R.ui.mTab = qp('tab'); if (qp('cal')) R.ui.cal.mode = qp('cal');
  R.setTheme(); R.render();
  if (go === 'wizard') R.processInbox(); else if (go === 'review') R.weeklyReview(); else if (go === 'palette') R.openPalette();
  // Primeira abertura no app local: importa seed.json da pasta de dados, se existir (migração de outro app).
  if (fresh && !window.RUMO_DEMO && !qp('demo') && location.protocol.startsWith('http') && location.hostname === 'localhost') {
    fetch('/api/seed').then(r => r.ok ? r.json() : null).then(d => { if (d && (d.tasks || d.fin || d.txs)) { R.S = R.migrate(d); R.save(); R.render(); R.toast('Seus dados foram importados.'); } }).catch(() => { });
  }
  if (R.S.settings.demo) R.$('#demoBanner').classList.remove('hide');
  setInterval(() => { if (!document.hidden && R.ui.view === 'agenda') R.render(); }, 60000);
  setInterval(R.remind, 60000); setTimeout(R.remind, 4000);
  window.addEventListener('storage', () => { R.load(); R.render(); });
};
if (!window.__NOINIT) window.addEventListener('DOMContentLoaded', R.init);
