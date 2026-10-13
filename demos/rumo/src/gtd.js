'use strict';
// Rumo — motor GTD (Getting Things Done): captura → esclarecer → organizar → revisar → engajar.
// Estados de uma tarefa: inbox | next | waiting | someday | reference | done

R.STATUS = { inbox: 'Caixa de entrada', next: 'Próxima ação', waiting: 'Aguardando', someday: 'Algum dia/talvez', reference: 'Referência', done: 'Concluída' };

R.newTask = (d = {}) => Object.assign({
  id: R.uid(), title: '', notes: '', status: 'inbox', due: '', time: '', dur: 0, prio: 0, list: '', project: '', contexts: [], tags: [], subs: [],
  repeat: '', waitingFor: '', start: '', energy: '', source: null, created: Date.now(), doneAt: '',
}, d);

R.addTask = d => { const t = R.newTask(d); R.S.tasks.push(t); R.save(); return t; };

// Captura rápida: tudo vai para a Caixa de entrada, exceto quando já vem "clarificado" (data, @contexto, +projeto).
R.capture = (text, forceStatus) => {
  const sel = R.ui.sel || {};
  const p = R.parseQuick(text);
  if (!p.title) return null;
  let project = '';
  if (p.projectName) {
    const found = R.S.projects.find(x => x.name.toLowerCase().replace(/\s+/g, '-') === p.projectName.toLowerCase() || x.name.toLowerCase().startsWith(p.projectName.toLowerCase()));
    project = found ? found.id : '';
    if (!found) { const np = { id: R.uid(), name: p.projectName.replace(/-/g, ' '), outcome: '', status: 'active', created: Date.now() }; R.S.projects.push(np); project = np.id; }
  }
  if (sel.type === 'project') project = sel.id;
  const ctx = p.contexts.filter(Boolean);
  ctx.forEach(c => { if (!R.S.contexts.some(x => x.id === c)) R.S.contexts.push({ id: c, name: c }); });
  const clarified = !!(p.due || ctx.length || project || sel.type === 'list' || sel.type === 'context' || sel.type === 'next' || sel.type === 'today' || sel.type === 'week');
  let status = forceStatus || (clarified ? 'next' : 'inbox');
  if (sel.type === 'waiting') status = 'waiting'; if (sel.type === 'someday') status = 'someday'; if (sel.type === 'inbox') status = 'inbox';
  const t = R.addTask({
    title: p.title, due: p.due || (sel.type === 'today' && status !== 'inbox' ? R.today() : ''), time: p.time, dur: p.dur, prio: p.prio, tags: p.tags, contexts: ctx, repeat: p.repeat, project,
    list: sel.type === 'list' ? sel.id : '', status,
  });
  return t;
};

R.completeTask = id => {
  const t = R.task(id); if (!t) return;
  R.checkpoint();
  if (t.status !== 'done' && t.repeat && t.due) {
    const next = t.repeat === 'daily' ? R.addDays(t.due, 1) : t.repeat === 'weekly' ? R.addDays(t.due, 7) : t.repeat === 'monthly' ? R.addMonths(t.due, 1) : R.addMonths(t.due, 12);
    const log = R.newTask(Object.assign({}, t, { id: R.uid(), status: 'done', doneAt: R.today(), repeat: '', created: Date.now() }));
    R.S.tasks.push(log); t.due = next; t.subs.forEach(s => s.d = false);
    R.save(); R.toast(`Repete ${R.fmtDate(next).toLowerCase()}.`, { label: 'Desfazer', fn: R.undo }); return;
  }
  if (t.status === 'done') { t.status = t.project ? 'next' : 'next'; t.doneAt = ''; }
  else { t.status = 'done'; t.doneAt = R.today(); R.toast('Concluída.', { label: 'Desfazer', fn: R.undo }); }
  R.save();
};

R.deleteTask = id => { R.checkpoint(); R.S.tasks = R.S.tasks.filter(t => t.id !== id); R.save(); R.toast('Tarefa excluída.', { label: 'Desfazer', fn: R.undo }); };

/* ---------- consultas ---------- */
R.isActive = t => t.status !== 'done' && t.status !== 'reference';
R.hiddenByStart = t => t.start && t.start > R.today();         // tickler: some até a data de início
R.projectNextActions = pid => R.S.tasks.filter(t => t.project === pid && t.status === 'next' && !R.hiddenByStart(t));
R.stalledProjects = () => R.S.projects.filter(p => p.status === 'active' && !R.projectNextActions(p.id).length);

R.tasksFor = sel => {
  const T = R.today(), all = R.S.tasks, act = all.filter(t => t.status !== 'done' && t.status !== 'reference');
  const vis = act.filter(t => !R.hiddenByStart(t));
  let r;
  switch (sel.type) {
    case 'inbox': r = act.filter(t => t.status === 'inbox'); break;
    case 'today': r = vis.filter(t => t.status !== 'someday' && t.status !== 'inbox' && t.due && t.due <= T); break;
    case 'week': r = vis.filter(t => t.status !== 'someday' && t.status !== 'inbox' && t.due && t.due <= R.addDays(T, 7)); break;
    case 'next': r = vis.filter(t => t.status === 'next'); if (sel.ctx) r = r.filter(t => t.contexts.includes(sel.ctx)); break;
    case 'waiting': r = act.filter(t => t.status === 'waiting'); break;
    case 'someday': r = act.filter(t => t.status === 'someday'); break;
    case 'reference': r = all.filter(t => t.status === 'reference'); break;
    case 'done': r = all.filter(t => t.status === 'done').sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')); return r.slice(0, 300);
    case 'list': r = act.filter(t => t.list === sel.id); break;
    case 'tag': r = act.filter(t => t.tags.includes(sel.id)); break;
    case 'context': r = vis.filter(t => t.contexts.includes(sel.id)); break;
    case 'project': r = all.filter(t => t.project === sel.id && t.status !== 'reference'); break;
    case 'all': default: r = act;
  }
  return r.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.time || '').localeCompare(b.time || '') || ((a.prio || 9) - (b.prio || 9)) || a.created - b.created);
};

R.counts = () => {
  const T = R.today(), act = R.S.tasks.filter(R.isActive), vis = act.filter(t => !R.hiddenByStart(t));
  return {
    inbox: act.filter(t => t.status === 'inbox').length,
    today: vis.filter(t => t.status !== 'someday' && t.status !== 'inbox' && t.due && t.due <= T).length,
    late: vis.filter(t => t.due && t.due < T && t.status !== 'someday').length,
    week: vis.filter(t => t.status !== 'someday' && t.status !== 'inbox' && t.due && t.due <= R.addDays(T, 7)).length,
    next: vis.filter(t => t.status === 'next').length, waiting: act.filter(t => t.status === 'waiting').length, someday: act.filter(t => t.status === 'someday').length,
    projects: R.S.projects.filter(p => p.status === 'active').length, stalled: R.stalledProjects().length,
  };
};

/* ---------- processar a caixa de entrada (esclarecer) ---------- */
R.processInbox = () => {
  const inbox = () => R.S.tasks.filter(t => t.status === 'inbox').sort((a, b) => a.created - b.created);
  const total0 = inbox().length;
  if (!total0) { R.toast('Caixa de entrada vazia. 🎉'); return; }
  let step = 'actionable', draft = {};
  const projectOptions = () => `<option value="">— nenhum —</option>${R.S.projects.filter(p => p.status === 'active').map(p => `<option value="${p.id}">${R.esc(p.name)}</option>`).join('')}`;
  const ctxChips = sel => R.S.contexts.map(c => `<button class="chip ${sel.includes(c.id) ? 'on' : ''}" data-ctx="${R.esc(c.id)}">@${R.esc(c.name)}</button>`).join(' ');
  const draw = () => {
    const list = inbox(); const t = list[0];
    if (!t) { R.closeModal(); R.S.inboxZeroStreak++; R.save(); R.render(); R.toast('Caixa de entrada zerada! 🎉'); return; }
    const done = total0 - list.length + 1;
    const head = `<div class="row between small muted"><span>Item ${done} de ${total0}</span><button class="ghost sm" id="wClose">Sair</button></div><div class="wizard"><h2>${R.esc(t.title)}</h2>${t.notes ? `<p class="muted small">${R.esc(t.notes.slice(0, 200))}</p>` : ''}`;
    let body = '';
    if (step === 'actionable') body = `<p><b>Isso exige uma ação?</b></p><div class="opts"><button data-s="yes" class="pri">Sim, exige ação</button><button data-s="no">Não</button></div>`;
    else if (step === 'no') body = `<p><b>O que fazer com isso?</b></p><div class="opts"><button data-do="trash">🗑 Lixo — excluir</button><button data-do="reference">📎 Referência — guardar para consulta</button><button data-do="someday">💭 Algum dia/talvez — incubar</button><button data-s="actionable" class="ghost">‹ Voltar</button></div>`;
    else if (step === 'yes') body = `<p><b>É um projeto?</b> <span class="muted small">(precisa de mais de uma etapa)</span></p><div class="opts"><button data-s="project">Sim, é um projeto</button><button data-s="two">Não, é uma ação única</button><button data-s="actionable" class="ghost">‹ Voltar</button></div>`;
    else if (step === 'project') body = `<p><b>Nome do projeto e a próxima ação</b></p><label>Resultado desejado (projeto)</label><input id="pjName" value="${R.esc(t.title)}"><label>Qual é a PRÓXIMA ação física?</label><input id="pjNext" placeholder="ex.: Ligar para o fornecedor"><div class="actions"><button data-s="yes">‹ Voltar</button><button class="pri" id="pjOk">Criar projeto</button></div>`;
    else if (step === 'two') body = `<p><b>Leva menos de 2 minutos?</b></p><div class="opts"><button data-do="now" class="pri">⚡ Sim — faça agora e conclua</button><button data-s="who">Não — organizar</button><button data-s="yes" class="ghost">‹ Voltar</button></div>`;
    else if (step === 'who') body = `<p><b>Quem faz?</b></p><div class="opts"><button data-s="me">Eu mesmo</button><button data-s="delegate">Outra pessoa (aguardar)</button><button data-s="two" class="ghost">‹ Voltar</button></div>`;
    else if (step === 'delegate') body = `<label>Delegado a / aguardando</label><input id="dgWho" placeholder="ex.: Maria, contabilidade, fornecedor"><label>Cobrar em (opcional)</label><input type="date" id="dgDue"><div class="actions"><button data-s="who">‹ Voltar</button><button class="pri" id="dgOk">Mover para Aguardando</button></div>`;
    else if (step === 'me') body = `<p><b>Quando?</b></p><div class="two" style="text-align:left"><div><label>Data (opcional)</label><input type="date" id="meDue" value="${draft.due || t.due || ''}"></div><div><label>Hora</label><input type="time" id="meTime" value="${draft.time || t.time || ''}"></div></div>
      <div class="two" style="text-align:left"><div><label>Duração (min)</label><input type="number" id="meDur" min="0" step="5" value="${draft.dur || t.dur || ''}"></div><div><label>Prioridade</label><select id="mePrio"><option value="0">Nenhuma</option><option value="1">Alta</option><option value="2">Média</option><option value="3">Baixa</option></select></div></div>
      <label>Contexto</label><div id="meCtx" style="text-align:left">${ctxChips(draft.contexts || t.contexts || [])}</div><label>Projeto</label><select id="meProj">${projectOptions()}</select>
      <div class="actions"><button data-s="who">‹ Voltar</button><button class="pri" id="meOk">Salvar como próxima ação</button></div>`;
    R.modal(head + body + '</div>');
    R.$('#wClose').onclick = () => { R.closeModal(); R.render(); };
    if (step === 'me') { R.$('#mePrio').value = String(draft.prio ?? t.prio ?? 0); R.$('#meProj').value = t.project || ''; }
    R.$$('#dlg [data-s]').forEach(b => b.onclick = () => { step = b.dataset.s; draw(); });
    R.$$('#dlg [data-ctx]').forEach(b => b.onclick = () => { draft.contexts = draft.contexts || [...(t.contexts || [])]; const c = b.dataset.ctx, i = draft.contexts.indexOf(c); i >= 0 ? draft.contexts.splice(i, 1) : draft.contexts.push(c); b.classList.toggle('on'); });
    R.$$('#dlg [data-do]').forEach(b => b.onclick = () => {
      const a = b.dataset.do; R.checkpoint();
      if (a === 'trash') R.S.tasks = R.S.tasks.filter(x => x.id !== t.id);
      else if (a === 'reference') t.status = 'reference';
      else if (a === 'someday') t.status = 'someday';
      else if (a === 'now') { t.status = 'done'; t.doneAt = R.today(); }
      R.save(); step = 'actionable'; draft = {}; draw();
    });
    if (R.$('#pjOk')) R.$('#pjOk').onclick = () => {
      const nm = R.$('#pjName').value.trim() || t.title, nx = R.$('#pjNext').value.trim(); R.checkpoint();
      const p = { id: R.uid(), name: nm, outcome: '', status: 'active', created: Date.now() }; R.S.projects.push(p);
      if (nx) { t.title = nx; t.status = 'next'; t.project = p.id; } else R.S.tasks = R.S.tasks.filter(x => x.id !== t.id);
      R.save(); step = 'actionable'; draft = {}; draw();
    };
    if (R.$('#dgOk')) R.$('#dgOk').onclick = () => { R.checkpoint(); t.status = 'waiting'; t.waitingFor = R.$('#dgWho').value.trim(); t.due = R.$('#dgDue').value; t.start = ''; R.save(); step = 'actionable'; draft = {}; draw(); };
    if (R.$('#meOk')) R.$('#meOk').onclick = () => {
      R.checkpoint(); t.status = 'next'; t.due = R.$('#meDue').value; t.time = R.$('#meTime').value; t.dur = +R.$('#meDur').value || 0; t.prio = +R.$('#mePrio').value; t.project = R.$('#meProj').value;
      t.contexts = draft.contexts || t.contexts || []; R.save(); step = 'actionable'; draft = {}; draw();
    };
  };
  draw();
};

/* ---------- revisão semanal ---------- */
R.weeklyReview = () => {
  const steps = [
    { t: 'Esvazie a cabeça', d: 'Anote tudo que ainda está na sua mente: compromissos, preocupações, ideias. Capture cada coisa na caixa de entrada.', html: () => `<div class="quick"><input id="rvCap" placeholder="Capturar algo agora…"><button class="pri" id="rvAdd">Capturar</button></div>` },
    { t: 'Zere a caixa de entrada', d: () => `Você tem ${R.counts().inbox} item(ns) por processar.`, html: () => `<button class="pri" id="rvProc" ${R.counts().inbox ? '' : 'disabled'}>Processar agora</button>` },
    { t: 'Revise o passado e o futuro da agenda', d: () => `${R.counts().late} tarefa(s) atrasada(s) e ${R.counts().week} nos próximos 7 dias.`, html: () => { const late = R.tasksFor({ type: 'week' }).slice(0, 8); return late.length ? late.map(t => `<div class="list-i small"><span>${R.esc(t.title)}</span><span class="${t.due < R.today() ? 'late' : 'muted'}">${R.fmtDate(t.due)}</span></div>`).join('') : '<div class="muted small">Nada pendente. 👌</div>'; } },
    { t: 'Revise "Aguardando"', d: () => `${R.counts().waiting} item(ns) esperando resposta de alguém.`, html: () => { const w = R.tasksFor({ type: 'waiting' }); return w.length ? w.map(t => `<div class="list-i small"><span>${R.esc(t.title)} <span class="muted">— ${R.esc(t.waitingFor || '?')}</span></span><button class="sm" data-rv-ping="${t.id}">Cobrar hoje</button></div>`).join('') : '<div class="muted small">Nada aguardando.</div>'; } },
    { t: 'Projetos precisam de próxima ação', d: () => `${R.stalledProjects().length} projeto(s) ativo(s) sem próxima ação.`, html: () => { const s = R.stalledProjects(); return s.length ? s.map(p => `<div class="list-i small"><span>${R.esc(p.name)}</span><button class="sm" data-rv-next="${p.id}">Definir próxima ação</button></div>`).join('') : '<div class="muted small">Todos os projetos têm próxima ação. ✅</div>'; } },
    { t: 'Algum dia/talvez', d: () => `${R.counts().someday} ideia(s) incubando — algo está maduro para virar ação?`, html: () => { const s = R.tasksFor({ type: 'someday' }).slice(0, 8); return s.length ? s.map(t => `<div class="list-i small"><span>${R.esc(t.title)}</span><button class="sm" data-rv-act="${t.id}">Ativar</button></div>`).join('') : '<div class="muted small">Lista vazia.</div>'; } },
    { t: 'Finanças e hábitos', d: 'Dê uma olhada rápida: contas a vencer, orçamento do mês e sequência de hábitos.', html: () => { const f = R.finSummary ? R.finSummary(R.monthKey(R.today())) : null; return f ? `<div class="grid g3"><div class="stat"><small>Receitas</small><b class="pos">${R.brl(f.inc)}</b></div><div class="stat"><small>Despesas</small><b class="neg">${R.brl(f.out)}</b></div><div class="stat"><small>Resultado</small><b class="${f.bal >= 0 ? 'pos' : 'neg'}">${R.brl(f.bal)}</b></div></div>` : ''; } },
    { t: 'Pronto!', d: 'Revisão concluída. Você está com a cabeça limpa e um sistema confiável.', html: () => '<div style="font-size:48px">🏁</div>' },
  ];
  let i = 0;
  const draw = () => {
    const s = steps[i], d = typeof s.d === 'function' ? s.d() : s.d;
    R.modal(`<div class="row between small muted"><span>Revisão semanal — passo ${i + 1} de ${steps.length}</span><button class="ghost sm" id="rvX">Sair</button></div><div class="bar" style="margin:8px 0 14px"><i style="width:${(i + 1) / steps.length * 100}%"></i></div>
      <h2>${s.t}</h2><p class="muted">${d}</p><div id="rvBody">${s.html()}</div>
      <div class="actions">${i ? '<button id="rvPrev">‹ Anterior</button>' : ''}<button class="pri" id="rvNext">${i === steps.length - 1 ? 'Concluir revisão' : 'Próximo ›'}</button></div>`, { wide: true });
    R.$('#rvX').onclick = () => { R.closeModal(); R.render(); };
    if (R.$('#rvPrev')) R.$('#rvPrev').onclick = () => { i--; draw(); };
    R.$('#rvNext').onclick = () => { if (i === steps.length - 1) { R.S.lastReview = R.today(); R.save(); R.closeModal(); R.render(); R.toast('Revisão semanal concluída. ✅'); } else { i++; draw(); } };
    if (R.$('#rvAdd')) { const go = () => { const v = R.$('#rvCap').value; if (v.trim()) { R.capture(v, 'inbox'); R.$('#rvCap').value = ''; R.toast('Capturado.'); } }; R.$('#rvAdd').onclick = go; R.$('#rvCap').onkeydown = e => { if (e.key === 'Enter') go(); }; }
    if (R.$('#rvProc')) R.$('#rvProc').onclick = () => { R.closeModal(); R.processInbox(); };
    R.$$('[data-rv-ping]').forEach(b => b.onclick = () => { const t = R.task(b.dataset.rvPing); t.due = R.today(); R.save(); b.textContent = 'Agendado'; b.disabled = true; });
    R.$$('[data-rv-act]').forEach(b => b.onclick = () => { const t = R.task(b.dataset.rvAct); t.status = 'next'; R.save(); draw(); });
    R.$$('[data-rv-next]').forEach(b => b.onclick = () => { const p = R.project(b.dataset.rvNext), v = prompt(`Próxima ação para "${p.name}":`); if (v && v.trim()) { R.addTask({ title: v.trim(), status: 'next', project: p.id }); draw(); } });
  };
  draw();
};
