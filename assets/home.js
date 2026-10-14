import { projetos, categorias, linguagens } from './projetos.js';
import { icones } from './icones.js';
import { previews } from './previews.js';
import { emConstrucao, statusConstrucao, ETAPAS } from './construcao.js';

const $ = (s, r = document) => r.querySelector(s);
const reduzido = matchMedia('(prefers-reduced-motion: reduce)');
const estado = { cat: 'todos', langs: new Set() };
const MOLA = 'cubic-bezier(.34,1.56,.64,1)';

const COR_LANG = { JavaScript: '#f7df1e', Python: '#4b8bbe', Java: '#e76f51' };

// ---------- tema ----------
function temaAtual() {
  return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
}
function pintarBotaoTema() {
  const b = $('#tema');
  const escuro = temaAtual() === 'dark';
  b.innerHTML = escuro ? icones.sol : icones.lua;
  const rotulo = escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';
  b.setAttribute('aria-label', rotulo);
  b.title = rotulo;
}
$('#tema').addEventListener('click', () => {
  const novo = temaAtual() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = novo;
  try { localStorage.setItem('vitrine-tema', novo); } catch { /* sem armazenamento */ }
  pintarBotaoTema();
});
matchMedia('(prefers-color-scheme: light)').addEventListener('change', pintarBotaoTema);
pintarBotaoTema();

// ---------- cards ----------
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function criarCard(p) {
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.id = p.id;
  const semDemo = !p.demo && p.status !== 'em-breve';
  const breve = p.status === 'em-breve' || (!p.demo && !p.site && !p.codigo);
  const demo = semDemo && (p.site || p.codigo)
    ? `<a class="btn primario" href="${esc(p.site || p.codigo)}" target="_blank" rel="noopener">${icones.site} ${p.site ? 'Abrir site' : 'Ver no GitHub'}<span class="so-leitor"> de ${esc(p.nome)}</span></a>`
    : breve
    ? '<span class="btn" aria-disabled="true" title="Demo em breve">Em breve</span>'
    : `<a class="btn primario" href="${esc(p.demo)}">${icones.play} Abrir demo<span class="so-leitor"> de ${esc(p.nome)}</span></a>`;
  el.innerHTML = `
    <div class="card-preview" aria-hidden="true">${previews[p.preview] ?? ''}</div>
    <div class="card-corpo">
      <div class="card-cab">
        <span class="icone">${icones[p.icone] ?? ''}</span>
        <h3>${esc(p.nome)}</h3>
        ${breve ? '<span class="selo-breve">em breve</span>' : ''}
      </div>
      <p class="desc">${esc(p.descricao)}</p>
      <ul class="tags" aria-label="Tecnologias">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <div class="acoes">
        ${demo}
        ${p.codigo ? `<a class="btn" href="${esc(p.codigo)}" target="_blank" rel="noopener">${icones.codigo} Código<span class="so-leitor"> de ${esc(p.nome)} no GitHub</span></a>` : ''}
        ${p.site ? `<a class="btn" href="${esc(p.site)}" target="_blank" rel="noopener">${icones.site} Site<span class="so-leitor"> oficial de ${esc(p.nome)}</span></a>` : ''}
      </div>
    </div>`;
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    el.style.setProperty('--mx', `${mx}px`);
    el.style.setProperty('--my', `${my}px`);
    if (!reduzido.matches) {
      const px = mx / r.width - 0.5;
      const py = my / r.height - 0.5;
      el.style.setProperty('--rx', `${(py * -6).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(px * 8).toFixed(2)}deg`);
    }
  });
  el.addEventListener('pointerleave', () => {
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  });
  return el;
}

const grade = $('#grade');
const cards = new Map(projetos.map((p) => [p.id, criarCard(p)]));
for (const el of cards.values()) grade.append(el);

// ---------- filtros ----------
function casa(p) {
  const okCat = estado.cat === 'todos' || p.categorias.includes(estado.cat);
  const okLang = estado.langs.size === 0 || p.linguagens.some((l) => estado.langs.has(l));
  return okCat && okLang;
}

function aplicar(animar) {
  const todos = [...cards.values()];
  const antes = new Map(todos.map((el) => [el, el.hidden ? null : el.getBoundingClientRect()]));
  let visiveis = 0;
  for (const p of projetos) {
    const el = cards.get(p.id);
    const mostrar = casa(p);
    el.hidden = !mostrar;
    if (mostrar) visiveis++;
  }
  $('#vazio').hidden = visiveis > 0;
  const total = projetos.length;
  $('#contagem').textContent = visiveis === total ? `${total} projetos` : `${visiveis} de ${total} projetos`;

  if (!animar || reduzido.matches || !grade.animate) return;
  for (const el of todos) {
    if (el.hidden) continue;
    const a = antes.get(el);
    const d = el.getBoundingClientRect();
    if (a) {
      const dx = a.left - d.left;
      const dy = a.top - d.top;
      if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 300, easing: MOLA });
    } else {
      el.animate([{ opacity: 0, transform: 'translateY(14px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: MOLA });
    }
  }
}

const abas = $('#abas');
for (const c of categorias) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'aba';
  b.dataset.cat = c.id;
  b.textContent = c.nome;
  b.setAttribute('aria-pressed', String(c.id === estado.cat));
  b.addEventListener('click', () => {
    estado.cat = c.id;
    for (const x of abas.children) x.setAttribute('aria-pressed', String(x.dataset.cat === c.id));
    aplicar(true);
  });
  abas.append(b);
}

const chips = $('#chips-lang');
for (const l of linguagens) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.setAttribute('aria-pressed', 'false');
  b.style.setProperty('--c', COR_LANG[l] ?? 'var(--destaque)');
  b.innerHTML = `<span class="pt" aria-hidden="true"></span>${l}`;
  b.addEventListener('click', () => {
    if (estado.langs.has(l)) estado.langs.delete(l); else estado.langs.add(l);
    b.setAttribute('aria-pressed', String(estado.langs.has(l)));
    aplicar(true);
  });
  chips.append(b);
}

$('#ico-gh').innerHTML = icones.github;
$('#ano').textContent = new Date().getFullYear();
aplicar(false);

// ---------- em construção ----------
const estadoCC = { status: 'todos' };

function contagemRegressivaBarra(el, alvo, duracaoMs) {
  if (reduzido.matches) {
    el.style.setProperty('--w', `${alvo}%`);
    el.textContent = `${alvo}%`;
    return;
  }
  const num = el;
  const barra = num.closest('.cc-fase').querySelector('.cc-barra > i');
  const inicio = performance.now();
  function passo(agora) {
    const t = Math.min(1, (agora - inicio) / duracaoMs);
    const facil = 1 - (1 - t) ** 3;
    const valor = Math.round(alvo * facil);
    num.textContent = `${valor}%`;
    barra.style.width = `${valor}%`;
    if (t < 1) requestAnimationFrame(passo);
  }
  requestAnimationFrame(passo);
}

function criarCardConstrucao(p) {
  const el = document.createElement('article');
  el.className = 'card cc-card';
  el.dataset.id = p.id;
  el.dataset.status = p.status;
  const st = statusConstrucao.find((s) => s.id === p.status);
  const pct = Math.round((p.etapa / ETAPAS.length) * 100);
  const media = p.imagem
    ? `<img src="${esc(p.imagem)}" alt="${esc(p.alt || p.nome)}" loading="lazy">`
    : `<span class="cc-media-icone">${icones[p.icone] ?? ''}</span>`;
  const linkAcao = p.site
    ? `<a class="btn primario" href="${esc(p.site)}" target="_blank" rel="noopener">${icones.site} Ver mais<span class="so-leitor"> sobre ${esc(p.nome)}</span></a>`
    : `<span class="btn" aria-disabled="true">${icones.codigo} Código privado</span>`;
  el.innerHTML = `
    <div class="cc-media">${media}<span class="cc-selo cc-selo-${esc(p.status)}">${esc(st ? st.nome : p.status)}</span></div>
    <div class="card-corpo">
      <div class="card-cab">
        <span class="icone">${icones[p.icone] ?? ''}</span>
        <h3>${esc(p.nome)}${p.nota ? `<small class="cc-nota">${esc(p.nota)}</small>` : ''}</h3>
      </div>
      <p class="desc">${esc(p.descricao)}</p>
      <ul class="tags" aria-label="Tecnologias">${(p.tags || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <div class="cc-fase">
        <div class="cc-fase-topo"><span>${esc(p.fase)}</span><b class="cc-pct">0%</b></div>
        <div class="cc-barra"><i style="width:0%"></i></div>
      </div>
      <div class="acoes">${linkAcao}</div>
    </div>`;
  requestAnimationFrame(() => contagemRegressivaBarra(el.querySelector('.cc-pct'), pct, 900));
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    el.style.setProperty('--mx', `${mx}px`);
    el.style.setProperty('--my', `${my}px`);
    if (!reduzido.matches) {
      const px = mx / r.width - 0.5;
      const py = my / r.height - 0.5;
      el.style.setProperty('--rx', `${(py * -6).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(px * 8).toFixed(2)}deg`);
    }
  });
  el.addEventListener('pointerleave', () => {
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  });
  return el;
}

const gradeCC = $('#grade-cc');
const cardsCC = new Map(emConstrucao.map((p) => [p.id, criarCardConstrucao(p)]));
for (const el of cardsCC.values()) gradeCC.append(el);

function aplicarCC(animar) {
  const todos = [...cardsCC.values()];
  const antes = new Map(todos.map((el) => [el, el.hidden ? null : el.getBoundingClientRect()]));
  let visiveis = 0;
  for (const p of emConstrucao) {
    const el = cardsCC.get(p.id);
    const mostrar = estadoCC.status === 'todos' || p.status === estadoCC.status;
    el.hidden = !mostrar;
    if (mostrar) visiveis++;
  }
  const total = emConstrucao.length;
  $('#contagem-cc').textContent = visiveis === total ? `${total} projetos` : `${visiveis} de ${total} projetos`;

  if (!animar || reduzido.matches || !gradeCC.animate) return;
  for (const el of todos) {
    if (el.hidden) continue;
    const a = antes.get(el);
    const d = el.getBoundingClientRect();
    if (a) {
      const dx = a.left - d.left;
      const dy = a.top - d.top;
      if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 300, easing: MOLA });
    } else {
      el.animate([{ opacity: 0, transform: 'translateY(14px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: MOLA });
    }
  }
}

const abasCC = $('#abas-cc');
for (const s of statusConstrucao) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'aba';
  b.dataset.status = s.id;
  b.textContent = s.nome;
  b.setAttribute('aria-pressed', String(s.id === estadoCC.status));
  b.addEventListener('click', () => {
    estadoCC.status = s.id;
    for (const x of abasCC.children) x.setAttribute('aria-pressed', String(x.dataset.status === s.id));
    aplicarCC(true);
  });
  abasCC.append(b);
}
aplicarCC(false);

// ---------- entrada animada ao rolar ----------
if (!reduzido.matches && 'IntersectionObserver' in window) {
  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      entrada.target.animate(
        [{ opacity: 0, transform: 'translateY(20px) scale(.97)' }, { opacity: 1, transform: 'none' }],
        { duration: 300, easing: MOLA, fill: 'backwards' },
      );
      observador.unobserve(entrada.target);
    }
  }, { threshold: .18, rootMargin: '0px 0px -40px 0px' });
  for (const el of cards.values()) observador.observe(el);
  for (const el of cardsCC.values()) observador.observe(el);
}
