import { interpretar, paraTickTick } from './lib/interpretar.js';
import { hojeISO } from './lib/datas.js';

const $ = (s) => document.querySelector(s);
const hoje = hojeISO();
const REMETENTE = 'voce@gmail.com';
const LIMITE = 4000;

const EXEMPLOS = [
  'Fwd: Pagar boleto da luz #casa !alta @sexta',
  'Revisar proposta ^Trabalho @amanha @14h',
  'Ligar para o contador @9h30',
  'Renovar seguro @25/12',
  'Re: Reunião de pais #escola !m @seg',
  'Comprar presente @31/02',
];

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const PRIORIDADE = { 5: 'Prioridade alta', 3: 'Prioridade média', 1: 'Prioridade baixa', 0: 'Sem prioridade' };

const SVG_BANDEIRA = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3h2v18H5z"/><path d="M8 4h11l-2.5 4L19 12H8z"/></svg>';
const SVG_RELOGIO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
const SVG_LISTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>';

function dataBonita(iso, hora) {
  const [a, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  const base = `${DIAS[dow]}, ${d} de ${MESES[m - 1]}`;
  return hora ? `${base} · ${hora}` : base;
}

// Mesma regra do worker: sem citações (>), sem assinatura após "-- ", limitado.
function limparCorpo(texto) {
  const linhas = [];
  for (const l of texto.replace(/\r\n/g, '\n').split('\n')) {
    if (/^--\s?$/.test(l)) break;
    if (/^\s*>/.test(l)) continue;
    linhas.push(l);
  }
  return linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, LIMITE);
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// Realce do assunto: espelha a classificação do interpretador token a token.
function eco(assunto, r) {
  const texto = assunto.replace(/^\s*(?:(?:re|res|fw|fwd|enc|tr)\s*:\s*)+/i, '');
  const titulo = new Set(r.titulo.split(/\s+/));
  const partes = texto.split(/\s+/).filter(Boolean).map((t) => {
    const x = esc(t);
    if (t[0] === '#' && r.tags.includes(t.slice(1))) return `<span class="tk tag">${x}</span>`;
    if (t[0] === '!' && r.prioridade && t.length > 1) return `<span class="tk prio">${x}</span>`;
    if (t[0] === '^' && r.lista && t.length > 1) return `<span class="tk lista">${x}</span>`;
    if (t[0] === '@' && !titulo.has(t) && t.length > 1) return `<span class="tk data">${x}</span>`;
    return `<span class="tit">${x}</span>`;
  });
  return partes.join(' ') || '<span>Digite um assunto para ver a mágica.</span>';
}

function colorirJson(obj) {
  const j = JSON.stringify(obj, null, 2);
  return esc(j).replace(/("(?:[^"\\]|\\.)*")(\s*:)?|\b(\d+)\b|\b(true|false)\b/g, (m, s, dois, n, b) => {
    if (s) return dois ? `<span class="k">${s}</span>${dois}` : `<span class="s">${s}</span>`;
    return `<span class="n">${n ?? b}</span>`;
  });
}

function atualizar() {
  const assunto = $('#assunto').value;
  const r = interpretar(assunto, hoje);
  const descricaoBase = limparCorpo($('#corpo').value);
  let descricao = `${descricaoBase}${descricaoBase ? '\n\n' : ''}— Enviado por e-mail por ${REMETENTE} em ${hoje}`;
  const listaId = r.lista ? `id-da-lista-${r.lista.toLowerCase().normalize('NFD').replace(/[^\w ]/g, '').replace(/ +/g, '-')}` : undefined;
  const corpo = paraTickTick(r, { listaId, descricao });

  $('#eco').innerHTML = eco(assunto, r);
  $('#tarefa').dataset.prio = String(r.prioridade);
  $('#t-titulo').textContent = r.titulo;
  const prio = $('#t-prio');
  prio.innerHTML = SVG_BANDEIRA;
  prio.title = PRIORIDADE[r.prioridade];
  prio.setAttribute('role', 'img');
  prio.setAttribute('aria-label', PRIORIDADE[r.prioridade]);

  const data = $('#t-data');
  if (r.data) {
    data.className = 'meta-item data-ok';
    data.innerHTML = `${SVG_RELOGIO}<span>${dataBonita(r.data, r.hora)}</span>`;
  } else {
    data.className = 'meta-item';
    data.innerHTML = `${SVG_RELOGIO}<span>Sem data</span>`;
  }
  $('#t-lista').innerHTML = `${SVG_LISTA}<span>${esc(r.lista ?? 'Entrada')}</span>`;
  $('#t-tags').innerHTML = r.tags.map((t) => `<span class="chip-tag">#${esc(t)}</span>`).join('');
  $('#t-desc').textContent = descricao;
  $('#json').innerHTML = colorirJson(corpo);
}

const caixaExemplos = $('#exemplos');
for (const ex of EXEMPLOS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = ex;
  b.addEventListener('click', () => {
    $('#assunto').value = ex;
    atualizar();
    $('#assunto').focus();
  });
  caixaExemplos.append(b);
}

let timer;
$('#enviar').addEventListener('click', () => {
  const el = $('#criada');
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, 1600);
});
$('#assunto').addEventListener('input', atualizar);
$('#corpo').addEventListener('input', atualizar);

$('#assunto').value = EXEMPLOS[0];
atualizar();
