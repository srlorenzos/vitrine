'use strict';
// Rumo — integrações: Google (Agenda, Gmail, Tasks) e Microsoft (Outlook Calendário, e-mail, To Do).
// Tudo roda no navegador com OAuth do próprio usuário (Client ID informado em Configurações). Nenhum token vai a servidor.

R.TK_KEY = 'rumo.tokens';
try { R.tokens = JSON.parse(localStorage.getItem(R.TK_KEY) || '{}'); } catch { R.tokens = {}; }
R.saveTokens = () => { try { localStorage.setItem(R.TK_KEY, JSON.stringify(R.tokens)); } catch { } };
R.tokenOk = k => R.tokens[k] && R.tokens[k].access_token && R.tokens[k].expires_at > Date.now() + 30000;
R.integrationsReady = () => R.tokenOk('google') || R.tokenOk('ms') || R.tokens.demo;
R.localDT = d => `${R.iso(d)}T${R.pad(d.getHours())}:${R.pad(d.getMinutes())}`;
R.loadScript = src => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('script')); document.head.appendChild(s); });
const GSCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/tasks';
const MSCOPE = 'offline_access User.Read Calendars.ReadWrite Mail.Read Tasks.ReadWrite';

/* ---------------- login por loopback (app de desktop) ---------------- */
// No Electron o Google bloqueia login embutido; abrimos o navegador do sistema e recebemos o código em /oauth/callback.
R.isDesktop = /RumoDesktop/.test(navigator.userAgent);
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
R.tokenPost = async (url, params) => {
  if (R.isDesktop || location.protocol.startsWith('http') && location.hostname === 'localhost') { // via servidor local (evita CORS e permite client_secret)
    const r = await fetch('/api/oauth/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, params }) }); if (!r.ok) throw new Error('token ' + r.status); return r.json();
  }
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) }); if (!r.ok) throw new Error('token ' + r.status); return r.json();
};
R.OAUTH = {
  google: () => ({ cid: R.S.settings.google.clientId.trim(), secret: (R.S.settings.google.clientSecret || '').trim(), auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', scope: GSCOPE, extra: '&access_type=offline&prompt=consent' }),
  ms: () => ({ cid: R.S.settings.ms.clientId.trim(), secret: '', auth: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', scope: MSCOPE, extra: '&response_mode=query' }),
};
R.setToken = (prov, d) => { R.tokens[prov] = { access_token: d.access_token, refresh_token: d.refresh_token || (R.tokens[prov] && R.tokens[prov].refresh_token), expires_at: Date.now() + (d.expires_in || 3600) * 1000 }; R.saveTokens(); };
R.refreshToken = async prov => { const c = R.OAUTH[prov](), t = R.tokens[prov]; if (!t || !t.refresh_token) throw new Error('sem refresh'); R.setToken(prov, await R.tokenPost(c.token, { client_id: c.cid, grant_type: 'refresh_token', refresh_token: t.refresh_token, ...(c.secret ? { client_secret: c.secret } : {}), ...(prov === 'ms' ? { scope: MSCOPE } : {}) })); };
R.hasAuth = prov => R.tokenOk(prov) || !!(R.tokens[prov] && R.tokens[prov].refresh_token);
R.oauthLoopback = async prov => {
  const c = R.OAUTH[prov](); if (!c.cid) { R.toast('Informe o Client ID em Integrações.'); return; }
  const ver = b64url(crypto.getRandomValues(new Uint8Array(32))), ch = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ver))), st = R.uid() + R.uid(), redirect = location.origin + '/oauth/callback';
  window.open(`${c.auth}?client_id=${encodeURIComponent(c.cid)}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(c.scope)}&state=${st}&code_challenge=${ch}&code_challenge_method=S256${c.extra}`, '_blank');
  R.toast('Conclua o login no navegador que abriu…', null, 8000);
  for (let i = 0; i < 180; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const p = await (await fetch('/api/oauth/poll?state=' + st)).json(); if (p.pending) continue;
    if (!p.code) { R.toast('Login cancelado ou negado.'); return; }
    try { R.setToken(prov, await R.tokenPost(c.token, { client_id: c.cid, code: p.code, code_verifier: ver, redirect_uri: redirect, grant_type: 'authorization_code', ...(c.secret ? { client_secret: c.secret } : {}) })); R.toast((prov === 'google' ? 'Google' : 'Microsoft') + ' conectado.'); R.syncAll(); R.render(); }
    catch { R.toast('Não consegui concluir o login (confira Client ID/secret).'); } return;
  }
  R.toast('Tempo esgotado esperando o login.');
};

/* ---------------- Google ---------------- */
R.googleConnect = async () => {
  const cid = R.S.settings.google.clientId.trim(); if (!cid) { R.toast('Informe o Client ID do Google em Integrações.'); return; }
  if (R.isDesktop) return R.oauthLoopback('google');
  try {
    await R.loadScript('https://accounts.google.com/gsi/client');
    const tc = google.accounts.oauth2.initTokenClient({ client_id: cid, scope: GSCOPE, callback: resp => {
      if (resp.error) { R.toast('Google: ' + resp.error); return; }
      R.tokens.google = { access_token: resp.access_token, expires_at: Date.now() + (resp.expires_in || 3600) * 1000 }; R.saveTokens(); R.toast('Google conectado.'); R.syncAll(); R.render();
    } });
    tc.requestAccessToken({ prompt: R.tokens.google ? '' : 'consent' });
  } catch { R.toast('Não consegui carregar o login do Google (verifique a conexão).'); }
};
R.gFetch = async (url, opt = {}) => {
  if (!R.tokenOk('google') && R.tokens.google && R.tokens.google.refresh_token) await R.refreshToken('google');
  const r = await fetch(url, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + R.tokens.google.access_token, 'Content-Type': 'application/json' } });
  if (r.status === 401) { delete R.tokens.google; R.saveTokens(); R.render(); throw new Error('expirou'); }
  if (!r.ok) throw new Error('google ' + r.status); return r.status === 204 ? null : r.json();
};
R.syncGoogleCalendar = async () => {
  const min = new Date(Date.now() - 7 * 864e5).toISOString(), max = new Date(Date.now() + 60 * 864e5).toISOString();
  const d = await R.gFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(min)}&timeMax=${encodeURIComponent(max)}`);
  return (d.items || []).filter(e => e.status !== 'cancelled').map(e => {
    const allDay = !!e.start.date; let s = allDay ? e.start.date : R.localDT(new Date(e.start.dateTime)), en = allDay ? R.addDays(e.end.date, -1) : R.localDT(new Date(e.end.dateTime));
    if (allDay && en < s) en = s; return { id: 'g-' + e.id, title: e.summary || '(sem título)', start: s, end: en, allDay, source: 'google', link: e.htmlLink };
  });
};
R.googleTasks = async () => {
  const lists = (await R.gFetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists')).items || [], out = [];
  for (const l of lists) { const t = await R.gFetch(`https://tasks.googleapis.com/tasks/v1/lists/${l.id}/tasks?showCompleted=false&maxResults=100`); (t.items || []).forEach(x => out.push({ id: x.id, title: x.title, notes: x.notes || '', due: x.due ? x.due.slice(0, 10) : '', list: l.title })); }
  return out;
};
R.googleMail = async q => {
  const l = await R.gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=${encodeURIComponent(q)}`), out = [];
  for (const m of l.messages || []) { const x = await R.gFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`); const h = n => ((x.payload.headers || []).find(y => y.name === n) || {}).value || ''; out.push({ id: m.id, subject: h('Subject') || '(sem assunto)', from: h('From').replace(/<.*>/, '').trim(), link: `https://mail.google.com/mail/u/0/#inbox/${m.id}`, src: 'Gmail' }); }
  return out;
};

/* ---------------- Microsoft ---------------- */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
R.msRedirect = () => location.origin + location.pathname;
R.msConnect = async () => {
  const cid = R.S.settings.ms.clientId.trim(); if (!cid) { R.toast('Informe o Application (client) ID da Microsoft em Integrações.'); return; }
  if (R.isDesktop) return R.oauthLoopback('ms');
  if (location.protocol === 'file:') { R.toast('O login Microsoft exige abrir o Rumo por http (use o app de desktop ou o site).'); return; }
  const ver = b64u(crypto.getRandomValues(new Uint8Array(32))), ch = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ver))), st = R.uid();
  sessionStorage.setItem('rumo.ms', JSON.stringify({ ver, st }));
  location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(cid)}&response_type=code&redirect_uri=${encodeURIComponent(R.msRedirect())}&response_mode=query&scope=${encodeURIComponent(MSCOPE)}&state=${st}&code_challenge=${ch}&code_challenge_method=S256`;
};
R.msToken = async body => { R.setToken('ms', await R.tokenPost('https://login.microsoftonline.com/common/oauth2/v2.0/token', { client_id: R.S.settings.ms.clientId.trim(), scope: MSCOPE, ...body })); };
R.msHandleRedirect = async () => {
  const p = new URLSearchParams(location.search), code = p.get('code'); if (!code || !p.get('state')) return;
  try { const s = JSON.parse(sessionStorage.getItem('rumo.ms') || '{}'); if (s.st !== p.get('state')) throw 0; await R.msToken({ grant_type: 'authorization_code', code, redirect_uri: R.msRedirect(), code_verifier: s.ver }); R.toast('Microsoft conectada.'); }
  catch { R.toast('Falha no login da Microsoft.'); }
  sessionStorage.removeItem('rumo.ms'); history.replaceState({}, '', R.msRedirect());
};
R.mFetch = async (url, opt = {}) => {
  if (!R.tokenOk('ms') && R.tokens.ms && R.tokens.ms.refresh_token) await R.msToken({ grant_type: 'refresh_token', refresh_token: R.tokens.ms.refresh_token });
  if (!R.tokenOk('ms')) throw new Error('ms expirou');
  const r = await fetch(url, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + R.tokens.ms.access_token, 'Content-Type': 'application/json', Prefer: 'outlook.timezone="America/Sao_Paulo"' } });
  if (!r.ok) throw new Error('graph ' + r.status); return r.status === 204 ? null : r.json();
};
R.syncOutlookCalendar = async () => {
  const s = new Date(Date.now() - 7 * 864e5).toISOString(), e = new Date(Date.now() + 60 * 864e5).toISOString();
  const d = await R.mFetch(`https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(s)}&endDateTime=${encodeURIComponent(e)}&$top=250&$select=id,subject,start,end,isAllDay,webLink`);
  return (d.value || []).map(x => { const allDay = x.isAllDay; let st = x.start.dateTime.slice(0, allDay ? 10 : 16), en = x.end.dateTime.slice(0, allDay ? 10 : 16); if (allDay) { en = R.addDays(en, -1); if (en < st) en = st; } return { id: 'm-' + x.id, title: x.subject || '(sem título)', start: st, end: en, allDay, source: 'ms', link: x.webLink }; });
};
R.outlookTasks = async () => {
  const lists = (await R.mFetch('https://graph.microsoft.com/v1.0/me/todo/lists')).value || [], out = [];
  for (const l of lists) { const t = await R.mFetch(`https://graph.microsoft.com/v1.0/me/todo/lists/${l.id}/tasks?$filter=status ne 'completed'&$top=100`); (t.value || []).forEach(x => out.push({ id: x.id, title: x.title, notes: (x.body && x.body.content) || '', due: x.dueDateTime ? x.dueDateTime.dateTime.slice(0, 10) : '', list: l.displayName })); }
  return out;
};
R.outlookMail = async () => {
  const d = await R.mFetch(`https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent("flag/flagStatus eq 'flagged'")}&$top=15&$select=id,subject,from,webLink`);
  return (d.value || []).map(x => ({ id: x.id, subject: x.subject || '(sem assunto)', from: (x.from && x.from.emailAddress && x.from.emailAddress.name) || '', link: x.webLink, src: 'Outlook' }));
};

/* ---------------- sincronização, e-mail → tarefa, agendar ---------------- */
R.syncAll = async () => {
  let n = 0; const keep = R.S.events.filter(e => e.source === 'ics');
  try {
    if (R.tokens.demo) { R.demoEvents(); R.toast('Demonstração sincronizada.'); R.render(); return; }
    let ev = [];
    if (R.hasAuth('google')) { try { ev = ev.concat(await R.syncGoogleCalendar()); n++; } catch (e) { R.toast('Google Agenda: ' + e.message); } }
    if (R.hasAuth('ms')) { try { ev = ev.concat(await R.syncOutlookCalendar()); n++; } catch (e) { R.toast('Outlook: ' + e.message); } }
    if (n) { R.S.events = keep.concat(ev); R.save(); R.toast(`${ev.length} evento(s) sincronizado(s).`); }
  } finally { R.render(); }
};

R.mailModal = (title, items) => {
  const exists = id => R.S.tasks.some(t => t.source && t.source.id === id);
  R.modal(`<h3>${R.esc(title)}</h3><p class="muted small">Transforme e-mails em tarefas na Caixa de entrada (com link para o e-mail).</p><div style="max-height:55vh;overflow:auto">${items.length ? items.map((m, i) => `<div class="list-i"><span class="grow"><b>${R.esc(m.subject)}</b><div class="muted small">${R.esc(m.from)}</div></span><button class="sm ${exists(m.id) ? '' : 'pri'}" data-i="${i}" ${exists(m.id) ? 'disabled' : ''}>${exists(m.id) ? 'Já importado' : '→ Tarefa'}</button></div>`).join('') : '<div class="empty">Nenhum e-mail encontrado.</div>'}</div><div class="actions"><button class="pri" data-act="close-modal">Fechar</button></div>`, { wide: true });
  R.$$('#dlg [data-i]').forEach(b => b.onclick = () => { const m = items[+b.dataset.i]; R.addTask({ title: m.subject, notes: `De: ${m.from}\n${m.link}`, status: 'inbox', source: { type: 'mail', id: m.id, label: m.src, link: m.link } }); b.textContent = 'Importado'; b.disabled = true; b.classList.remove('pri'); R.render(); });
};
R.importExternalTasks = (items, label) => {
  let n = 0; items.forEach(x => { if (R.S.tasks.some(t => t.source && t.source.id === x.id)) return; R.addTask({ title: x.title, notes: x.notes, due: x.due, status: x.due ? 'next' : 'inbox', source: { type: 'tasks', id: x.id, label } }); n++; });
  R.render(); R.toast(`${n} tarefa(s) importada(s) de ${label}.`);
};

R.scheduleOnCalendar = id => {
  const t = R.task(id); if (!t) return; const prov = [R.tokenOk('google') || R.tokens.demo ? ['google', 'Google Agenda'] : null, R.tokenOk('ms') || R.tokens.demo ? ['ms', 'Outlook'] : null].filter(Boolean);
  R.modal(`<form id="sc"><h3>Agendar no calendário</h3><b>${R.esc(t.title)}</b><div class="three"><div><label>Data</label><input type="date" name="d" value="${t.due || R.today()}" required></div><div><label>Início</label><input type="time" name="t" value="${t.time || '09:00'}" required></div><div><label>Duração (min)</label><input type="number" name="m" min="5" step="5" value="${t.dur || 30}"></div></div>
    <label>Calendário</label><select name="p">${prov.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select><div class="actions"><button type="button" id="scx">Cancelar</button><button class="pri">Criar evento</button></div></form>`);
  R.$('#scx').onclick = R.closeModal;
  R.$('#sc').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(R.$('#sc')), s = new Date(`${f.get('d')}T${f.get('t')}`), en = new Date(s.getTime() + (+f.get('m') || 30) * 60000), tz = 'America/Sao_Paulo';
    try {
      let evId = 'x-' + R.uid(), link = '';
      if (!R.tokens.demo) {
        if (f.get('p') === 'google') { const r = await R.gFetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', { method: 'POST', body: JSON.stringify({ summary: t.title, description: t.notes, start: { dateTime: s.toISOString(), timeZone: tz }, end: { dateTime: en.toISOString(), timeZone: tz } }) }); evId = 'g-' + r.id; link = r.htmlLink; }
        else { const r = await R.mFetch('https://graph.microsoft.com/v1.0/me/events', { method: 'POST', body: JSON.stringify({ subject: t.title, body: { contentType: 'text', content: t.notes }, start: { dateTime: R.localDT(s), timeZone: tz }, end: { dateTime: R.localDT(en), timeZone: tz } }) }); evId = 'm-' + r.id; link = r.webLink; }
      }
      R.S.events.push({ id: evId, title: t.title, start: R.localDT(s), end: R.localDT(en), allDay: false, source: f.get('p'), link });
      t.due = f.get('d'); t.time = f.get('t'); t.dur = +f.get('m') || 30; R.save(); R.closeModal(); R.render(); R.toast('Evento criado no calendário.');
    } catch (err) { R.toast('Não foi possível criar o evento: ' + err.message); }
  };
};

/* ---------------- demonstração (sem contas reais) ---------------- */
R.demoEvents = () => {
  const T = R.today(), at = (d, h, m, dur) => { const s = h * 60 + m, e = s + dur; return [`${R.addDays(T, d)}T${R.hm(s)}`, `${R.addDays(T, d)}T${R.hm(e)}`]; };
  const mk = (id, title, d, h, m, dur, source) => { const [s, e] = at(d, h, m, dur); return { id, title, start: s, end: e, allDay: false, source }; };
  R.S.events = R.S.events.filter(e => e.source === 'ics').concat([
    mk('dg1', 'Alinhamento com o cliente', 0, 10, 30, 60, 'google'), mk('dg2', 'Almoço com cliente', 0, 12, 30, 90, 'google'), mk('dm1', 'Daily do time', 1, 9, 30, 30, 'ms'),
    mk('dm2', 'Revisão trimestral (Teams)', 2, 14, 0, 60, 'ms'), mk('dg3', 'Consulta médica', 3, 16, 0, 45, 'google'), mk('dm3', '1:1 com gestor', 4, 11, 0, 30, 'ms'),
    { id: 'dg4', title: 'Feriado — Dia de Finados', start: R.addDays(T, 20), end: R.addDays(T, 20), allDay: true, source: 'google' },
  ]);
  R.save();
};
R.demoMail = () => [
  { id: 'dmail1', subject: 'Proposta comercial — revisar até sexta', from: 'Marina Costa', link: '#', src: 'Gmail' },
  { id: 'dmail2', subject: 'Boleto da internet vence dia 10', from: 'Provedor Net', link: '#', src: 'Gmail' },
  { id: 'dmail3', subject: 'Re: Contrato de prestação de serviço', from: 'Jurídico', link: '#', src: 'Outlook' },
];

Object.assign(R.acts, {
  'google-connect': () => R.googleConnect(), 'ms-connect': () => R.msConnect(),
  'google-disconnect': () => { delete R.tokens.google; R.saveTokens(); R.S.events = R.S.events.filter(e => e.source !== 'google'); R.save(); R.render(); },
  'ms-disconnect': () => { delete R.tokens.ms; R.saveTokens(); R.S.events = R.S.events.filter(e => e.source !== 'ms'); R.save(); R.render(); },
  'int-demo': () => { R.tokens.demo = true; R.saveTokens(); R.demoEvents(); R.render(); R.toast('Contas de demonstração conectadas.'); },
  'int-demo-off': () => { delete R.tokens.demo; R.saveTokens(); R.S.events = R.S.events.filter(e => e.source === 'ics'); R.save(); R.render(); },
  'mail-google': async () => { if (R.tokens.demo) return R.mailModal('E-mails marcados', R.demoMail().filter(m => m.src === 'Gmail')); try { R.mailModal('Gmail — com estrela', await R.googleMail('is:starred')); } catch (e) { R.toast('Gmail: ' + e.message); } },
  'mail-ms': async () => { if (R.tokens.demo) return R.mailModal('Outlook — sinalizados', R.demoMail().filter(m => m.src === 'Outlook')); try { R.mailModal('Outlook — sinalizados', await R.outlookMail()); } catch (e) { R.toast('Outlook: ' + e.message); } },
  'tasks-google': async () => { if (R.tokens.demo) return R.importExternalTasks([{ id: 'dgt1', title: 'Renovar passaporte', due: R.addDays(R.today(), 14) }, { id: 'dgt2', title: 'Pesquisar seguro viagem' }], 'Google Tasks'); try { R.importExternalTasks(await R.googleTasks(), 'Google Tasks'); } catch (e) { R.toast('Google Tasks: ' + e.message); } },
  'tasks-ms': async () => { if (R.tokens.demo) return R.importExternalTasks([{ id: 'dmt1', title: 'Enviar relatório mensal', due: R.addDays(R.today(), 3) }], 'Microsoft To Do'); try { R.importExternalTasks(await R.outlookTasks(), 'Microsoft To Do'); } catch (e) { R.toast('To Do: ' + e.message); } },
});

// Ao abrir: trata o retorno do login Microsoft e sincroniza em segundo plano quando há token válido.
R.hooks.push(() => { if (!R._intBoot) { R._intBoot = true; R.msHandleRedirect().then(() => { if (R.hasAuth('google') || R.hasAuth('ms')) R.syncAll(); }); } });
