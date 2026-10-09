import { projetos, categorias, linguagens } from './projetos.js';
import { icones } from './icones.js';
import { previews } from './previews.js';

const $ = (s, r = document) => r.querySelector(s);
const reduzido = matchMedia('(prefers-reduced-motion: reduce)');
const estado = { cat: 'todos', langs: new Set() };

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
  const breve = p.status === 'em-breve' || !p.demo;
  const demo = breve
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
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
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
      if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.7,.2,1)' });
    } else {
      el.animate([{ opacity: 0, transform: 'translateY(16px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' });
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
