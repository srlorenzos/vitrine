'use strict';
// Rumo — Agenda: mês, semana e dia; tarefas com horário + eventos (Google, Outlook, .ics); planejamento automático do dia.

R.dayItems = date => {
  const items = [];
  (R.S.events || []).forEach(e => {
    const sd = e.start.slice(0, 10), ed = (e.end || e.start).slice(0, 10);
    if (date < sd || date > ed) return;
    if (e.allDay) items.push({ kind: 'ev', id: e.id, title: e.title, allDay: true, src: e.source, link: e.link });
    else { const s = sd === date ? R.toMin(e.start.slice(11, 16)) : 0, en = ed === date ? R.toMin((e.end || e.start).slice(11, 16)) : 1440; items.push({ kind: 'ev', id: e.id, title: e.title, startMin: s, endMin: Math.max(en, s + 15), src: e.source, link: e.link }); }
  });
  R.S.tasks.filter(t => t.due === date && t.status !== 'done' && t.status !== 'reference' && !R.hiddenByStart(t)).forEach(t => {
    if (t.time) { const s = R.toMin(t.time); items.push({ kind: 'task', id: t.id, title: t.title, startMin: s, endMin: s + (t.dur || 30), src: 't' }); }
    else items.push({ kind: 'task', id: t.id, title: t.title, allDay: true, untimed: true, src: 't' });
  });
  return items;
};
R.srcClass = s => ({ google: 'g', ms: 'm', ics: '', t: 't' }[s] || '');

R.freeSlots = (date, from, to) => {
  const busy = R.dayItems(date).filter(i => !i.allDay).map(i => [i.startMin, i.endMin]).sort((a, b) => a[0] - b[0]);
  const free = []; let cur = from;
  for (const [s, e] of busy) { if (s > cur) free.push([cur, Math.min(s, to)]); cur = Math.max(cur, e); if (cur >= to) break; }
  if (cur < to) free.push([cur, to]); return free.filter(([a, b]) => b - a >= 15);
};

// Planejamento automático: encaixa as tarefas sem horário do dia nos intervalos livres, respeitando prioridade.
R.autoPlan = date => {
  const st = R.toMin(R.S.settings.workStart), en = R.toMin(R.S.settings.workEnd);
  const now = date === R.today() ? Math.ceil((new Date().getHours() * 60 + new Date().getMinutes()) / 15) * 15 : 0;
  const todo = R.S.tasks.filter(t => t.due === date && !t.time && R.isActive(t) && t.status !== 'someday' && !R.hiddenByStart(t)).sort((a, b) => ((a.prio || 9) - (b.prio || 9)) || a.created - b.created);
  if (!todo.length) { R.toast('Não há tarefas sem horário neste dia.'); return; }
  if (Math.max(st, now) >= en) { R.toast(`O expediente (${R.S.settings.workStart}–${R.S.settings.workEnd}) já acabou hoje. Planeje o dia de amanhã.`); return; }
  R.checkpoint(); let placed = 0;
  for (const t of todo) {
    const d = t.dur || 30, slots = R.freeSlots(date, Math.max(st, now), en), s = slots.find(([a, b]) => b - a >= d);
    if (!s) continue; t.time = R.hm(s[0]); t.dur = d; placed++;
  }
  if (!placed) { R.history.pop(); R.toast('Sem espaço livre no expediente para essas tarefas.'); return; }
  R.save(); R.render(); R.toast(`${placed} de ${todo.length} tarefa(s) encaixada(s) na agenda.`, { label: 'Desfazer', fn: R.undo });
};

R.views.agenda = () => {
  const c = R.ui.cal, d = c.date, dt = R.parse(d);
  const hasInt = R.integrationsReady && R.integrationsReady();
  let title = '', body = '';
  if (c.mode === 'month') {
    const ym = d.slice(0, 7), [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1), start = new Date(first); start.setDate(1 - first.getDay());
    title = `${R.MONTHS[m - 1]} ${y}`;
    let cells = R.WD.map(w => `<div class="h">${w}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const x = new Date(start); x.setDate(start.getDate() + i); const k = R.iso(x), its = R.dayItems(k);
      cells += `<div class="d ${k === R.today() ? 'today' : ''} ${x.getMonth() !== m - 1 ? 'out' : ''}" data-act="cal-day" data-day="${k}"><b>${x.getDate()}</b>${its.slice(0, 3).map(i => `<span class="ev ${R.srcClass(i.src)}">${i.startMin != null ? R.hm(i.startMin) + ' ' : ''}${R.esc(i.title)}</span>`).join('')}${its.length > 3 ? `<span class="muted">+${its.length - 3}</span>` : ''}</div>`;
    }
    body = `<div class="cal">${cells}</div>`;
  } else if (c.mode === 'week') {
    const s = R.startOfWeek(d); title = `Semana de ${R.fmtShort(s)}`;
    body = `<div class="grid" style="gap:10px">${[...Array(7)].map((_, i) => { const k = R.addDays(s, i), its = R.dayItems(k).sort((a, b) => (a.startMin ?? -1) - (b.startMin ?? -1)); return `<div class="card ${k === R.today() ? 'proj' : ''}"><div class="row between"><b>${R.WDL[i]} ${R.fmtShort(k)}</b><button class="sm" data-act="cal-open" data-day="${k}">Abrir dia</button></div>${its.length ? its.map(i2 => `<div class="list-i small" ${i2.kind === 'task' ? `data-id="${i2.id}" data-act="task-edit" style="cursor:pointer"` : ''}><span><span class="ev ${R.srcClass(i2.src)}" style="display:inline">${i2.allDay ? 'dia todo' : R.hm(i2.startMin) + '–' + R.hm(i2.endMin)}</span> ${R.esc(i2.title)}</span></div>`).join('') : '<div class="muted small">Livre</div>'}</div>`; }).join('')}</div>`;
  } else {
    title = `${R.WDL[dt.getDay()]}, ${R.pad(dt.getDate())} de ${R.MONTHS[dt.getMonth()]}`;
    const its = R.dayItems(d), allday = its.filter(i => i.allDay), H = 44;
    const startH = R.clamp(Math.floor(R.toMin(R.S.settings.workStart) / 60) - 1, 0, 12), hoursH = (24 - startH) * H, y = min => (min - startH * 60) / 60 * H;
    // Itens simultâneos dividem a largura (colunas por grupo de sobreposição).
    const timed = (() => { const arr = its.filter(i => !i.allDay).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin), out = []; let group = [], gEnd = 0;
      const flush = () => { const cols = []; group.forEach(it => { let c = cols.findIndex(e => e <= it.startMin); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = it.endMin; it.col = c; }); group.forEach(it => it.cols = cols.length); out.push(...group); group = []; };
      arr.forEach(it => { if (group.length && it.startMin >= gEnd) { flush(); gEnd = 0; } group.push(it); gEnd = Math.max(gEnd, it.endMin); }); if (group.length) flush(); return out; })();
    const now = new Date(), nowTop = y(now.getHours() * 60 + now.getMinutes());
    body = `<div class="row wrap" style="margin-bottom:10px"><button class="pri" data-act="autoplan" data-day="${d}">✨ Planejar meu dia (auto)</button><span class="muted small">Encaixa as tarefas sem horário nos intervalos livres (${R.S.settings.workStart}–${R.S.settings.workEnd}).</span></div>
      ${allday.length ? `<div class="card" style="margin-bottom:10px"><div class="muted small" style="margin-bottom:4px">Dia todo / sem horário</div>${allday.map(i => `<div class="list-i small" ${i.kind === 'task' ? `data-id="${i.id}" data-act="task-edit" style="cursor:pointer"` : ''}><span><span class="ev ${R.srcClass(i.src)}" style="display:inline">${i.kind === 'task' ? 'tarefa' : 'evento'}</span> ${R.esc(i.title)}</span></div>`).join('')}</div>` : ''}
      <div class="card"><div class="day"><div></div><div class="hours" id="hours" style="height:${hoursH}px">${[...Array(24 - startH)].map((_, k) => `<div class="hl" style="top:${k * H}px">${R.pad(startH + k)}:00</div>`).join('')}
      ${timed.map(i => `<div class="blk ${R.srcClass(i.src)}" ${i.kind === 'task' ? `data-id="${i.id}" data-act="task-edit"` : ''} style="top:${Math.max(0, y(i.startMin))}px;height:${Math.max(18, (i.endMin - i.startMin) / 60 * H - 2)}px;left:calc(${i.col / i.cols * 100}% + 6px);width:calc(${100 / i.cols}% - 12px);right:auto"><b>${R.hm(i.startMin)}</b> ${R.esc(i.title)}${i.kind === 'task' ? ' ✔' : ''}</div>`).join('')}
      ${d === R.today() && nowTop >= 0 ? `<div class="nowline" style="top:${nowTop}px"></div>` : ''}</div></div></div>`;
  }
  const nav = `<div class="row"><button data-act="cal-prev">‹</button><button data-act="cal-today">Hoje</button><button data-act="cal-next">›</button></div>`;
  return `<div class="page"><div class="pagehead"><h1>📅 Agenda</h1><span class="sp"></span>${hasInt ? '<button data-act="sync">⟳ Sincronizar</button>' : '<button data-act="nav" data-v="settings">🔌 Conectar calendários</button>'}<button data-act="ics-import">Importar .ics</button><input type="file" id="icsFile" accept=".ics,text/calendar" hidden>
    <div class="seg">${[['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês']].map(([k, v]) => `<button data-act="cal-mode" data-m="${k}" class="${c.mode === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
    <div class="row between" style="margin-bottom:12px"><h2>${R.esc(title)}</h2>${nav}</div>${body}
    <div class="muted small" style="margin-top:12px"><span class="ev" style="display:inline">Rumo</span> <span class="ev g" style="display:inline">Google</span> <span class="ev m" style="display:inline">Outlook</span> <span class="ev t" style="display:inline">Tarefas</span></div></div>`;
};

R.parseICS = text => {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/), evs = []; let cur = null;
  const conv = v => { const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/); if (!m) return null; return m[4] ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : `${m[1]}-${m[2]}-${m[3]}`; };
  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') cur = {}; else if (l === 'END:VEVENT') { if (cur && cur.start) evs.push(cur); cur = null; }
    else if (cur) { const i = l.indexOf(':'); if (i < 0) continue; const k = l.slice(0, i).split(';')[0], v = l.slice(i + 1);
      if (k === 'SUMMARY') cur.title = v.replace(/\\,/g, ',').replace(/\\n/g, ' '); else if (k === 'DTSTART') { cur.start = conv(v); cur.allDay = !v.includes('T'); } else if (k === 'DTEND') cur.end = conv(v); else if (k === 'UID') cur.uid = v; }
  }
  return evs.map(e => { if (e.allDay && e.end) { const ed = R.addDays(e.end.slice(0, 10), -1); e.end = ed < e.start.slice(0, 10) ? e.start : ed; } return { id: 'ics-' + (e.uid || R.uid()), title: e.title || '(sem título)', start: e.start, end: e.end || e.start, allDay: !!e.allDay, source: 'ics' }; });
};

Object.assign(R.acts, {
  'cal-mode': el => { R.ui.cal.mode = el.dataset.m; R.render(); },
  'cal-today': () => { R.ui.cal.date = R.today(); R.render(); },
  'cal-prev': () => { const c = R.ui.cal; c.date = c.mode === 'month' ? R.addMonths(c.date, -1) : R.addDays(c.date, c.mode === 'week' ? -7 : -1); R.render(); },
  'cal-next': () => { const c = R.ui.cal; c.date = c.mode === 'month' ? R.addMonths(c.date, 1) : R.addDays(c.date, c.mode === 'week' ? 7 : 1); R.render(); },
  'cal-day': el => { R.ui.cal.date = el.dataset.day; R.ui.cal.mode = 'day'; R.render(); },
  'cal-open': el => { R.ui.cal.date = el.dataset.day; R.ui.cal.mode = 'day'; R.render(); },
  autoplan: el => R.autoPlan(el.dataset.day),
  'ics-import': () => R.$('#icsFile').click(),
  sync: () => R.syncAll && R.syncAll(),
});
R.hooks.push(() => {
  const f = R.$('#icsFile');
  if (f) f.onchange = async () => { const file = f.files[0]; if (!file) return; const evs = R.parseICS(await R.readFile(file)); R.S.events = (R.S.events || []).filter(e => e.source !== 'ics').concat(evs); R.save(); R.render(); R.toast(`${evs.length} evento(s) importado(s).`); };
});
