'use strict';
// Rumo — utilitários: DOM, datas, formatação, captura em linguagem natural (pt-BR), modais e toasts.
window.R = window.R || { acts: {}, views: {}, hooks: [] };

R.$ = (s, r = document) => r.querySelector(s);
R.$$ = (s, r = document) => [...r.querySelectorAll(s)];
R.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
R.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
R.pad = n => String(n).padStart(2, '0');
R.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
R.debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
R.brl = n => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
R.num = v => { const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };

/* ---------- datas (sempre no fuso local; formato AAAA-MM-DD) ---------- */
R.iso = d => `${d.getFullYear()}-${R.pad(d.getMonth() + 1)}-${R.pad(d.getDate())}`;
R.parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
R.today = () => R.iso(new Date());
R.addDays = (s, n) => { const d = R.parse(s); d.setDate(d.getDate() + n); return R.iso(d); };
R.addMonths = (s, n) => { const d = R.parse(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return R.iso(d); };
R.monthKey = s => s.slice(0, 7);
R.shiftMonth = (m, n) => R.monthKey(R.addMonths(m + '-01', n));
R.startOfWeek = s => { const d = R.parse(s); d.setDate(d.getDate() - d.getDay()); return R.iso(d); };
R.daysBetween = (a, b) => Math.round((R.parse(b) - R.parse(a)) / 864e5);
R.MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
R.WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
R.WDL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
R.fmtDate = s => { if (!s) return ''; const t = R.today(), d = R.daysBetween(t, s); if (d === 0) return 'Hoje'; if (d === 1) return 'Amanhã'; if (d === -1) return 'Ontem'; const dt = R.parse(s); return `${R.WD[dt.getDay()]}, ${R.pad(dt.getDate())}/${R.pad(dt.getMonth() + 1)}`; };
R.fmtShort = s => s ? s.split('-').reverse().slice(0, 2).join('/') : '';
R.hm = m => `${R.pad(Math.floor(m / 60))}:${R.pad(m % 60)}`;
R.toMin = t => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
R.dur = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? R.pad(m % 60) : ''}` : `${m}min`;

/* ---------- captura em linguagem natural ---------- */
// Entende: hoje/amanhã/depois de amanhã, dias da semana, "dia 15", 15/10, "em 3 dias", "próxima semana",
// "às 14h"/"14:30", duração (30min, 1h), !alta/!media/!baixa/!1-3, #tag, @contexto, +projeto, "todo dia/semana/mês".
R.parseQuick = (text, defaults = {}) => {
  const out = Object.assign({ title: '', due: '', time: '', dur: 0, prio: 0, tags: [], contexts: [], projectName: '', repeat: '' }, defaults);
  let s = ' ' + text.trim() + ' ';
  const take = (re, fn) => { const m = s.match(re); if (m) { s = s.replace(re, ' '); fn(m); } };
  take(/\s!(alta|1)\b/i, () => out.prio = 1); take(/\s!(m[eé]dia|2)\b/i, () => out.prio = 2); take(/\s!(baixa|3)\b/i, () => out.prio = 3);
  while (true) { const m = s.match(/\s#([\p{L}\p{N}_-]+)/u); if (!m) break; out.tags.push(m[1]); s = s.replace(m[0], ' '); }
  while (true) { const m = s.match(/\s@([\p{L}\p{N}_-]+)/u); if (!m) break; out.contexts.push(m[1].toLowerCase()); s = s.replace(m[0], ' '); }
  take(/\s\+([\p{L}\p{N}_-]+)/u, m => out.projectName = m[1]);
  take(/\s(?:todo dia|diariamente)\b/i, () => out.repeat = 'daily'); take(/\s(?:toda semana|semanalmente)\b/i, () => out.repeat = 'weekly');
  take(/\s(?:todo m[eê]s|mensalmente)\b/i, () => out.repeat = 'monthly'); take(/\s(?:todo ano|anualmente)\b/i, () => out.repeat = 'yearly');
  take(/\s(?:[àa]s\s+)?(\d{1,2})(?::|h)(\d{2})?\s*(?:h|hs)?\b(?!\/)/i, m => { const h = +m[1]; if (h < 24) out.time = `${R.pad(h)}:${R.pad(+(m[2] || 0))}`; else s += m[0]; });
  take(/\s(\d+)\s*(min|m|h|hr|horas?)\b/i, m => out.dur = /^h/i.test(m[2]) ? +m[1] * 60 : +m[1]);
  const t = R.today();
  // atenção: \b do JS não reconhece "ã" como letra; por isso o lookahead (?=\s) em "amanhã".
  take(/\sdepois de amanh[ãa](?=\s)/i, () => out.due = R.addDays(t, 2)); take(/\samanh[ãa](?=\s)/i, () => out.due = R.addDays(t, 1)); take(/\shoje\b/i, () => out.due = t);
  take(/\sem\s+(\d+)\s+dias?\b/i, m => out.due = R.addDays(t, +m[1])); take(/\s(?:pr[óo]xima semana|semana que vem)\b/i, () => out.due = R.addDays(R.startOfWeek(t), 8));
  take(/\s(?:pr[óo]ximo m[eê]s|m[eê]s que vem)\b/i, () => out.due = R.addMonths(t, 1).slice(0, 8) + '01');
  take(/\s(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, m => { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear(); out.due = `${y}-${R.pad(+m[2])}-${R.pad(+m[1])}`; if (!m[3] && out.due < t) out.due = `${y + 1}-${R.pad(+m[2])}-${R.pad(+m[1])}`; });
  take(/\sdia\s+(\d{1,2})\b/i, m => { let d = R.parse(t); const day = +m[1]; if (d.getDate() >= day) d.setMonth(d.getMonth() + 1); d.setDate(day); out.due = R.iso(d); });
  take(/\s(dom|seg|ter|qua|qui|sex|s[áa]b)(?:unda|a|rta|inta|ado|ingo)?(?:-feira)?\b/i, m => { const k = m[1].toLowerCase().replace('á', 'a'); const idx = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].indexOf(k); let d = R.parse(t); do { d.setDate(d.getDate() + 1); } while (d.getDay() !== idx); out.due = R.iso(d); });
  out.title = s.replace(/\s+/g, ' ').trim();
  if (out.time && !out.due) out.due = t;
  return out;
};

/* ---------- UI: modais, toasts, confirmação ---------- */
R.toast = (msg, action, ms = 5000) => {
  const box = R.$('#toasts'), el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = `<span>${R.esc(msg)}</span>${action ? `<button>${R.esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { action.fn(); el.remove(); };
  box.appendChild(el); setTimeout(() => el.remove(), ms);
};
R.modal = (html, { wide = false } = {}) => {
  const d = R.$('#dlg'); d.className = wide ? 'wide' : ''; d.innerHTML = html; if (!d.open) d.showModal(); return d;
};
R.closeModal = () => { const d = R.$('#dlg'); if (d.open) d.close(); };
R.confirm = (msg, label = 'Confirmar') => new Promise(res => {
  const d = R.modal(`<p>${R.esc(msg)}</p><div class="actions"><button id="cNo">Cancelar</button><button class="pri danger" id="cYes">${R.esc(label)}</button></div>`);
  R.$('#cYes').onclick = () => { d.close(); res(true); }; R.$('#cNo').onclick = () => { d.close(); res(false); }; d.onclose = () => res(false);
});
R.download = (name, text, type = 'application/json') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
R.readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(f); });

/* ---------- gráficos simples em canvas ---------- */
R.chartBars = (cv, labels, series, colors) => {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 600, h = cv.clientHeight || 230; cv.width = w * dpr; cv.height = h * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, h);
  const cs = getComputedStyle(document.documentElement), max = Math.max(1, ...series.flat()), base = h - 26, bw = w / labels.length;
  c.font = '12px sans-serif'; c.textAlign = 'center';
  labels.forEach((l, i) => {
    const n = series.length, gw = Math.min(26, bw / (n + 1));
    series.forEach((s, j) => { const bh = s[i] / max * (base - 14), x = i * bw + bw / 2 - (n * gw) / 2 + j * gw; c.fillStyle = colors[j]; c.beginPath(); c.roundRect(x, base - bh, gw - 3, bh, 4); c.fill(); });
    c.fillStyle = cs.getPropertyValue('--muted'); c.fillText(l, i * bw + bw / 2, h - 8);
  });
};
R.chartLine = (cv, labels, values, color) => {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 600, h = cv.clientHeight || 230; cv.width = w * dpr; cv.height = h * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, h);
  const cs = getComputedStyle(document.documentElement), min = Math.min(0, ...values), max = Math.max(1, ...values), base = h - 26, top = 12, px = i => 20 + i * (w - 40) / Math.max(1, values.length - 1), py = v => base - (v - min) / (max - min || 1) * (base - top);
  c.strokeStyle = cs.getPropertyValue('--line'); c.beginPath(); c.moveTo(0, py(0)); c.lineTo(w, py(0)); c.stroke();
  c.strokeStyle = color; c.lineWidth = 2.4; c.beginPath(); values.forEach((v, i) => i ? c.lineTo(px(i), py(v)) : c.moveTo(px(i), py(v))); c.stroke();
  c.fillStyle = color + '22'; c.lineTo(px(values.length - 1), py(0)); c.lineTo(px(0), py(0)); c.fill();
  c.fillStyle = cs.getPropertyValue('--muted'); c.font = '12px sans-serif'; c.textAlign = 'center';
  labels.forEach((l, i) => { if (values.length < 14 || i % Math.ceil(values.length / 10) === 0) c.fillText(l, px(i), h - 8); });
};
R.chartDonut = (cv, items) => {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 300, h = cv.clientHeight || 230; cv.width = w * dpr; cv.height = h * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, h);
  const tot = items.reduce((s, i) => s + i.v, 0) || 1, cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 8; let a = -Math.PI / 2;
  items.forEach(it => { const da = it.v / tot * Math.PI * 2; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, a, a + da); c.closePath(); c.fillStyle = it.c; c.fill(); a += da; });
  c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(cx, cy, r * .58, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
};
R.PALETTE = ['#0e9f8c', '#f2a33a', '#3b82c4', '#d64545', '#8a63d2', '#2e9e5b', '#e0709a', '#6b7a8c', '#c9a227', '#2aa9c9'];
