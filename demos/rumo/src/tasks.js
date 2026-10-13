'use strict';
// Rumo — telas de tarefas: listas, kanban, matriz de Eisenhower, projetos, edição completa.

R.taskRow = (t, opts = {}) => {
  const T = R.today(), late = t.due && t.status !== 'done' && t.due < T, proj = t.project && R.project(t.project), lst = t.list && R.list(t.list);
  const subs = t.subs.length ? `${t.subs.filter(s => s.d).length}/${t.subs.length}` : '';
  const bits = [];
  if (t.due) bits.push(`<span class="${late ? 'late' : ''}">📅 ${R.fmtDate(t.due)}${t.time ? ' ' + R.esc(t.time) : ''}${t.dur ? ' · ' + R.dur(t.dur) : ''}</span>`);
  if (t.repeat) bits.push('<span title="Repete">🔁</span>');
  if (t.status === 'waiting') bits.push(`<span>⏳ ${R.esc(t.waitingFor || 'aguardando')}</span>`);
  if (t.start && t.start > T) bits.push(`<span title="Oculta até">🙈 ${R.fmtShort(t.start)}</span>`);
  if (proj && !opts.noProject) bits.push(`<span>◈ ${R.esc(proj.name)}</span>`);
  if (lst) bits.push(`<span style="color:${lst.color}">● ${R.esc(lst.name)}</span>`);
  t.contexts.forEach(c => bits.push(`<span class="tag">@${R.esc(c)}</span>`));
  t.tags.forEach(g => bits.push(`<span class="tag">#${R.esc(g)}</span>`));
  if (subs) bits.push(`<span>☑ ${subs}</span>`);
  if (t.notes) bits.push('<span title="Tem notas">📝</span>');
  if (t.source) bits.push(`<span class="badge">${R.esc(t.source.label || t.source.type)}</span>`);
  return `<div class="task ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}" draggable="true"><button class="chk p${t.prio} ${t.status === 'done' ? 'done' : ''}" data-act="task-toggle" aria-label="Concluir"></button>
    <div class="t" data-act="task-edit"><b>${R.esc(t.title)}</b><div class="meta">${bits.join('')}</div></div></div>`;
};

R.selTitle = sel => {
  const m = { inbox: '📥 Caixa de entrada', today: '📆 Hoje', week: '🗓 Próximos 7 dias', next: '⚡ Próximas ações', waiting: '⏳ Aguardando', someday: '💭 Algum dia/talvez', reference: '📎 Referência', done: '✅ Concluídas', all: '📋 Todas', projects: '◈ Projetos' };
  if (m[sel.type]) return m[sel.type];
  if (sel.type === 'list') return (R.list(sel.id) || {}).name || 'Lista';
  if (sel.type === 'tag') return '#' + sel.id; if (sel.type === 'context') return '@' + sel.id;
  if (sel.type === 'project') return '◈ ' + ((R.project(sel.id) || {}).name || 'Projeto');
  return '';
};

R.projectCard = p => {
  const ts = R.S.tasks.filter(t => t.project === p.id && t.status !== 'reference'), done = ts.filter(t => t.status === 'done').length, nxt = R.projectNextActions(p.id)[0];
  const pct = ts.length ? Math.round(done / ts.length * 100) : 0;
  return `<div class="card proj" data-id="${p.id}" style="margin-bottom:10px"><div class="row between"><div class="grow"><b data-act="project-open" style="cursor:pointer">${R.esc(p.name)}</b>${p.status !== 'active' ? ` <span class="badge warn">${p.status === 'someday' ? 'algum dia' : 'concluído'}</span>` : ''}
    <div class="muted small">${p.outcome ? R.esc(p.outcome) + ' · ' : ''}${done}/${ts.length} ações${nxt || p.status !== 'active' ? '' : ' · <span class="late">sem próxima ação</span>'}</div></div><button class="sm" data-act="project-edit">Editar</button></div>
    <div class="bar" style="margin:8px 0"><i style="width:${pct}%"></i></div>${nxt ? `<div class="small">⚡ Próxima: <b>${R.esc(nxt.title)}</b></div>` : ''}</div>`;
};

R.views.tasks = () => {
  const sel = R.ui.sel, title = R.selTitle(sel), c = R.counts();
  const isList = !['projects'].includes(sel.type);
  const lay = R.ui.layout || 'list';
  let head = `<div class="pagehead"><h1>${R.esc(title)}</h1><span class="sp"></span>`;
  if (sel.type === 'inbox' && c.inbox) head += `<button class="pri" data-act="process-inbox">⚡ Processar caixa de entrada (${c.inbox})</button>`;
  if (sel.type === 'next') head += `<div class="row wrap">${['', ...R.S.contexts.map(x => x.id)].map(x => `<button class="chip ${(sel.ctx || '') === x ? 'on' : ''}" data-act="ctx-filter" data-ctx="${R.esc(x)}">${x ? '@' + R.esc(x) : 'todos'}</button>`).join('')}</div>`;
  if (isList && sel.type !== 'reference') head += `<div class="seg"><button data-act="layout" data-l="list" class="${lay === 'list' ? 'on' : ''}">Lista</button><button data-act="layout" data-l="kanban" class="${lay === 'kanban' ? 'on' : ''}">Kanban</button><button data-act="layout" data-l="matrix" class="${lay === 'matrix' ? 'on' : ''}">Matriz</button></div>`;
  head += '</div>';
  if (sel.type === 'project') { const p = R.project(sel.id); if (p) head += `<div class="card proj" style="margin-bottom:12px"><div class="row between"><div>${p.outcome ? `<div>🎯 ${R.esc(p.outcome)}</div>` : '<div class="muted">Sem resultado definido.</div>'}</div><button class="sm" data-act="project-edit" data-id="${p.id}">Editar projeto</button></div></div>`; }
  const quick = sel.type === 'projects' ? `<div class="quick"><button class="pri" data-act="project-new">＋ Novo projeto</button></div>` :
    sel.type === 'done' || sel.type === 'reference' ? '' : `<form class="quick" id="quick"><input id="quickIn" placeholder="${sel.type === 'inbox' ? 'Capture qualquer coisa…' : 'Nova tarefa…'}  ex.: Ligar pro banco amanhã 14h !alta @telefone #contas +reforma" autocomplete="off"><button class="pri">Adicionar</button></form>`;
  let body = '';
  if (sel.type === 'projects') {
    const ps = R.S.projects.slice().sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1));
    body = ps.length ? ps.map(R.projectCard).join('') : '<div class="empty">Nenhum projeto. Um projeto é qualquer resultado que exige mais de uma ação.</div>';
  } else {
    const list = R.tasksFor(sel);
    if (lay === 'kanban' && isList) body = R.kanban(sel);
    else if (lay === 'matrix' && isList) body = R.matrix(list);
    else body = `<div class="card">${list.length ? list.map(t => R.taskRow(t, { noProject: sel.type === 'project' })).join('') : `<div class="empty">${R.emptyMsg(sel)}</div>`}</div>`;
  }
  return `<div class="page">${head}${quick}${body}</div>`;
};

R.emptyMsg = sel => ({ inbox: 'Caixa de entrada vazia. Capture o que vier à cabeça.', today: 'Nada para hoje. 🎉', week: 'Semana livre.', next: 'Sem próximas ações. Processe a caixa de entrada.', waiting: 'Nada aguardando ninguém.', someday: 'Nenhuma ideia incubando.', done: 'Nada concluído ainda.' }[sel.type] || 'Nada por aqui.');

R.kanban = sel => {
  const cols = [['inbox', 'Caixa de entrada'], ['next', 'Próximas ações'], ['waiting', 'Aguardando'], ['someday', 'Algum dia'], ['done', 'Concluídas']];
  const base = { ...sel, type: sel.type === 'done' ? 'all' : sel.type }; const pool = R.tasksFor(['today', 'week', 'next', 'waiting', 'someday', 'inbox'].includes(sel.type) ? { type: 'all' } : base);
  return `<div class="kanban">${cols.map(([s, n]) => {
    const items = s === 'done' ? R.S.tasks.filter(t => t.status === 'done').slice(-12).reverse() : pool.filter(t => t.status === s);
    return `<div class="kcol" data-status="${s}"><h4 class="row between" style="margin-bottom:8px">${n} <span class="badge">${items.length}</span></h4>${items.map(t => `<div class="kcard" draggable="true" data-id="${t.id}" data-act="task-edit"><b>${R.esc(t.title)}</b><div class="meta">${t.due ? `<span class="${t.due < R.today() && s !== 'done' ? 'late' : ''}">📅 ${R.fmtShort(t.due)}</span>` : ''}${t.contexts.map(c => `<span class="tag">@${R.esc(c)}</span>`).join('')}</div></div>`).join('')}</div>`;
  }).join('')}</div>`;
};

R.matrix = list => {
  const T2 = R.addDays(R.today(), 2), q = { a: [], b: [], c: [], d: [] };
  list.filter(t => t.status === 'next' || t.status === 'waiting').forEach(t => { const urg = t.prio === 1 || (t.due && t.due <= T2), imp = t.prio === 1 || t.prio === 2; (urg && imp ? q.a : imp ? q.b : urg ? q.c : q.d).push(t); });
  const box = (k, title, sub) => `<div class="card q"><h4>${title}</h4><div class="muted small" style="margin-bottom:6px">${sub}</div>${q[k].length ? q[k].map(t => R.taskRow(t)).join('') : '<div class="muted small">—</div>'}</div>`;
  return `<div class="matrix">${box('a', '🔥 Fazer agora', 'Urgente e importante')}${box('b', '📌 Agendar', 'Importante, não urgente')}${box('c', '🤝 Delegar', 'Urgente, menos importante')}${box('d', '🌫 Eliminar / depois', 'Nem urgente nem importante')}</div><div class="muted small" style="margin-top:8px">Dica: defina a prioridade (!alta, !média) para classificar. Urgente = prazo em até 2 dias.</div>`;
};

/* ---------- edição completa ---------- */
R.taskDialog = id => {
  const t = id ? R.task(id) : null; if (!t) return;
  const ctxSel = [...t.contexts];
  R.modal(`<form id="tform"><h3 style="margin-bottom:6px">Editar tarefa</h3>
    <label>Título</label><input name="title" value="${R.esc(t.title)}" required>
    <label>Notas</label><textarea name="notes">${R.esc(t.notes)}</textarea>
    <div class="three"><div><label>Status</label><select name="status">${Object.entries(R.STATUS).map(([k, v]) => `<option value="${k}" ${k === t.status ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label>Data</label><input type="date" name="due" value="${t.due}"></div><div><label>Hora</label><input type="time" name="time" value="${t.time}"></div></div>
    <div class="three"><div><label>Duração (min)</label><input type="number" name="dur" min="0" step="5" value="${t.dur || ''}"></div>
      <div><label>Prioridade</label><select name="prio">${[['0', 'Nenhuma'], ['1', 'Alta'], ['2', 'Média'], ['3', 'Baixa']].map(([k, v]) => `<option value="${k}" ${+k === t.prio ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label>Repetir</label><select name="repeat">${[['', 'Não repete'], ['daily', 'Todo dia'], ['weekly', 'Toda semana'], ['monthly', 'Todo mês'], ['yearly', 'Todo ano']].map(([k, v]) => `<option value="${k}" ${k === t.repeat ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
    <div class="two"><div><label>Lista</label><select name="list"><option value="">— nenhuma —</option>${R.S.lists.map(l => `<option value="${l.id}" ${l.id === t.list ? 'selected' : ''}>${R.esc(l.name)}</option>`).join('')}</select></div>
      <div><label>Projeto</label><select name="project"><option value="">— nenhum —</option>${R.S.projects.map(p => `<option value="${p.id}" ${p.id === t.project ? 'selected' : ''}>${R.esc(p.name)}</option>`).join('')}</select></div></div>
    <div class="two"><div><label>Aguardando (quem?)</label><input name="waitingFor" value="${R.esc(t.waitingFor)}"></div><div><label>Ocultar até (tickler)</label><input type="date" name="start" value="${t.start}"></div></div>
    <label>Contextos</label><div id="tctx" class="row wrap">${R.S.contexts.map(c => `<button type="button" class="chip ${ctxSel.includes(c.id) ? 'on' : ''}" data-c="${R.esc(c.id)}">@${R.esc(c.name)}</button>`).join('')}</div>
    <label>Tags (separe por vírgula)</label><input name="tags" value="${R.esc(t.tags.join(', '))}">
    <label>Subtarefas (uma por linha; "x " no início = concluída)</label><textarea name="subs">${R.esc(t.subs.map(s => (s.d ? 'x ' : '') + s.t).join('\n'))}</textarea>
    <div class="actions"><button type="button" class="danger" id="tdel">Excluir</button><button type="button" id="tdup">Duplicar</button>${R.integrationsReady && R.integrationsReady() ? '<button type="button" id="tcal">📅 Agendar no calendário</button>' : ''}<button type="button" id="tcancel">Cancelar</button><button class="pri">Salvar</button></div></form>`, { wide: true });
  R.$$('#tctx [data-c]').forEach(b => b.onclick = () => { const c = b.dataset.c, i = ctxSel.indexOf(c); i >= 0 ? ctxSel.splice(i, 1) : ctxSel.push(c); b.classList.toggle('on'); });
  R.$('#tcancel').onclick = R.closeModal;
  R.$('#tdel').onclick = () => { R.closeModal(); R.deleteTask(t.id); R.render(); };
  R.$('#tdup').onclick = () => { R.addTask({ ...t, id: R.uid(), title: t.title + ' (cópia)', created: Date.now(), status: t.status === 'done' ? 'next' : t.status, doneAt: '' }); R.closeModal(); R.render(); };
  if (R.$('#tcal')) R.$('#tcal').onclick = () => { R.closeModal(); R.scheduleOnCalendar(t.id); };
  R.$('#tform').onsubmit = e => {
    e.preventDefault(); const f = new FormData(R.$('#tform')); R.checkpoint();
    const wasDone = t.status === 'done';
    Object.assign(t, { title: f.get('title').trim() || t.title, notes: f.get('notes'), status: f.get('status'), due: f.get('due'), time: f.get('time'), dur: +f.get('dur') || 0, prio: +f.get('prio'), repeat: f.get('repeat'), list: f.get('list'), project: f.get('project'),
      waitingFor: f.get('waitingFor').trim(), start: f.get('start'), contexts: ctxSel, tags: f.get('tags').split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean),
      subs: f.get('subs').split('\n').map(s => s.trim()).filter(Boolean).map(s => /^x\s/i.test(s) ? { t: s.slice(2), d: true } : { t: s, d: false }) });
    if (t.status === 'done' && !wasDone) t.doneAt = R.today(); if (t.status !== 'done') t.doneAt = '';
    R.save(); R.closeModal(); R.render();
  };
};

R.projectDialog = id => {
  const p = id ? R.project(id) : { id: '', name: '', outcome: '', status: 'active' };
  R.modal(`<form id="pform"><h3>${id ? 'Editar projeto' : 'Novo projeto'}</h3><label>Nome</label><input name="name" value="${R.esc(p.name)}" required><label>Resultado desejado (como saberá que terminou?)</label><textarea name="outcome">${R.esc(p.outcome)}</textarea>
    <label>Status</label><select name="status">${[['active', 'Ativo'], ['someday', 'Algum dia/talvez'], ['done', 'Concluído']].map(([k, v]) => `<option value="${k}" ${k === p.status ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <div class="actions">${id ? '<button type="button" class="danger" id="pdel">Excluir</button>' : ''}<button type="button" id="pcancel">Cancelar</button><button class="pri">Salvar</button></div></form>`);
  R.$('#pcancel').onclick = R.closeModal;
  if (id) R.$('#pdel').onclick = async () => { if (await R.confirm('Excluir o projeto? As tarefas ficam sem projeto.', 'Excluir')) { R.checkpoint(); R.S.tasks.forEach(t => { if (t.project === id) t.project = ''; }); R.S.projects = R.S.projects.filter(x => x.id !== id); R.ui.sel = { type: 'projects' }; R.save(); R.closeModal(); R.render(); } };
  R.$('#pform').onsubmit = e => { e.preventDefault(); const f = new FormData(R.$('#pform')); R.checkpoint(); if (id) Object.assign(p, { name: f.get('name').trim(), outcome: f.get('outcome'), status: f.get('status') }); else R.S.projects.push({ id: R.uid(), name: f.get('name').trim(), outcome: f.get('outcome'), status: f.get('status'), created: Date.now() }); R.save(); R.closeModal(); R.render(); };
};

/* ---------- ações ---------- */
Object.assign(R.acts, {
  'task-toggle': (el, ev) => { ev.stopPropagation(); const id = el.closest('[data-id]').dataset.id; R.completeTask(id); R.render(); },
  'task-edit': el => R.taskDialog(el.closest('[data-id]').dataset.id),
  'process-inbox': () => R.processInbox(),
  'layout': el => { R.ui.layout = el.dataset.l; R.render(); },
  'ctx-filter': el => { R.ui.sel = { type: 'next', ctx: el.dataset.ctx }; R.render(); },
  'project-new': () => R.projectDialog(''),
  'project-edit': el => R.projectDialog(el.dataset.id || el.closest('[data-id]').dataset.id),
  'project-open': el => { R.ui.sel = { type: 'project', id: el.closest('[data-id]').dataset.id }; R.ui.layout = 'list'; R.render(); },
});

R.bindTasks = () => {
  const q = R.$('#quick');
  if (q) q.onsubmit = e => { e.preventDefault(); const t = R.capture(R.$('#quickIn').value); if (t) { R.render(); const n = R.$('#quickIn'); n && n.focus(); R.toast(t.status === 'inbox' ? 'Capturado na Caixa de entrada.' : 'Tarefa criada.'); } };
  // arrastar entre colunas do kanban
  R.$$('.kcard, .task').forEach(el => el.ondragstart = e => { e.dataTransfer.setData('text/plain', el.dataset.id); e.dataTransfer.effectAllowed = 'move'; });
  R.$$('.kcol').forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('over'); }; col.ondragleave = () => col.classList.remove('over');
    col.ondrop = e => { e.preventDefault(); col.classList.remove('over'); const t = R.task(e.dataTransfer.getData('text/plain')); if (!t) return; R.checkpoint(); const s = col.dataset.status; t.status = s; t.doneAt = s === 'done' ? R.today() : ''; R.save(); R.render(); };
  });
};
R.hooks.push(() => { if (R.ui.view === 'tasks') R.bindTasks(); });
