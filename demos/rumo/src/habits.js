'use strict';
// Rumo — Hábitos (sequências + mapa de calor) e Foco (Pomodoro ligado a tarefas).

R.streak = h => { let n = 0, d = R.today(); if (!h.log.includes(d)) d = R.addDays(d, -1); while (h.log.includes(d)) { n++; d = R.addDays(d, -1); } return n; };
R.bestStreak = h => { const s = [...new Set(h.log)].sort(); let best = 0, cur = 0, prev = ''; for (const d of s) { cur = prev && R.addDays(prev, 1) === d ? cur + 1 : 1; best = Math.max(best, cur); prev = d; } return best; };

R.pomo = { run: false, left: 25 * 60, mode: 'focus', timer: null, task: '', len: { focus: 25, short: 5, long: 15 }, done: 0 };
R.pomoText = () => `${R.pad(Math.floor(R.pomo.left / 60))}:${R.pad(R.pomo.left % 60)}`;
R.pomoToggle = () => {
  const p = R.pomo;
  if (p.run) { clearInterval(p.timer); p.run = false; R.render(); return; }
  p.run = true; if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  p.timer = setInterval(() => {
    p.left--;
    if (p.left <= 0) {
      if (p.mode === 'focus') { R.S.focus[R.today()] = (R.S.focus[R.today()] || 0) + p.len.focus; R.save(); p.done++; p.mode = p.done % 4 === 0 ? 'long' : 'short'; p.left = p.len[p.mode] * 60; }
      else { p.mode = 'focus'; p.left = p.len.focus * 60; }
      try { new Notification(p.mode === 'focus' ? 'Hora de focar' : 'Pausa!', { body: p.task ? (R.task(p.task) || {}).title : 'Rumo' }); } catch { }
      try { const ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(); o.connect(ac.destination); o.frequency.value = 880; o.start(); o.stop(ac.currentTime + .25); } catch { }
      R.render();
    }
    const el = R.$('#pomoTime'); if (el) el.textContent = R.pomoText(); document.title = (p.run ? R.pomoText() + ' · ' : '') + 'Rumo';
  }, 1000);
  R.render();
};

R.views.habits = () => {
  const tab = R.ui.hTab, T = R.today();
  let body = '';
  if (tab === 'habitos') {
    const days = [...Array(7)].map((_, i) => R.addDays(T, i - 6));
    body = `<form class="quick" id="habForm"><input name="name" placeholder="Novo hábito… ex.: Beber 2 L de água" required><button class="pri">Adicionar</button></form>` +
      (R.S.habits.length ? R.S.habits.map(h => `<div class="card" style="margin-bottom:10px" data-id="${h.id}"><div class="row between wrap"><div class="grow"><b>${R.esc(h.name)}</b><div class="meta"><span>🔥 ${R.streak(h)} dia(s) seguidos</span><span>🏆 recorde ${R.bestStreak(h)}</span><span>Total ${h.log.length}</span></div></div>
        <div class="row">${days.map(k => `<div style="text-align:center"><div class="muted" style="font-size:10px">${R.WD[R.parse(k).getDay()]}</div><button class="chk ${h.log.includes(k) ? 'done' : ''}" data-act="habit-day" data-day="${k}" title="${k}"></button></div>`).join('')}<button class="ghost sm" data-act="habit-del" title="Excluir">✕</button></div></div>
        <div class="row" style="gap:2px;margin-top:8px;flex-wrap:wrap">${[...Array(84)].map((_, i) => { const k = R.addDays(T, i - 83); return `<span title="${k}" style="width:9px;height:9px;border-radius:2px;background:${h.log.includes(k) ? 'var(--accent)' : 'var(--line)'}"></span>`; }).join('')}</div></div>`).join('') : '<div class="empty">Crie seu primeiro hábito. Pequenos e diários funcionam melhor.</div>');
  } else {
    const p = R.pomo, tasks = R.S.tasks.filter(t => t.status === 'next' || t.status === 'inbox').slice(0, 40), week = [...Array(7)].map((_, i) => R.addDays(T, i - 6)), mins = week.map(d => R.S.focus[d] || 0), tot = mins.reduce((a, b) => a + b, 0);
    body = `<div class="grid g2"><div class="card" style="text-align:center"><div class="muted">${p.mode === 'focus' ? '🎯 Foco' : p.mode === 'short' ? '☕ Pausa curta' : '🛋 Pausa longa'}</div><div id="pomoTime" style="font-size:64px;font-weight:800;font-variant-numeric:tabular-nums">${R.pomoText()}</div>
      <select id="pomoTask" style="max-width:340px;margin:6px auto"><option value="">— sem tarefa —</option>${tasks.map(t => `<option value="${t.id}" ${p.task === t.id ? 'selected' : ''}>${R.esc(t.title)}</option>`).join('')}</select>
      <div class="actions" style="justify-content:center"><button class="pri" data-act="pomo">${p.run ? 'Pausar' : 'Iniciar'}</button><button data-act="pomo-reset">↺ Reiniciar</button></div><div class="muted small">Ciclos concluídos hoje: ${Math.floor((R.S.focus[T] || 0) / 25)} · ${R.S.focus[T] || 0} min</div></div>
      <div class="card"><h3 style="margin-bottom:6px">Foco nos últimos 7 dias</h3><canvas class="chart" id="cFocus" style="height:170px"></canvas><div class="muted small">Total: <b>${tot} min</b> (${(tot / 60).toFixed(1)} h)</div></div></div>`;
  }
  return `<div class="page"><div class="pagehead"><h1>🔥 Hábitos e foco</h1><span class="sp"></span><div class="seg"><button data-act="htab" data-k="habitos" class="${tab === 'habitos' ? 'on' : ''}">Hábitos</button><button data-act="htab" data-k="foco" class="${tab === 'foco' ? 'on' : ''}">Foco</button></div></div>${body}</div>`;
};

Object.assign(R.acts, {
  htab: el => { R.ui.hTab = el.dataset.k; R.render(); },
  'habit-day': el => { const h = R.S.habits.find(x => x.id === el.closest('[data-id]').dataset.id), k = el.dataset.day; h.log = h.log.includes(k) ? h.log.filter(x => x !== k) : [...h.log, k]; R.save(); R.render(); },
  'habit-del': async el => { if (await R.confirm('Excluir o hábito e seu histórico?', 'Excluir')) { R.S.habits = R.S.habits.filter(h => h.id !== el.closest('[data-id]').dataset.id); R.save(); R.render(); } },
  pomo: () => R.pomoToggle(), 'pomo-reset': () => { clearInterval(R.pomo.timer); Object.assign(R.pomo, { run: false, mode: 'focus', left: R.pomo.len.focus * 60 }); R.render(); },
});
R.hooks.push(() => {
  if (R.ui.view !== 'habits') return;
  const f = R.$('#habForm'); if (f) f.onsubmit = e => { e.preventDefault(); const n = new FormData(f).get('name').trim(); if (n) { R.S.habits.push({ id: R.uid(), name: n, log: [] }); R.save(); R.render(); } };
  const ps = R.$('#pomoTask'); if (ps) ps.onchange = () => R.pomo.task = ps.value;
  if (R.$('#cFocus')) { const T = R.today(), week = [...Array(7)].map((_, i) => R.addDays(T, i - 6)); R.chartBars(R.$('#cFocus'), week.map(d => R.WD[R.parse(d).getDay()]), [week.map(d => R.S.focus[d] || 0)], ['#0e9f8c']); }
});
