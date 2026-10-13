'use strict';
// Rumo — Integrações e Configurações.

R.views.settings = () => {
  const s = R.S.settings, g = R.hasAuth('google'), m = R.hasAuth('ms'), demo = R.tokens.demo, desk = R.isDesktop, origin = desk ? 'http://localhost:38412' : location.origin;
  const status = ok => ok ? '<span class="badge">conectado</span>' : '<span class="badge warn">desconectado</span>';
  const guide = (title, html) => `<details style="margin-top:8px"><summary class="muted small" style="cursor:pointer">${title}</summary><div class="small muted" style="margin-top:6px">${html}</div></details>`;
  return `<div class="page"><div class="pagehead"><h1>🔌 Integrações e configurações</h1></div>
  <div class="grid g2">
    <div class="card"><div class="row between"><h3>Google</h3>${status(g)}</div><p class="muted small">Agenda (ler/criar eventos), Gmail (e-mails com estrela → tarefas) e Google Tasks.</p>
      <label>Client ID (OAuth — ${desk ? 'app para computador' : 'aplicativo Web'})</label><input id="gCid" value="${R.esc(s.google.clientId)}" placeholder="xxxxxxxx.apps.googleusercontent.com">
      ${desk ? `<label>Client secret</label><input id="gSec" type="password" value="${R.esc(s.google.clientSecret || '')}" autocomplete="off">` : ''}
      <div class="row wrap" style="margin-top:10px">${g ? `<button data-act="sync">⟳ Sincronizar agenda</button><button data-act="mail-google">✉ Gmail</button><button data-act="tasks-google">☑ Google Tasks</button><button class="danger" data-act="google-disconnect">Desconectar</button>` : '<button class="pri" data-act="google-connect">Conectar Google</button>'}</div>
      ${guide('Como obter o Client ID', `<ol style="margin:0 0 0 18px;padding:0"><li>Em <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a> crie um projeto e ative as APIs Calendar, Gmail e Tasks.</li>${desk ? '<li>Credenciais → Criar → <b>ID do cliente OAuth</b> → tipo <b>App para computador</b>. Copie o Client ID e o Client secret.</li>' : `<li>Credenciais → Criar → <b>ID do cliente OAuth</b> → tipo <b>Aplicativo da Web</b>.</li><li>Em "Origens JavaScript autorizadas" adicione <code>${R.esc(origin)}</code>.</li>`}<li>Cole os dados acima. Seu app fica em modo "teste": adicione seu e-mail como usuário de teste.</li></ol>`)}</div>
    <div class="card"><div class="row between"><h3>Microsoft (Outlook)</h3>${status(m)}</div><p class="muted small">Outlook Calendário, e-mails sinalizados e Microsoft To Do.</p>
      <label>Application (client) ID</label><input id="mCid" value="${R.esc(s.ms.clientId)}" placeholder="00000000-0000-0000-0000-000000000000">
      <div class="row wrap" style="margin-top:10px">${m ? `<button data-act="sync">⟳ Sincronizar agenda</button><button data-act="mail-ms">✉ Outlook</button><button data-act="tasks-ms">☑ To Do</button><button class="danger" data-act="ms-disconnect">Desconectar</button>` : '<button class="pri" data-act="ms-connect">Conectar Microsoft</button>'}</div>
      ${guide('Como obter o Client ID', `<ol style="margin:0 0 0 18px;padding:0"><li>Em <a href="https://entra.microsoft.com" target="_blank" rel="noopener">Microsoft Entra</a> → Registros de aplicativo → Novo registro (contas de qualquer diretório + pessoais).</li><li>Plataforma <b>Aplicativo de página única (SPA)</b> com URI de redirecionamento <code>${R.esc(desk ? 'http://localhost:38412/oauth/callback' : R.msRedirect())}</code>.</li><li>Permissões (Graph, delegadas): Calendars.ReadWrite, Mail.Read, Tasks.ReadWrite, User.Read.</li><li>Copie o <i>Application (client) ID</i> para o campo acima.</li></ol>`)}</div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><div class="row between"><h3>🏦 Open Finance</h3><span class="badge warn">Pluggy</span></div><p class="muted small">Contas, cartões e transações dos seus bancos, automáticos. Configuração e conexão em Finanças → Open Finance.</p><button data-act="open-of">Abrir Open Finance</button></div>
    <div class="card"><div class="row between"><h3>✨ Inteligência artificial</h3>${R.aiReady() ? '<span class="badge">ativa</span>' : '<span class="badge warn">opcional</span>'}</div>
      <label>Endpoint (compatível com OpenAI)</label><input id="aiEp" value="${R.esc(s.ai.endpoint)}" placeholder="http://localhost:20128/v1"><div class="two"><div><label>Chave de API</label><input id="aiKey" type="password" value="${R.esc(s.ai.key)}" autocomplete="off"></div><div><label>Modelo</label><input id="aiModel" value="${R.esc(s.ai.model)}"></div></div>
      <div class="row" style="margin-top:10px"><button data-act="ai-test">Testar</button></div><div class="muted small" style="margin-top:6px">Organiza a Caixa de entrada, resume a semana e analisa gastos. A chave fica só neste navegador.</div></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3 style="margin-bottom:6px">Preferências</h3><div class="two"><div><label>Tema</label><select id="sTheme">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([k, v]) => `<option value="${k}" ${s.theme === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div><div></div><div><label>Início do expediente</label><input type="time" id="sWs" value="${s.workStart}"></div><div><label>Fim do expediente</label><input type="time" id="sWe" value="${s.workEnd}"></div></div><div class="muted small" style="margin-top:6px">O expediente define onde o "Planejar meu dia" encaixa tarefas.</div></div>
    <div class="card"><h3 style="margin-bottom:6px">Seus dados</h3><div class="muted small" style="margin-bottom:8px">Tudo fica neste dispositivo (localStorage). Faça backup regularmente.</div><div class="row wrap"><button data-act="data-export">⬇ Exportar backup</button><button data-act="data-import">⬆ Importar backup</button><input type="file" id="bkFile" accept="application/json" hidden><button data-act="data-sample">Carregar dados de exemplo</button><button class="danger" data-act="data-reset">Apagar tudo</button></div>
      ${demo ? '<div style="margin-top:10px"><span class="badge">contas de demonstração ativas</span> <button class="sm" data-act="int-demo-off">desligar</button></div>' : '<div style="margin-top:10px"><button class="sm" data-act="int-demo">Conectar contas de demonstração (sem login)</button></div>'}</div>
  </div>
  <div class="card" style="margin-top:14px"><h3 style="margin-bottom:6px">Instalar como aplicativo</h3><div class="muted small">No navegador: menu → "Instalar Rumo" (PWA, funciona offline). Há também o instalador para Windows na página de downloads.</div><div class="row" style="margin-top:8px"><button id="bInstall" class="hide pri">Instalar agora</button></div></div></div>`;
};

Object.assign(R.acts, {
  'data-export': () => R.exportJSON(), 'data-import': () => R.$('#bkFile').click(),
  'data-sample': async () => { if (await R.confirm('Substituir os dados atuais pelos dados de exemplo? (faça backup antes)', 'Carregar exemplo')) { R.checkpoint(); R.loadSample(); R.render(); R.toast('Dados de exemplo carregados.', { label: 'Desfazer', fn: R.undo }); } },
  'data-reset': async () => { if (await R.confirm('Apagar TODOS os dados deste dispositivo? Isso não pode ser desfeito sem backup.', 'Apagar tudo')) { R.checkpoint(); R.S = R.defaults(); R.save(); R.tokens = {}; R.saveTokens(); R.render(); } },
});
R.hooks.push(() => {
  if (R.ui.view !== 'settings') return;
  const bind = (id, fn) => { const e = R.$(id); if (e) e.onchange = () => { fn(e.value); R.save(); }; };
  bind('#gCid', v => R.S.settings.google.clientId = v.trim()); bind('#gSec', v => R.S.settings.google.clientSecret = v.trim()); bind('#mCid', v => R.S.settings.ms.clientId = v.trim());
  bind('#aiEp', v => R.S.settings.ai.endpoint = v.trim()); bind('#aiKey', v => R.S.settings.ai.key = v.trim()); bind('#aiModel', v => R.S.settings.ai.model = v.trim());
  bind('#sWs', v => R.S.settings.workStart = v || '08:00'); bind('#sWe', v => R.S.settings.workEnd = v || '18:00');
  const th = R.$('#sTheme'); if (th) th.onchange = () => { R.S.settings.theme = th.value; R.save(); R.render(); };
  const bk = R.$('#bkFile'); if (bk) bk.onchange = () => { if (bk.files[0]) R.importJSON(bk.files[0]); };
  if (window._deferredInstall && R.$('#bInstall')) { R.$('#bInstall').classList.remove('hide'); R.$('#bInstall').onclick = () => { window._deferredInstall.prompt(); window._deferredInstall = null; }; }
});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window._deferredInstall = e; if (R.ui && R.ui.view === 'settings') R.render(); });
