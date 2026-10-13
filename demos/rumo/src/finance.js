'use strict';
// Rumo — Finanças: contas, cartões (fatura), lançamentos, recorrências, orçamento, metas, relatórios, previsão e importação.

R.finSummary = m => {
  const tx = R.S.fin.txs.filter(t => t.date.startsWith(m) && !t.transfer);
  const inc = tx.filter(t => t.kind === 'in').reduce((s, t) => s + t.amount, 0), out = tx.filter(t => t.kind === 'out').reduce((s, t) => s + t.amount, 0);
  return { inc, out, bal: inc - out, n: tx.length };
};
// Saldo real = inicial + lançamentos marcados como pagos (independe da data). Com includeFuture, soma também os a pagar.
R.accBalance = (a, includeFuture = false) => a.initial + R.S.fin.txs.filter(t => t.acc === a.id && (includeFuture || t.paid !== false)).reduce((s, t) => s + (t.kind === 'in' ? t.amount : -t.amount), 0);
R.netWorth = () => R.S.fin.accounts.reduce((s, a) => s + R.accBalance(a), 0);

// Fatura de cartão: compras entre o fechamento anterior e o atual.
R.cardInvoice = (acc, ym) => {
  const [y, m] = ym.split('-').map(Number), cd = acc.closing || 28, end = new Date(y, m - 1, cd), start = new Date(y, m - 2, cd + 1), s = R.iso(start), e = R.iso(end);
  const tx = R.S.fin.txs.filter(t => t.acc === acc.id && t.kind === 'out' && t.date >= s && t.date <= e);
  const due = new Date(y, m - 1 + (acc.dueDay && acc.dueDay < cd ? 1 : 0), acc.dueDay || cd + 7);
  return { start: s, end: e, due: R.iso(due), total: tx.reduce((a, t) => a + t.amount, 0), tx };
};

// Projeção de saldo: saldo atual + recorrências + lançamentos futuros agendados.
R.forecast = days => {
  const T = R.today(), end = R.addDays(T, days), pts = [], flows = {};
  // só lançamentos ainda NÃO pagos entram na projeção (os pagos já estão no saldo); atrasados caem em "hoje"
  R.S.fin.txs.filter(t => t.paid === false && t.date <= end && !t.transfer && (R.acc(t.acc) || {}).type !== 'card').forEach(t => { const d = t.date < T ? T : t.date; flows[d] = (flows[d] || 0) + (t.kind === 'in' ? t.amount : -t.amount); });
  (R.S.fin.recurring || []).forEach(r => { let d = r.next; while (d <= end) { if (d > T) flows[d] = (flows[d] || 0) + (r.kind === 'in' ? r.amount : -r.amount); d = R.addMonths(d, 1); } });
  let bal = R.S.fin.accounts.filter(a => a.type !== 'card').reduce((s, a) => s + R.accBalance(a), 0);
  for (let i = 0; i <= days; i++) { const d = R.addDays(T, i); bal += flows[d] || 0; pts.push({ d, v: bal }); }
  return pts;
};

// Gera lançamentos das recorrências vencidas (roda ao abrir o app).
R.runRecurring = () => {
  const T = R.today(); let n = 0;
  (R.S.fin.recurring || []).forEach(r => {
    let guard = 0;
    while (r.next <= T && guard++ < 36) { R.S.fin.txs.push({ id: R.uid(), date: r.next, amount: r.amount, kind: r.kind, desc: r.desc, acc: r.acc, cat: r.cat, paid: true, tags: ['recorrente'], notes: '', inst: '', recId: r.id }); r.next = R.addMonths(r.next, 1); n++; }
  });
  if (n) { R.save(); R.toast(`${n} lançamento(s) recorrente(s) gerado(s).`); }
};

R.autoCategory = desc => { const d = desc.toLowerCase(); const r = (R.S.fin.rules || []).find(x => d.includes(x.match.toLowerCase())); return r ? r.cat : ''; };

R.catName = id => (R.cat(id) || { name: 'Sem categoria' }).name;

R.views.money = () => {
  const m = R.ui.month, [y, mo] = m.split('-').map(Number), sum = R.finSummary(m), tab = R.ui.mTab;
  const tabs = [['visao', 'Visão geral'], ['lanc', 'Lançamentos'], ['cartoes', 'Cartões'], ['orc', 'Orçamento'], ['metas', 'Metas'], ['rel', 'Relatórios'], ['rec', 'Recorrentes'], ['contas', 'Contas e categorias'], ['of', 'Open Finance']];
  let body = '';
  const catSpent = id => R.S.fin.txs.filter(t => t.date.startsWith(m) && t.kind === 'out' && t.cat === id && !t.transfer).reduce((s, t) => s + t.amount, 0);
  if (tab === 'visao') {
    const accs = R.S.fin.accounts, nw = R.netWorth(), fc = R.forecast(60), low = fc.reduce((a, p) => p.v < a.v ? p : a, fc[0]);
    const top = R.S.fin.cats.filter(c => c.kind === 'out').map(c => ({ c, v: catSpent(c.id) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 6);
    const upcoming = R.S.fin.txs.filter(t => t.paid === false && t.date >= R.today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
    body = `<div class="grid g2"><div class="card"><h3 style="margin-bottom:8px">Contas</h3>${accs.map(a => `<div class="list-i"><span>${R.esc(a.name)} <span class="muted small">${{ cash: 'dinheiro', checking: 'conta', savings: 'poupança', card: 'cartão', invest: 'investimento' }[a.type] || ''}</span></span><b class="${R.accBalance(a) >= 0 ? '' : 'neg'}">${R.brl(R.accBalance(a))}</b></div>`).join('')}<div class="list-i"><b>Patrimônio líquido</b><b class="${nw >= 0 ? 'pos' : 'neg'}">${R.brl(nw)}</b></div></div>
      <div class="card"><h3 style="margin-bottom:8px">Previsão de 60 dias</h3><canvas class="chart" id="cFc" style="height:150px"></canvas><div class="small ${low.v < 0 ? 'neg' : 'muted'}">Menor saldo previsto: <b>${R.brl(low.v)}</b> em ${R.fmtShort(low.d)}</div></div></div>
      <div class="grid g2" style="margin-top:14px"><div class="card"><h3 style="margin-bottom:8px">Maiores gastos do mês</h3>${top.length ? top.map(x => `<div class="list-i"><span>${R.esc(x.c.name)}</span><b>${R.brl(x.v)}</b></div>`).join('') : '<div class="muted">Sem despesas.</div>'}</div>
      <div class="card"><h3 style="margin-bottom:8px">Próximos a pagar</h3>${upcoming.length ? upcoming.map(t => `<div class="list-i" data-id="${t.id}"><span>${R.esc(t.desc)} <span class="muted small">${R.fmtShort(t.date)}</span></span><span><b class="neg">${R.brl(t.amount)}</b> <button class="sm" data-act="tx-pay">Pagar</button></span></div>`).join('') : '<div class="muted">Nada pendente.</div>'}</div></div>`;
  } else if (tab === 'lanc') {
    const f = R.ui.mFilter || (R.ui.mFilter = { acc: '', cat: '', q: '' });
    const tx = R.S.fin.txs.filter(t => t.date.startsWith(m) && (!f.acc || t.acc === f.acc) && (!f.cat || t.cat === f.cat) && (!f.q || t.desc.toLowerCase().includes(f.q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date));
    body = `<div class="row wrap" style="margin-bottom:10px"><input id="fQ" placeholder="Buscar…" value="${R.esc(f.q)}" style="max-width:200px"><select id="fAcc" style="max-width:190px"><option value="">Todas as contas</option>${R.S.fin.accounts.map(a => `<option value="${a.id}" ${f.acc === a.id ? 'selected' : ''}>${R.esc(a.name)}</option>`).join('')}</select><select id="fCat" style="max-width:190px"><option value="">Todas as categorias</option>${R.S.fin.cats.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${R.esc(c.name)}</option>`).join('')}</select><span class="sp grow"></span><button class="pri" data-act="tx-new">＋ Lançamento</button><button data-act="tx-transfer">⇄ Transferência</button><button data-act="fin-import">Importar CSV/OFX</button><input type="file" id="finFile" accept=".csv,.ofx,.txt" hidden></div>
      <div class="card">${tx.length ? tx.map(t => `<div class="list-i" data-id="${t.id}"><div class="grow"><b data-act="tx-edit" style="cursor:pointer">${R.esc(t.desc)}</b><div class="meta"><span>${R.fmtShort(t.date)}</span><span>${R.esc(R.catName(t.cat))}</span><span>${R.esc((R.acc(t.acc) || {}).name || '')}</span>${t.paid === false ? '<span class="badge warn">a pagar</span>' : ''}${t.inst ? `<span>${R.esc(t.inst)}</span>` : ''}${(t.tags || []).map(g => `<span class="tag">#${R.esc(g)}</span>`).join('')}</div></div>
        <span class="${t.transfer ? 'muted' : t.kind === 'in' ? 'pos' : 'neg'}"><b>${t.kind === 'in' ? '' : '-'}${R.brl(t.amount).replace('-', '')}</b></span>${t.paid === false ? '<button class="sm" data-act="tx-pay">Pagar</button>' : ''}<button class="ghost sm" data-act="tx-del" title="Excluir">✕</button></div>`).join('') : '<div class="empty">Sem lançamentos neste mês.</div>'}</div>`;
  } else if (tab === 'cartoes') {
    const cards = R.S.fin.accounts.filter(a => a.type === 'card');
    body = cards.length ? cards.map(a => { const inv = R.cardInvoice(a, m), used = Math.abs(Math.min(0, R.accBalance(a, true))), pct = a.limit ? R.clamp(used / a.limit * 100, 0, 100) : 0; return `<div class="card" style="margin-bottom:12px"><div class="row between"><h3>💳 ${R.esc(a.name)}</h3><span class="muted small">fecha dia ${a.closing || 28} · vence dia ${a.dueDay || '—'}</span></div>
      <div class="grid g3" style="margin:10px 0"><div class="stat"><small>Fatura (${R.fmtShort(inv.start)} a ${R.fmtShort(inv.end)})</small><b class="neg">${R.brl(inv.total)}</b></div><div class="stat"><small>Vencimento</small><b>${R.fmtShort(inv.due)}</b></div><div class="stat"><small>Limite usado</small><b>${a.limit ? R.brl(used) + ' / ' + R.brl(a.limit) : R.brl(used)}</b></div></div>${a.limit ? `<div class="bar"><i class="${pct > 85 ? 'over' : pct > 65 ? 'warn' : ''}" style="width:${pct}%"></i></div>` : ''}
      <details style="margin-top:8px"><summary class="muted small">${inv.tx.length} compras nesta fatura</summary>${inv.tx.map(t => `<div class="list-i small"><span>${R.fmtShort(t.date)} · ${R.esc(t.desc)}</span><span>${R.brl(t.amount)}</span></div>`).join('')}</details>
      <div class="actions" style="margin-top:6px"><button class="sm" data-act="inv-pay" data-acc="${a.id}" data-total="${inv.total}">Registrar pagamento da fatura</button></div></div>`; }).join('') : '<div class="empty">Nenhum cartão. Em "Contas e categorias" adicione uma conta do tipo Cartão de crédito.</div>';
  } else if (tab === 'orc') {
    const bud = R.S.fin.budgets.default || (R.S.fin.budgets.default = {}), outs = R.S.fin.cats.filter(c => c.kind === 'out'), totB = outs.reduce((s, c) => s + (bud[c.id] || 0), 0);
    body = `<div class="card"><div class="row between"><b>Orçamento mensal total: ${R.brl(totB)}</b><span class="muted small">gasto ${R.brl(sum.out)}</span></div>${totB ? `<div class="bar" style="margin:8px 0"><i class="${sum.out > totB ? 'over' : sum.out > totB * .8 ? 'warn' : ''}" style="width:${R.clamp(sum.out / totB * 100, 0, 100)}%"></i></div>` : ''}</div><div style="height:12px"></div>` +
      outs.map(c => { const lim = bud[c.id] || 0, sp = catSpent(c.id), pct = lim ? R.clamp(sp / lim * 100, 0, 100) : 0; return `<div class="card" style="margin-bottom:8px;padding:12px"><div class="row between"><b>${R.esc(c.name)}</b><span class="row"><span class="${lim && sp > lim ? 'neg' : 'muted'}">${R.brl(sp)} de</span><input type="number" min="0" step="10" value="${lim || ''}" placeholder="limite" data-act="budget" data-id="${c.id}" style="width:110px"></span></div>${lim ? `<div class="bar" style="margin-top:6px"><i class="${sp > lim ? 'over' : sp > lim * .8 ? 'warn' : ''}" style="width:${pct}%"></i></div>` : ''}</div>`; }).join('');
  } else if (tab === 'metas') {
    const goals = R.S.fin.goals;
    body = `<div class="row" style="margin-bottom:10px"><button class="pri" data-act="goal-new">＋ Nova meta</button></div>` + (goals.length ? goals.map(g => { const pct = R.clamp(g.saved / g.target * 100, 0, 100), left = g.target - g.saved, months = g.deadline ? Math.max(1, Math.ceil(R.daysBetween(R.today(), g.deadline) / 30)) : 0;
      return `<div class="card" style="margin-bottom:10px" data-id="${g.id}"><div class="row between"><b>🎯 ${R.esc(g.name)}</b><span><button class="sm" data-act="goal-add">＋ Guardar</button> <button class="ghost sm" data-act="goal-del">✕</button></span></div><div class="muted small">${R.brl(g.saved)} de ${R.brl(g.target)} (${pct.toFixed(0)}%)${g.deadline ? ` · até ${R.fmtShort(g.deadline)} → guarde ${R.brl(Math.max(0, left) / months)}/mês` : ''}</div><div class="bar" style="margin-top:6px"><i style="width:${pct}%"></i></div></div>`; }).join('') : '<div class="empty">Crie metas (reserva de emergência, viagem…) e acompanhe quanto guardar por mês.</div>');
  } else if (tab === 'rel') {
    body = `<div class="grid g2"><div class="card"><h3 style="margin-bottom:6px">Receitas × despesas (6 meses)</h3><canvas class="chart" id="cBars"></canvas><div class="muted small"><span style="color:var(--ok)">■</span> receitas <span style="color:var(--danger)">■</span> despesas</div></div><div class="card"><h3 style="margin-bottom:6px">Despesas por categoria</h3><div class="row"><canvas class="chart" id="cDon" style="width:55%"></canvas><div id="donLegend" class="small grow"></div></div></div></div>
      <div class="card" style="margin-top:14px"><h3 style="margin-bottom:6px">Evolução do patrimônio (12 meses)</h3><canvas class="chart" id="cNw"></canvas></div>`;
  } else if (tab === 'rec') {
    const rs = R.S.fin.recurring || [];
    body = `<div class="row" style="margin-bottom:10px"><button class="pri" data-act="rec-new">＋ Recorrência</button><span class="muted small">Gera o lançamento automaticamente todo mês.</span></div><div class="card">${rs.length ? rs.map(r => `<div class="list-i" data-id="${r.id}"><span><b>${R.esc(r.desc)}</b> <span class="muted small">próx. ${R.fmtShort(r.next)} · ${R.esc(R.catName(r.cat))}</span></span><span class="${r.kind === 'in' ? 'pos' : 'neg'}"><b>${R.brl(r.amount)}</b> <button class="ghost sm" data-act="rec-del">✕</button></span></div>`).join('') : '<div class="empty">Sem recorrências.</div>'}</div>`;
  } else if (tab === 'contas') {
    body = `<div class="grid g2"><div class="card"><div class="row between"><h3>Contas</h3><button class="sm" data-act="acc-new">＋ Conta</button></div>${R.S.fin.accounts.map(a => `<div class="list-i" data-id="${a.id}"><span>${R.esc(a.name)} <span class="muted small">${{ cash: 'dinheiro', checking: 'conta corrente', savings: 'poupança', card: 'cartão', invest: 'investimento' }[a.type] || a.type}</span></span><span>${R.brl(R.accBalance(a))} <button class="ghost sm" data-act="acc-edit">✎</button> <button class="ghost sm" data-act="acc-del">✕</button></span></div>`).join('')}</div>
      <div class="card"><div class="row between"><h3>Categorias</h3><button class="sm" data-act="cat-new">＋ Categoria</button></div>${R.S.fin.cats.map(c => `<div class="list-i" data-id="${c.id}"><span>${R.esc(c.name)} <span class="muted small">${c.kind === 'in' ? 'receita' : 'despesa'}</span></span><button class="ghost sm" data-act="cat-del">✕</button></div>`).join('')}</div></div>
      <div class="card" style="margin-top:14px"><div class="row between"><h3>Regras de categorização automática</h3><button class="sm" data-act="rule-new">＋ Regra</button></div><div class="muted small" style="margin-bottom:6px">Se a descrição contém o texto, aplica a categoria (usado na importação e no Open Finance).</div>${(R.S.fin.rules || []).map((r, i) => `<div class="list-i"><span>"${R.esc(r.match)}" → ${R.esc(R.catName(r.cat))}</span><button class="ghost sm" data-act="rule-del" data-i="${i}">✕</button></div>`).join('') || '<div class="muted small">Nenhuma regra.</div>'}</div>`;
  } else if (tab === 'of') body = R.ofView();
  return `<div class="page"><div class="pagehead"><h1>💰 Finanças</h1><span class="sp"></span><div class="row"><button data-act="mprev">‹</button><b style="min-width:130px;text-align:center">${R.MONTHS[mo - 1]} ${y}</b><button data-act="mnext">›</button></div></div>
    <div class="grid g4" style="margin-bottom:14px"><div class="card stat"><small>Receitas</small><b class="pos">${R.brl(sum.inc)}</b></div><div class="card stat"><small>Despesas</small><b class="neg">${R.brl(sum.out)}</b></div><div class="card stat"><small>Resultado do mês</small><b class="${sum.bal >= 0 ? 'pos' : 'neg'}">${R.brl(sum.bal)}</b></div><div class="card stat"><small>Patrimônio</small><b>${R.brl(R.netWorth())}</b></div></div>
    <div class="row wrap" style="margin-bottom:12px">${tabs.map(([k, v]) => `<button class="chip ${tab === k ? 'on' : ''}" data-act="mtab" data-k="${k}" style="padding:5px 13px;cursor:pointer">${v}</button>`).join('')}</div>${body}</div>`;
};

/* ---------- diálogos ---------- */
R.txDialog = (id, preset = {}) => {
  const t = id ? R.S.fin.txs.find(x => x.id === id) : Object.assign({ kind: 'out', amount: '', desc: '', date: R.ui.month === R.today().slice(0, 7) ? R.today() : R.ui.month + '-01', acc: R.S.fin.accounts[0].id, cat: '', paid: true, tags: [], notes: '' }, preset);
  R.modal(`<form id="xform"><h3>${id ? 'Editar lançamento' : 'Novo lançamento'}</h3>
    <div class="two"><div><label>Tipo</label><select name="kind"><option value="out" ${t.kind === 'out' ? 'selected' : ''}>Despesa</option><option value="in" ${t.kind === 'in' ? 'selected' : ''}>Receita</option></select></div><div><label>Valor</label><input name="amount" inputmode="decimal" value="${t.amount}" required></div></div>
    <label>Descrição</label><input name="desc" value="${R.esc(t.desc)}" required><div class="two"><div><label>Data</label><input type="date" name="date" value="${t.date}" required></div><div><label>Situação</label><select name="paid"><option value="1" ${t.paid !== false ? 'selected' : ''}>Pago / recebido</option><option value="0" ${t.paid === false ? 'selected' : ''}>A pagar / a receber</option></select></div></div>
    <div class="two"><div><label>Conta</label><select name="acc">${R.S.fin.accounts.map(a => `<option value="${a.id}" ${a.id === t.acc ? 'selected' : ''}>${R.esc(a.name)}</option>`).join('')}</select></div><div><label>Categoria</label><select name="cat" id="xcat">${R.S.fin.cats.map(c => `<option value="${c.id}" ${c.id === t.cat ? 'selected' : ''}>${R.esc(c.name)}</option>`).join('')}</select></div></div>
    ${id ? '' : '<div class="two"><div><label>Parcelas / repetições mensais</label><input type="number" name="n" min="1" max="60" value="1"></div><div><label>Tags</label><input name="tags" placeholder="separe por vírgula"></div></div>'}
    <label>Notas</label><input name="notes" value="${R.esc(t.notes || '')}"><div class="actions"><button type="button" id="xc">Cancelar</button><button class="pri">Salvar</button></div></form>`);
  R.$('#xc').onclick = R.closeModal;
  if (!id) R.$('#xform [name=desc]').oninput = e => { const c = R.autoCategory(e.target.value); if (c) R.$('#xcat').value = c; };
  R.$('#xform').onsubmit = e => {
    e.preventDefault(); const f = new FormData(R.$('#xform')); R.checkpoint(); const amt = Math.abs(R.num(f.get('amount')));
    const base = { kind: f.get('kind'), amount: +amt.toFixed(2), desc: f.get('desc').trim(), acc: f.get('acc'), cat: f.get('cat'), paid: f.get('paid') === '1', notes: f.get('notes') };
    if (id) Object.assign(t, base, { date: f.get('date') });
    else { const n = Math.max(1, +f.get('n') || 1), d0 = f.get('date'), tags = (f.get('tags') || '').split(',').map(s => s.trim()).filter(Boolean); for (let i = 0; i < n; i++) R.S.fin.txs.push({ id: R.uid(), ...base, date: R.addMonths(d0, i), paid: i === 0 ? base.paid : false, tags, inst: n > 1 ? `${i + 1}/${n}` : '' }); }
    R.save(); R.closeModal(); R.render();
  };
};

R.simpleForm = (title, fields, onOk) => {
  R.modal(`<form id="sf"><h3>${title}</h3>${fields.map(f => `<label>${f.l}</label>${f.sel ? `<select name="${f.n}">${f.sel.map(([v, t]) => `<option value="${v}" ${v === f.v ? 'selected' : ''}>${R.esc(t)}</option>`).join('')}</select>` : `<input name="${f.n}" type="${f.t || 'text'}" value="${R.esc(f.v ?? '')}" ${f.req ? 'required' : ''} ${f.t === 'number' ? 'step="0.01"' : ''}>`}`).join('')}<div class="actions"><button type="button" id="sfc">Cancelar</button><button class="pri">Salvar</button></div></form>`);
  R.$('#sfc').onclick = R.closeModal; R.$('#sf').onsubmit = e => { e.preventDefault(); onOk(Object.fromEntries(new FormData(R.$('#sf')))); R.closeModal(); };
};

Object.assign(R.acts, {
  mprev: () => { R.ui.month = R.shiftMonth(R.ui.month, -1); R.render(); }, mnext: () => { R.ui.month = R.shiftMonth(R.ui.month, 1); R.render(); },
  mtab: el => { R.ui.mTab = el.dataset.k; R.render(); },
  'tx-new': () => R.txDialog(), 'tx-edit': el => R.txDialog(el.closest('[data-id]').dataset.id),
  'tx-del': el => { const id = el.closest('[data-id]').dataset.id; R.checkpoint(); R.S.fin.txs = R.S.fin.txs.filter(t => t.id !== id); R.save(); R.render(); R.toast('Lançamento excluído.', { label: 'Desfazer', fn: R.undo }); },
  'tx-pay': el => { const t = R.S.fin.txs.find(x => x.id === el.closest('[data-id]').dataset.id); if (t) { R.checkpoint(); t.paid = true; R.save(); R.render(); } },
  'tx-transfer': () => R.simpleForm('Transferência entre contas', [{ l: 'De', n: 'from', sel: R.S.fin.accounts.map(a => [a.id, a.name]) }, { l: 'Para', n: 'to', sel: R.S.fin.accounts.map(a => [a.id, a.name]) }, { l: 'Valor', n: 'amount', t: 'number', req: 1 }, { l: 'Data', n: 'date', t: 'date', v: R.today(), req: 1 }], f => { if (f.from === f.to) return; const a = +f.amount; R.checkpoint(); const id = R.uid(); R.S.fin.txs.push({ id: R.uid(), date: f.date, amount: a, kind: 'out', desc: 'Transferência enviada', acc: f.from, cat: '', paid: true, tags: [], notes: '', transfer: id }, { id: R.uid(), date: f.date, amount: a, kind: 'in', desc: 'Transferência recebida', acc: f.to, cat: '', paid: true, tags: [], notes: '', transfer: id }); R.save(); R.render(); }),
  budget: el => { if (el.type !== 'number') return; },
  'goal-new': () => R.simpleForm('Nova meta', [{ l: 'Nome', n: 'name', req: 1 }, { l: 'Valor alvo (R$)', n: 'target', t: 'number', req: 1 }, { l: 'Já guardado (R$)', n: 'saved', t: 'number', v: 0 }, { l: 'Prazo (opcional)', n: 'deadline', t: 'date' }], f => { R.S.fin.goals.push({ id: R.uid(), name: f.name, target: +f.target, saved: +f.saved || 0, deadline: f.deadline }); R.save(); R.render(); }),
  'goal-add': el => { const g = R.S.fin.goals.find(x => x.id === el.closest('[data-id]').dataset.id), v = prompt('Quanto guardar agora (R$)?'); if (v) { g.saved += R.num(v); R.save(); R.render(); } },
  'goal-del': async el => { if (await R.confirm('Excluir a meta?', 'Excluir')) { R.S.fin.goals = R.S.fin.goals.filter(x => x.id !== el.closest('[data-id]').dataset.id); R.save(); R.render(); } },
  'rec-new': () => R.simpleForm('Nova recorrência mensal', [{ l: 'Descrição', n: 'desc', req: 1 }, { l: 'Valor', n: 'amount', t: 'number', req: 1 }, { l: 'Tipo', n: 'kind', sel: [['out', 'Despesa'], ['in', 'Receita']] }, { l: 'Próxima data', n: 'next', t: 'date', v: R.today(), req: 1 }, { l: 'Conta', n: 'acc', sel: R.S.fin.accounts.map(a => [a.id, a.name]) }, { l: 'Categoria', n: 'cat', sel: R.S.fin.cats.map(c => [c.id, c.name]) }], f => { R.S.fin.recurring.push({ id: R.uid(), desc: f.desc, amount: +f.amount, kind: f.kind, next: f.next, acc: f.acc, cat: f.cat }); R.save(); R.runRecurring(); R.render(); }),
  'rec-del': el => { R.S.fin.recurring = R.S.fin.recurring.filter(x => x.id !== el.closest('[data-id]').dataset.id); R.save(); R.render(); },
  'acc-new': () => R.simpleForm('Nova conta', [{ l: 'Nome', n: 'name', req: 1 }, { l: 'Tipo', n: 'type', sel: [['checking', 'Conta corrente'], ['cash', 'Dinheiro'], ['savings', 'Poupança'], ['card', 'Cartão de crédito'], ['invest', 'Investimento']] }, { l: 'Saldo inicial', n: 'initial', t: 'number', v: 0 }, { l: 'Cartão: dia de fechamento', n: 'closing', t: 'number' }, { l: 'Cartão: dia de vencimento', n: 'dueDay', t: 'number' }, { l: 'Cartão: limite', n: 'limit', t: 'number' }], f => { R.S.fin.accounts.push({ id: R.uid(), name: f.name, type: f.type, initial: +f.initial || 0, closing: +f.closing || 0, dueDay: +f.dueDay || 0, limit: +f.limit || 0, color: R.PALETTE[R.S.fin.accounts.length % 10] }); R.save(); R.render(); }),
  'acc-edit': el => { const a = R.acc(el.closest('[data-id]').dataset.id); R.simpleForm('Editar conta', [{ l: 'Nome', n: 'name', v: a.name, req: 1 }, { l: 'Saldo inicial', n: 'initial', t: 'number', v: a.initial }, { l: 'Cartão: fechamento', n: 'closing', t: 'number', v: a.closing || '' }, { l: 'Cartão: vencimento', n: 'dueDay', t: 'number', v: a.dueDay || '' }, { l: 'Cartão: limite', n: 'limit', t: 'number', v: a.limit || '' }], f => { Object.assign(a, { name: f.name, initial: +f.initial || 0, closing: +f.closing || 0, dueDay: +f.dueDay || 0, limit: +f.limit || 0 }); R.save(); R.render(); }); },
  'acc-del': async el => { if (R.S.fin.accounts.length < 2) { R.toast('Mantenha ao menos uma conta.'); return; } if (await R.confirm('Excluir a conta e todos os seus lançamentos?', 'Excluir')) { const id = el.closest('[data-id]').dataset.id; R.checkpoint(); R.S.fin.txs = R.S.fin.txs.filter(t => t.acc !== id); R.S.fin.accounts = R.S.fin.accounts.filter(a => a.id !== id); R.save(); R.render(); } },
  'cat-new': () => R.simpleForm('Nova categoria', [{ l: 'Nome', n: 'name', req: 1 }, { l: 'Tipo', n: 'kind', sel: [['out', 'Despesa'], ['in', 'Receita']] }], f => { R.S.fin.cats.push({ id: R.uid(), name: f.name, kind: f.kind }); R.save(); R.render(); }),
  'cat-del': el => { R.S.fin.cats = R.S.fin.cats.filter(c => c.id !== el.closest('[data-id]').dataset.id); R.save(); R.render(); },
  'rule-new': () => R.simpleForm('Nova regra', [{ l: 'Se a descrição contém', n: 'match', req: 1 }, { l: 'Categoria', n: 'cat', sel: R.S.fin.cats.map(c => [c.id, c.name]) }], f => { R.S.fin.rules.push({ match: f.match, cat: f.cat }); R.save(); R.render(); }),
  'rule-del': el => { R.S.fin.rules.splice(+el.dataset.i, 1); R.save(); R.render(); },
  'inv-pay': el => { const a = R.acc(el.dataset.acc), checking = R.S.fin.accounts.filter(x => x.type !== 'card'); R.simpleForm('Pagar fatura', [{ l: 'Valor', n: 'amount', t: 'number', v: (+el.dataset.total).toFixed(2), req: 1 }, { l: 'Pagar com a conta', n: 'from', sel: checking.map(x => [x.id, x.name]) }], f => { R.checkpoint(); const id = R.uid(), v = +f.amount, d = R.today(); R.S.fin.txs.push({ id: R.uid(), date: d, amount: v, kind: 'out', desc: `Pagamento fatura ${a.name}`, acc: f.from, cat: '', paid: true, tags: [], notes: '', transfer: id }, { id: R.uid(), date: d, amount: v, kind: 'in', desc: `Pagamento fatura ${a.name}`, acc: a.id, cat: '', paid: true, tags: [], notes: '', transfer: id }); R.save(); R.render(); }); },
  'fin-import': () => R.$('#finFile').click(),
});

/* ---------- importação CSV/OFX ---------- */
R.parseOFX = text => {
  const out = [], re = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi; let m;
  while ((m = re.exec(text))) { const b = m[1], g = k => { const x = b.match(new RegExp('<' + k + '>([^<\\r\\n]+)', 'i')); return x ? x[1].trim() : ''; };
    const dt = g('DTPOSTED'), amt = parseFloat(g('TRNAMT').replace(',', '.')); if (!dt || isNaN(amt)) continue;
    out.push({ date: `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`, amount: Math.abs(amt), kind: amt >= 0 ? 'in' : 'out', desc: g('MEMO') || g('NAME') || 'Lançamento', fitid: g('FITID') }); }
  return out;
};
R.parseCSV = text => {
  const lines = text.split(/\r?\n/).filter(l => l.trim()); if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const split = l => { const r = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { r.push(c); c = ''; } else c += ch; } r.push(c); return r.map(s => s.trim()); };
  const head = split(lines[0]).map(h => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const ix = names => head.findIndex(h => names.some(n => h.includes(n)));
  const iD = ix(['data', 'date']), iV = ix(['valor', 'amount', 'value']), iDesc = ix(['descri', 'historico', 'memo', 'estabelecimento', 'name']), iT = ix(['tipo', 'type']);
  if (iD < 0 || iV < 0) return [];
  return lines.slice(1).map(l => { const c = split(l); let d = c[iD], v = R.num(c[iV]); const m1 = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/), m2 = d.match(/^(\d{4})-(\d{2})-(\d{2})/); d = m1 ? `${m1[3]}-${m1[2]}-${m1[1]}` : m2 ? m2[0] : null; if (!d) return null;
    const tp = iT >= 0 ? c[iT].toLowerCase() : ''; const kind = /receita|credito|crédito|entrada/.test(tp) ? 'in' : /despesa|debito|débito|saida|saída/.test(tp) ? 'out' : (v >= 0 ? 'in' : 'out'); return { date: d, amount: Math.abs(v), kind, desc: (iDesc >= 0 ? c[iDesc] : 'Lançamento') || 'Lançamento' }; }).filter(Boolean);
};
R.importTx = (rows, accId) => {
  R.checkpoint(); let n = 0, dup = 0; const seen = new Set(R.S.fin.txs.map(t => `${t.date}|${t.amount}|${t.desc}|${t.acc}`));
  rows.forEach(r => { const k = `${r.date}|${r.amount}|${r.desc}|${accId}`; if (seen.has(k) || (r.fitid && R.S.fin.txs.some(t => t.fitid === r.fitid))) { dup++; return; } seen.add(k);
    R.S.fin.txs.push({ id: R.uid(), date: r.date, amount: r.amount, kind: r.kind, desc: r.desc, acc: accId, cat: R.autoCategory(r.desc) || '', paid: true, tags: ['importado'], notes: '', inst: '', fitid: r.fitid }); n++; });
  R.save(); R.render(); R.toast(`${n} lançamento(s) importado(s)${dup ? `, ${dup} duplicado(s) ignorado(s)` : ''}.`);
};

R.hooks.push(() => {
  if (R.ui.view !== 'money') return;
  const on = (id, fn) => { const e = R.$(id); if (e) e.onchange = fn; };
  const f = R.ui.mFilter;
  if (R.$('#fQ')) R.$('#fQ').oninput = R.debounce(e => { f.q = e.target.value; R.render(); const q = R.$('#fQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250);
  on('#fAcc', e => { f.acc = e.target.value; R.render(); }); on('#fCat', e => { f.cat = e.target.value; R.render(); });
  R.$$('input[data-act=budget]').forEach(i => i.onchange = () => { R.S.fin.budgets.default[i.dataset.id] = +i.value || 0; R.save(); R.render(); });
  const ff = R.$('#finFile');
  if (ff) ff.onchange = async () => { const file = ff.files[0]; if (!file) return; const txt = await R.readFile(file), rows = /<STMTTRN>/i.test(txt) ? R.parseOFX(txt) : R.parseCSV(txt); if (!rows.length) { R.toast('Não encontrei lançamentos no arquivo.'); return; }
    R.simpleForm(`Importar ${rows.length} lançamentos`, [{ l: 'Para a conta', n: 'acc', sel: R.S.fin.accounts.map(a => [a.id, a.name]) }], x => R.importTx(rows, x.acc)); };
  // gráficos
  const m = R.ui.month;
  if (R.$('#cFc')) { const fc = R.forecast(60); R.chartLine(R.$('#cFc'), fc.map(p => R.fmtShort(p.d)), fc.map(p => p.v), '#0e9f8c'); }
  if (R.$('#cBars')) { const ms = [...Array(6)].map((_, i) => R.shiftMonth(m, i - 5)), sums = ms.map(R.finSummary); R.chartBars(R.$('#cBars'), ms.map(x => R.MONTHS[+x.slice(5) - 1].slice(0, 3)), [sums.map(s => s.inc), sums.map(s => s.out)], ['#2e9e5b', '#d64545']); }
  if (R.$('#cDon')) { const items = R.S.fin.cats.filter(c => c.kind === 'out').map((c, i) => ({ n: c.name, v: R.S.fin.txs.filter(t => t.date.startsWith(m) && t.kind === 'out' && t.cat === c.id && !t.transfer).reduce((s, t) => s + t.amount, 0) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).map((x, i) => ({ ...x, c: R.PALETTE[i % 10] })); R.chartDonut(R.$('#cDon'), items); const tot = items.reduce((s, x) => s + x.v, 0) || 1; R.$('#donLegend').innerHTML = items.map(x => `<div><span style="color:${x.c}">●</span> ${R.esc(x.n)} <b>${(x.v / tot * 100).toFixed(0)}%</b></div>`).join('') || '<span class="muted">Sem despesas</span>'; }
  if (R.$('#cNw')) { const ms = [...Array(12)].map((_, i) => R.shiftMonth(m, i - 11)), vals = ms.map(x => { const end = R.iso(new Date(+x.slice(0, 4), +x.slice(5), 0)); return R.S.fin.accounts.reduce((s, a) => s + a.initial + R.S.fin.txs.filter(t => t.acc === a.id && t.date <= end && t.paid !== false).reduce((q, t) => q + (t.kind === 'in' ? t.amount : -t.amount), 0), 0); }); R.chartLine(R.$('#cNw'), ms.map(x => R.MONTHS[+x.slice(5) - 1].slice(0, 3)), vals, '#3b82c4'); }
});
