'use strict';
// Rumo — assistente de IA (opcional). Fala com qualquer endpoint compatível com a API da OpenAI
// (OmniRoute, FreeLLMAPI, OpenRouter, Ollama…). A chave fica só neste navegador.

R.aiReady = () => !!R.S.settings.ai.endpoint;
R.aiChat = async (messages, json = false) => {
  const { endpoint, key, model } = R.S.settings.ai; if (!endpoint) throw new Error('Configure o endpoint de IA em Integrações.');
  const url = endpoint.replace(/\/+$/, '') + '/chat/completions', body = JSON.stringify({ model: model || 'gpt-4o-mini', messages, temperature: 0.2, ...(json ? {} : {}) });
  const headers = { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) };
  let r;
  try { r = await fetch(url, { method: 'POST', headers, body }); }
  catch { r = await fetch('/api/ai', { method: 'POST', headers: { ...headers, 'X-Target': url }, body }); } // proxy do servidor local (evita CORS)
  if (!r.ok) throw new Error('IA respondeu ' + r.status);
  const d = await r.json(); return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
};
R.extractJSON = s => { const m = s.match(/\[[\s\S]*\]/) || s.match(/\{[\s\S]*\}/); if (!m) throw new Error('resposta sem JSON'); return JSON.parse(m[0]); };

// Sugere, para cada item da Caixa de entrada, o destino GTD (próxima ação, aguardando, algum dia, projeto, contexto, data).
R.aiProcessInbox = async () => {
  const items = R.S.tasks.filter(t => t.status === 'inbox').slice(0, 25); if (!items.length) { R.toast('Caixa de entrada vazia.'); return; }
  R.toast('Pensando…', null, 15000);
  const sys = `Você é um assistente GTD. Para cada item, responda SOMENTE um array JSON: [{"id":"...","status":"next|waiting|someday|reference|trash","title":"ação clara no infinitivo","contexts":["casa|pc|rua|telefone|online|energia-baixa"],"prio":0-3,"due":"AAAA-MM-DD ou vazio","waitingFor":"quem ou vazio","project":"nome de projeto ou vazio"}]. Hoje é ${R.today()}. Português do Brasil.`;
  try {
    const out = R.extractJSON(await R.aiChat([{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(items.map(t => ({ id: t.id, title: t.title, notes: t.notes.slice(0, 200) }))) }]));
    R.modal(`<h3>✨ Sugestões da IA</h3><p class="muted small">Revise e aplique. Nada muda antes de você confirmar.</p><div style="max-height:55vh;overflow:auto">${out.map((s, i) => { const t = R.task(s.id); if (!t) return ''; return `<label class="list-i" style="margin:0"><span class="grow"><input type="checkbox" data-i="${i}" checked style="width:auto;margin-right:8px"><b>${R.esc(s.title || t.title)}</b><div class="muted small">${R.esc(R.STATUS[s.status] || 'excluir')}${s.due ? ' · ' + R.fmtShort(s.due) : ''}${(s.contexts || []).map(c => ' · @' + R.esc(c)).join('')}${s.project ? ' · ◈ ' + R.esc(s.project) : ''}${s.waitingFor ? ' · ⏳ ' + R.esc(s.waitingFor) : ''}</div></span></label>`; }).join('')}</div><div class="actions"><button data-act="close-modal">Cancelar</button><button class="pri" id="aiOk">Aplicar selecionadas</button></div>`, { wide: true });
    R.$('#aiOk').onclick = () => {
      R.checkpoint(); R.$$('#dlg [data-i]').forEach(c => {
        if (!c.checked) return; const s = out[+c.dataset.i], t = R.task(s.id); if (!t) return;
        if (s.status === 'trash') { R.S.tasks = R.S.tasks.filter(x => x.id !== t.id); return; }
        t.title = s.title || t.title; t.status = ['next', 'waiting', 'someday', 'reference'].includes(s.status) ? s.status : 'next'; t.contexts = (s.contexts || []).filter(Boolean); t.prio = +s.prio || 0; t.due = /^\d{4}-\d{2}-\d{2}$/.test(s.due || '') ? s.due : t.due; t.waitingFor = s.waitingFor || '';
        if (s.project) { let p = R.S.projects.find(x => x.name.toLowerCase() === s.project.toLowerCase()); if (!p) { p = { id: R.uid(), name: s.project, outcome: '', status: 'active', created: Date.now() }; R.S.projects.push(p); } t.project = p.id; }
      }); R.save(); R.closeModal(); R.render(); R.toast('Sugestões aplicadas.', { label: 'Desfazer', fn: R.undo });
    };
  } catch (e) { R.toast('IA: ' + e.message); }
};

R.aiSummary = async kind => {
  R.toast('Gerando…', null, 15000);
  let prompt;
  if (kind === 'week') { const c = R.counts(); prompt = `Resuma minha semana e sugira 3 prioridades para a próxima. Dados: ${JSON.stringify({ hoje: R.today(), contagens: c, atrasadas: R.tasksFor({ type: 'today' }).filter(t => t.due < R.today()).slice(0, 10).map(t => t.title), proximas: R.tasksFor({ type: 'week' }).slice(0, 12).map(t => t.title), foco_min_7d: [...Array(7)].reduce((s, _, i) => s + (R.S.focus[R.addDays(R.today(), -i)] || 0), 0) })}`; }
  else { const m = R.ui.month, F = R.S.fin, sum = R.finSummary(m), cats = F.cats.filter(c => c.kind === 'out').map(c => ({ c: c.name, v: +F.txs.filter(t => t.date.startsWith(m) && t.cat === c.id && t.kind === 'out' && !t.transfer).reduce((s, t) => s + t.amount, 0).toFixed(2), orc: (F.budgets.default || {})[c.id] || 0 })).filter(x => x.v > 0); prompt = `Analise meus gastos de ${m} e dê 4 dicas práticas e objetivas. Dados: ${JSON.stringify({ receitas: sum.inc, despesas: sum.out, categorias: cats })}`; }
  try { const txt = await R.aiChat([{ role: 'system', content: 'Você é um consultor pessoal direto e gentil. Responda em português do Brasil, em tópicos curtos.' }, { role: 'user', content: prompt }]); R.modal(`<h3>${kind === 'week' ? '✨ Resumo da semana' : '✨ Análise de gastos'}</h3><div style="white-space:pre-wrap;max-height:60vh;overflow:auto">${R.esc(txt)}</div><div class="actions"><button class="pri" data-act="close-modal">Fechar</button></div>`); }
  catch (e) { R.toast('IA: ' + e.message); }
};

Object.assign(R.acts, {
  'ai-inbox': () => R.aiProcessInbox(), 'ai-week': () => R.aiSummary('week'), 'ai-fin': () => R.aiSummary('fin'),
  'ai-test': async () => { try { const r = await R.aiChat([{ role: 'user', content: 'Responda apenas: ok' }]); R.toast('IA respondeu: ' + r.slice(0, 40)); } catch (e) { R.toast('Falhou: ' + e.message); } },
});
// Botões de IA aparecem nas telas relevantes quando há endpoint configurado.
R.hooks.push(() => {
  if (!R.aiReady()) return;
  const add = (sel, html) => { const h = R.$(sel); if (h && !h.querySelector('[data-ai]')) h.insertAdjacentHTML('beforeend', html); };
  if (R.ui.view === 'tasks' && R.ui.sel.type === 'inbox') add('.pagehead', '<button data-ai data-act="ai-inbox">✨ Organizar com IA</button>');
  if (R.ui.view === 'tasks' && R.ui.sel.type === 'week') add('.pagehead', '<button data-ai data-act="ai-week">✨ Resumo da semana</button>');
  if (R.ui.view === 'money') add('.pagehead', '<button data-ai data-act="ai-fin">✨ Analisar gastos</button>');
});
