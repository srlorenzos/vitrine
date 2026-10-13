'use strict';
// Rumo — Open Finance (Pluggy). As credenciais NUNCA ficam no navegador: o backend (server.js ou /api na Vercel)
// guarda PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET e só repassa tokens de conexão e dados já autorizados pelo usuário.

R.of = { status: null, loading: false };

R.ofCheck = async () => {
  try { const r = await fetch('/api/of/status'); R.of.status = r.ok ? await r.json() : { configured: false }; }
  catch { R.of.status = { configured: false, offline: true }; }
  if (R.ui.view === 'money' && R.ui.mTab === 'of') R.render();
};

R.ofView = () => {
  if (!R.of.status) R.ofCheck();
  const st = R.of.status, items = R.S.fin.ofItems || [];
  const configured = st && st.configured;
  const demo = R.S.settings.demo;
  return `<div class="card"><div class="row between"><h3>🏦 Open Finance</h3>${configured ? '<span class="badge">backend configurado</span>' : '<span class="badge warn">não configurado</span>'}</div>
    <p class="muted">Conecte seus bancos pelo Open Finance Brasil: contas, saldos, faturas e transações entram sozinhos, já categorizados pelas suas regras. O Rumo usa um agregador regulado (Pluggy); o app nunca vê a senha do seu banco.</p>
    ${configured ? `<div class="actions" style="justify-content:flex-start"><button class="pri" data-act="of-connect">＋ Conectar banco</button>${items.length ? '<button data-act="of-sync">⟳ Sincronizar agora</button>' : ''}</div>` : `
    <div class="card" style="background:var(--panel2);box-shadow:none"><b>Como ativar</b><ol class="small" style="margin:6px 0 0 18px;padding:0">
      <li>Crie uma conta gratuita em <a href="https://dashboard.pluggy.ai" target="_blank" rel="noopener">dashboard.pluggy.ai</a> e copie o <i>Client ID</i> e o <i>Client Secret</i> do seu app.</li>
      <li>No servidor do Rumo, defina as variáveis <code>PLUGGY_CLIENT_ID</code> e <code>PLUGGY_CLIENT_SECRET</code> (no app de desktop: arquivo <code>.env</code> ao lado do executável; na Vercel: Environment Variables).</li>
      <li>Reinicie e volte aqui: o botão <b>Conectar banco</b> aparece.</li></ol></div>
    ${demo || st && st.offline ? '' : ''}<div class="actions" style="justify-content:flex-start"><button data-act="of-demo">▶ Simular um banco (demonstração)</button></div>`}
  </div>
  ${items.length ? `<div class="card" style="margin-top:14px"><h3 style="margin-bottom:6px">Conexões</h3>${items.map(i => `<div class="list-i" data-id="${i.itemId}"><span><b>${R.esc(i.name || 'Banco')}</b> <span class="muted small">sincronizado ${i.last ? new Date(i.last).toLocaleString('pt-BR') : '—'}${i.demo ? ' (demo)' : ''}</span></span><button class="ghost sm" data-act="of-del">Remover</button></div>`).join('')}</div>` : ''}
  <div class="card" style="margin-top:14px"><b>Sem Open Finance?</b><div class="muted small">Você também pode importar o extrato (OFX/CSV) em Lançamentos → "Importar CSV/OFX". Duplicados são ignorados.</div></div>`;
};

R.ofImport = ({ itemId, name, accounts, transactions, demo }) => {
  R.checkpoint(); const F = R.S.fin; let nAcc = 0, nTx = 0;
  const accMap = {};
  accounts.forEach(a => {
    let acc = F.accounts.find(x => x.ofId === a.id);
    if (!acc) { acc = { id: R.uid(), ofId: a.id, name: `${name || 'Banco'} — ${a.name}`, type: a.type === 'CREDIT' ? 'card' : (a.subtype === 'SAVINGS_ACCOUNT' ? 'savings' : 'checking'), initial: 0, color: R.PALETTE[F.accounts.length % 10], limit: a.creditLimit || 0, closing: a.closing || 0, dueDay: a.dueDay || 0 }; F.accounts.push(acc); nAcc++; }
    accMap[a.id] = acc;
  });
  const seen = new Set(F.txs.map(t => t.ofId).filter(Boolean));
  transactions.forEach(t => {
    if (seen.has(t.id) || !accMap[t.accountId]) return;
    F.txs.push({ id: R.uid(), ofId: t.id, date: t.date.slice(0, 10), amount: Math.abs(t.amount), kind: t.type === 'CREDIT' ? 'in' : 'out', desc: t.description, acc: accMap[t.accountId].id, cat: R.autoCategory(t.description) || '', paid: true, tags: ['openfinance'], notes: '', inst: '' }); nTx++;
  });
  // Saldo informado pelo banco: ajusta o saldo inicial DEPOIS de lançar as transações, para que saldo do Rumo = saldo do banco.
  accounts.forEach(a => {
    const acc = accMap[a.id], flow = F.txs.filter(t => t.acc === acc.id).reduce((s, t) => s + (t.kind === 'in' ? t.amount : -t.amount), 0), target = a.type === 'CREDIT' ? -Math.abs(a.balance || 0) : (a.balance || 0);
    acc.initial = +(target - flow).toFixed(2);
  });
  const it = (F.ofItems = F.ofItems || []).find(i => i.itemId === itemId); if (it) it.last = Date.now(); else F.ofItems.push({ itemId, name, last: Date.now(), demo: !!demo });
  R.save(); R.render(); R.toast(`${nAcc} conta(s) nova(s), ${nTx} transação(ões) importada(s).`);
};

R.ofSyncItem = async itemId => {
  const r = await fetch('/api/of/sync?itemId=' + encodeURIComponent(itemId)); if (!r.ok) throw new Error('sync ' + r.status);
  return R.ofImport({ itemId, ...(await r.json()) });
};

// Demonstração: banco fictício determinístico (não usa rede).
R.ofDemo = () => {
  const rnd = (() => { let s = 7; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })(), T = R.today(), tx = [];
  const shops = [['Supermercado Boa Compra', 90, 260], ['Padaria Pão Quente', 12, 38], ['Posto Estrela', 60, 180], ['iFood', 28, 95], ['Farmácia Saúde', 25, 120], ['Cinema Plaza', 30, 70], ['Uber', 14, 48], ['Netflix', 39.9, 39.9], ['Spotify', 21.9, 21.9], ['Academia Fit', 119, 119]];
  for (let i = 0; i < 70; i++) { const s = shops[Math.floor(rnd() * shops.length)], v = +(s[1] + rnd() * (s[2] - s[1])).toFixed(2); tx.push({ id: 'demo-c' + i, accountId: rnd() < .55 ? 'demo-card' : 'demo-acc', description: s[0], amount: v, date: R.addDays(T, -Math.floor(rnd() * 60)), type: 'DEBIT' }); }
  for (let k = 0; k < 2; k++) tx.push({ id: 'demo-s' + k, accountId: 'demo-acc', description: 'Salário Empresa XYZ', amount: 5200, date: R.addDays(T, -5 - 30 * k), type: 'CREDIT' });
  tx.push({ id: 'demo-r', accountId: 'demo-acc', description: 'Aluguel', amount: 1650, date: R.addDays(T, -3), type: 'DEBIT' });
  R.ofImport({ itemId: 'demo-item', name: 'Banco Demo', demo: true, accounts: [{ id: 'demo-acc', name: 'Conta corrente', type: 'BANK', balance: 4180.55 }, { id: 'demo-card', name: 'Cartão Platinum', type: 'CREDIT', balance: 1320.4, creditLimit: 8000, closing: 25, dueDay: 5 }], transactions: tx });
};

Object.assign(R.acts, {
  'of-demo': () => R.ofDemo(),
  'of-sync': async () => { R.toast('Sincronizando…'); for (const i of R.S.fin.ofItems || []) { if (i.demo) continue; try { await R.ofSyncItem(i.itemId); } catch { R.toast('Falha ao sincronizar ' + (i.name || 'banco')); } } },
  'of-del': el => { R.S.fin.ofItems = R.S.fin.ofItems.filter(i => i.itemId !== el.closest('[data-id]').dataset.id); R.save(); R.render(); },
  'of-connect': async () => {
    try {
      if (!window.PluggyConnect) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.pluggy.ai/pluggy-connect/v2.8.0/pluggy-connect.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const { accessToken } = await (await fetch('/api/of/connect-token', { method: 'POST' })).json();
      const widget = new window.PluggyConnect({ connectToken: accessToken, includeSandbox: false, onSuccess: async data => { try { await R.ofSyncItem(data.item.id); } catch { R.toast('Conectado, mas a sincronização falhou.'); } }, onError: () => R.toast('Não foi possível conectar.') });
      widget.init();
    } catch { R.toast('Não consegui abrir o Pluggy Connect. Confira a configuração do backend.'); }
  },
});
