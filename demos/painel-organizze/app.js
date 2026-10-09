// Painel Organizze: gráficos SVG feitos à mão, sem bibliotecas.
const NS_SVG = 'http://www.w3.org/2000/svg';
const $ = (sel) => document.querySelector(sel);

// ---------- DOM ----------
function aplicar(el, attrs) {
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}
function anexar(el, filhos) {
  for (const f of filhos.flat()) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}
const h = (tag, attrs, ...filhos) => {
  const el = document.createElement(tag);
  aplicar(el, attrs);
  return anexar(el, filhos);
};
const s = (tag, attrs, ...filhos) => {
  const el = document.createElementNS(NS_SVG, tag);
  aplicar(el, attrs);
  return anexar(el, filhos);
};

const ICONES = {
  esquerda: 'M15 6l-6 6 6 6',
  direita: 'M9 6l6 6-6 6',
  sol: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  lua: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
  conta: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  fatura: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 10h18M7 15h4',
  cima: 'M12 19V5M6 11l6-6 6 6',
  baixo: 'M12 5v14M6 13l6 6 6-6',
  igual: 'M5 12h14',
};
function icone(nome) {
  return s('svg', { class: 'icone', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, s('path', { d: ICONES[nome] }));
}

// ---------- Formatação ----------
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompacto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const reais = (c) => brl.format(c / 100);
const compacto = (c) => brlCompacto.format(c / 100);
const pct = (n) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

const partes = (mes) => mes.split('-').map(Number);
const nomeMes = (mes) => {
  const [a, m] = partes(mes);
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
const mesCurto = (mes) => {
  const [a, m] = partes(mes);
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};
const diasNoMes = (mes) => {
  const [a, m] = partes(mes);
  return new Date(a, m, 0).getDate();
};
const addMes = (mes, n) => {
  const [a, m] = partes(mes);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const dataBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
function relativo(iso, hoje) {
  const dias = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias`;
}
function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- Escala ----------
function escala(max) {
  if (max <= 0) max = 10000;
  const bruto = max / 4;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / mag;
  const passo = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const qtd = Math.ceil(max / passo);
  return { max: passo * qtd, ticks: Array.from({ length: qtd + 1 }, (_, i) => i * passo) };
}
const barraTopo = (x, y, w, hh, r) => {
  r = Math.min(r, w / 2, hh);
  return `M${x},${y + hh}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hh}Z`;
};
const barraDireita = (x, y, w, hh, r) => {
  r = Math.min(r, hh / 2, w);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hh - r}Q${x + w},${y + hh} ${x + w - r},${y + hh}H${x}Z`;
};

// ---------- Tooltip ----------
const tip = $('#tooltip');
function mostrarTip({ titulo, linhas = [], rodape }, x, y) {
  tip.replaceChildren(
    h('div', { class: 'tip-titulo' }, titulo),
    ...linhas.map((l) =>
      h('div', { class: 'tip-linha' }, h('span', { class: `tip-chave ${l.chave}` }), h('span', { class: 'rotulo' }, l.rotulo), h('span', { class: 'valor' }, l.valor)),
    ),
    rodape ? h('div', { class: 'tip-rodape' }, rodape) : null,
  );
  tip.hidden = false;
  const w = tip.offsetWidth;
  const alt = tip.offsetHeight;
  let left = x + 14;
  if (left + w > window.innerWidth - 8) left = x - w - 14;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, Math.min(y - alt / 2, window.innerHeight - alt - 8))}px`;
}
const esconderTip = () => {
  tip.hidden = true;
};
function centro(el) {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

// ---------- Estado ----------
const estado = { mes: null, dados: null, tabelas: new Set(), token: 0 };
// Demo estática: o índice diz qual é o mês atual e quais meses existem (api/painel-AAAA-MM.json).
let indice = { atual: hojeLocal().slice(0, 7), meses: [] };
try {
  const r = await fetch('api/indice.json');
  if (r.ok) indice = await r.json();
} catch {
  // sem índice: usa o mês do navegador
}
const mesAtual = indice.atual;
const temMes = (m) => indice.meses.length === 0 || indice.meses.includes(m);
estado.mes = mesAtual;

// ---------- Gráfico 1: Receitas × Despesas ----------
function graficoMeses(cont, dados, mesSel, aoSelecionar) {
  const W = cont.clientWidth;
  if (!W) return;
  const H = 260;
  const m = { t: 12, r: 8, b: 30, l: 56 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const maxV = Math.max(...dados.map((d) => Math.max(d.receitas, d.despesas)), 0);
  const esc = escala(maxV);
  const y = (v) => m.t + ph - (v / esc.max) * ph;
  const banda = pw / dados.length;
  const bw = Math.max(6, Math.min(24, (banda * 0.7 - 2) / 2));

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'group', 'aria-label': 'Gráfico de barras agrupadas: receitas e despesas dos últimos 6 meses. Há uma tabela equivalente.' });
  for (const t of esc.ticks) {
    svg.append(s('line', { class: t === 0 ? 'eixo-linha' : 'grade-linha', x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }));
    svg.append(s('text', { class: 'mudo', x: m.l - 8, y: y(t) + 4, 'text-anchor': 'end' }, t === 0 ? '0' : compacto(t)));
  }
  dados.forEach((d, i) => {
    const cx = m.l + banda * i + banda / 2;
    const sel = d.mes === mesSel;
    const g = s('g', { class: 'mes-g' });
    if (sel) svg.append(s('rect', { class: 'faixa-sel', x: cx - banda / 2 + 2, y: m.t, width: banda - 4, height: ph, rx: 8 }));
    const barras = [
      ['f-rec', d.receitas, cx - bw - 1],
      ['f-desp', d.despesas, cx + 1],
    ];
    for (const [cls, v, x] of barras) {
      const alt = (v / esc.max) * ph;
      if (alt > 0) g.append(s('path', { class: cls, d: barraTopo(x, y(v), bw, alt, 4) }));
    }
    svg.append(g);
    svg.append(s('text', { class: sel ? 'forte' : '', x: cx, y: H - 10, 'text-anchor': 'middle' }, mesCurto(d.mes)));

    const saldo = d.receitas - d.despesas;
    const conteudo = () => ({
      titulo: nomeMes(d.mes),
      linhas: [
        { chave: 'rec', rotulo: 'Receitas', valor: reais(d.receitas) },
        { chave: 'desp', rotulo: 'Despesas', valor: reais(d.despesas) },
      ],
      rodape: `Saldo: ${saldo < 0 ? '−' : ''}${reais(Math.abs(saldo))}`,
    });
    const ativar = (x, yy) => {
      svg.classList.add('tem-hover');
      g.classList.add('ativo');
      mostrarTip(conteudo(), x, yy);
    };
    const desativar = () => {
      svg.classList.remove('tem-hover');
      g.classList.remove('ativo');
      esconderTip();
    };
    const alvo = s('rect', {
      class: 'alvo', x: cx - banda / 2, y: m.t, width: banda, height: ph + 20, tabindex: '0', role: 'button',
      'aria-label': `${nomeMes(d.mes)}: receitas ${reais(d.receitas)}, despesas ${reais(d.despesas)}, saldo ${saldo < 0 ? 'negativo de ' : ''}${reais(Math.abs(saldo))}. Pressione Enter para selecionar este mês.`,
      onpointermove: (e) => ativar(e.clientX, e.clientY),
      onpointerleave: desativar,
      onfocus: (e) => ativar(...centro(e.target)),
      onblur: desativar,
      onclick: () => aoSelecionar(d.mes),
      onkeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          aoSelecionar(d.mes);
        }
      },
    });
    svg.append(alvo);
  });
  cont.replaceChildren(svg);
}

// ---------- Gráfico 2: Categorias ----------
function graficoCategorias(cont, cats) {
  const W = cont.clientWidth;
  if (!W) return;
  if (!cats.length) {
    cont.replaceChildren(h('p', { class: 'vazio' }, 'Sem despesas neste mês.'));
    return;
  }
  const linhaH = 36;
  const barH = 14;
  const H = cats.length * linhaH + 4;
  const estreito = W < 420;
  const rotW = Math.min(estreito ? 92 : 130, W * 0.32);
  const valW = estreito ? 96 : 150;
  const x0 = rotW + 8;
  const maxBarra = Math.max(20, W - x0 - valW - 8);
  const maxV = Math.max(...cats.map((c) => c.valor), 1);
  const maxChars = Math.floor(rotW / 6.6);
  const cortar = (t) => (t.length > maxChars ? `${t.slice(0, maxChars - 1)}…` : t);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'group', 'aria-label': 'Gráfico de barras horizontais: despesas por categoria no mês. Há uma tabela equivalente.' });
  svg.append(s('line', { class: 'eixo-linha', x1: x0, x2: x0, y1: 0, y2: H }));
  cats.forEach((c, i) => {
    const yy = i * linhaH + (linhaH - barH) / 2 + 2;
    const w = Math.max(2, (c.valor / maxV) * maxBarra);
    const g = s('g', { class: 'linha-g' });
    g.append(s('text', { x: rotW, y: yy + barH - 2, 'text-anchor': 'end' }, cortar(c.nome)));
    g.append(s('path', { class: c.id == null ? 'f-neutro' : 'f-desp', d: barraDireita(x0, yy, w, barH, 4) }));
    g.append(s('text', { class: 'forte', x: x0 + w + 8, y: yy + barH - 2 }, `${compacto(c.valor)} · ${pct(c.pct)}`));
    svg.append(g);
    const conteudo = () => ({
      titulo: c.nome,
      linhas: [{ chave: c.id == null ? 'neutro' : 'desp', rotulo: 'Gasto', valor: reais(c.valor) }],
      rodape: `${pct(c.pct)} das despesas do mês`,
    });
    const ativar = (x, yv) => {
      svg.classList.add('tem-hover');
      g.classList.add('ativo');
      mostrarTip(conteudo(), x, yv);
    };
    const desativar = () => {
      svg.classList.remove('tem-hover');
      g.classList.remove('ativo');
      esconderTip();
    };
    svg.append(
      s('rect', {
        class: 'alvo', x: 0, y: i * linhaH, width: W, height: linhaH, tabindex: '0', role: 'img',
        'aria-label': `${c.nome}: ${reais(c.valor)}, ${pct(c.pct)} das despesas`,
        onpointermove: (e) => ativar(e.clientX, e.clientY),
        onpointerleave: desativar,
        onfocus: (e) => ativar(...centro(e.target)),
        onblur: desativar,
      }),
    );
  });
  cont.replaceChildren(svg);
}

// ---------- Gráfico 3: Acumulado ----------
function graficoAcumulado(cont, ac, mes) {
  const W = cont.clientWidth;
  if (!W) return;
  const H = 280;
  const m = { t: 16, r: 14, b: 30, l: 56 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const n = Math.max(diasNoMes(mes), ac.anterior.length, 2);
  const todos = [...ac.atual, ...ac.anterior].map((p) => p.valor);
  const esc = escala(Math.max(...todos, 0));
  const x = (d) => m.l + ((d - 1) / (n - 1)) * pw;
  const y = (v) => m.t + ph - (v / esc.max) * ph;
  const caminho = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.dia).toFixed(1)},${y(p.valor).toFixed(1)}`).join('');

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'group', 'aria-label': 'Gráfico de linhas: gasto acumulado dia a dia, este mês comparado ao mês anterior. Há uma tabela equivalente.' });
  for (const t of esc.ticks) {
    svg.append(s('line', { class: t === 0 ? 'eixo-linha' : 'grade-linha', x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }));
    svg.append(s('text', { class: 'mudo', x: m.l - 8, y: y(t) + 4, 'text-anchor': 'end' }, t === 0 ? '0' : compacto(t)));
  }
  const marcas = W < 420 ? [1, 10, 20, n] : [1, 5, 10, 15, 20, 25, n];
  for (const d of [...new Set(marcas)].filter((d) => d <= n)) {
    svg.append(s('text', { class: 'mudo', x: x(d), y: H - 10, 'text-anchor': 'middle' }, String(d)));
  }
  if (ac.anterior.length) svg.append(s('path', { class: 'l-ant', d: caminho(ac.anterior) }));
  if (ac.atual.length) svg.append(s('path', { class: 'l-desp', d: caminho(ac.atual) }));

  // Ponto final do mês atual com rótulo direto
  const ult = ac.atual[ac.atual.length - 1];
  if (ult) {
    svg.append(s('circle', { class: 'ponto p-desp', cx: x(ult.dia), cy: y(ult.valor), r: 5 }));
    const aEsq = x(ult.dia) > W * 0.6;
    svg.append(
      s('text', { class: 'forte', x: x(ult.dia) + (aEsq ? -10 : 10), y: y(ult.valor) - 10, 'text-anchor': aEsq ? 'end' : 'start' }, compacto(ult.valor)),
    );
  }

  // Mira vertical + pontos
  const mira = s('line', { class: 'mira', y1: m.t, y2: m.t + ph, visibility: 'hidden' });
  const pA = s('circle', { class: 'ponto p-desp', r: 5, visibility: 'hidden' });
  const pB = s('circle', { class: 'ponto p-ant', r: 5, visibility: 'hidden' });
  svg.append(mira, pB, pA);

  let diaTeclado = ult ? ult.dia : 1;
  const mostrar = (d, cx, cy) => {
    const a = ac.atual[d - 1];
    const b = ac.anterior[d - 1];
    mira.setAttribute('x1', x(d));
    mira.setAttribute('x2', x(d));
    mira.setAttribute('visibility', 'visible');
    pA.setAttribute('visibility', a ? 'visible' : 'hidden');
    pB.setAttribute('visibility', b ? 'visible' : 'hidden');
    if (a) { pA.setAttribute('cx', x(d)); pA.setAttribute('cy', y(a.valor)); }
    if (b) { pB.setAttribute('cx', x(d)); pB.setAttribute('cy', y(b.valor)); }
    let rodape;
    if (a && b) {
      const dif = a.valor - b.valor;
      rodape = dif === 0 ? 'Igual ao mês anterior' : `${reais(Math.abs(dif))} ${dif > 0 ? 'a mais' : 'a menos'} que o mês anterior`;
    }
    mostrarTip(
      {
        titulo: `Dia ${d}`,
        linhas: [
          { chave: 'desp', rotulo: nomeMes(mes), valor: a ? reais(a.valor) : '—' },
          { chave: 'ant', rotulo: nomeMes(addMes(mes, -1)), valor: b ? reais(b.valor) : '—' },
        ],
        rodape,
      },
      cx,
      cy,
    );
  };
  const esconder = () => {
    mira.setAttribute('visibility', 'hidden');
    pA.setAttribute('visibility', 'hidden');
    pB.setAttribute('visibility', 'hidden');
    esconderTip();
  };
  const diaDoPonteiro = (e, alvo) => {
    const r = alvo.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    return Math.min(n, Math.max(1, Math.round(((px - m.l) / pw) * (n - 1)) + 1));
  };
  svg.append(
    s('rect', {
      class: 'alvo cruz', x: m.l, y: m.t, width: pw, height: ph, tabindex: '0', role: 'group', 'data-teclas': '1',
      'aria-label': 'Área do gráfico de linhas. Use as setas para a esquerda e a direita para percorrer os dias.',
      onpointermove: (e) => mostrar(diaDoPonteiro(e, e.currentTarget), e.clientX, e.clientY),
      onpointerleave: esconder,
      onfocus: (e) => {
        const [cx, cy] = centro(e.target);
        mostrar(diaTeclado, cx, cy);
      },
      onblur: esconder,
      onkeydown: (e) => {
        const passo = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        if (e.key === 'Escape') return esconder();
        if (!passo) return;
        e.preventDefault();
        diaTeclado = Math.min(n, Math.max(1, diaTeclado + passo));
        const r = e.currentTarget.getBoundingClientRect();
        mostrar(diaTeclado, r.left + ((x(diaTeclado) - m.l) / pw) * r.width, r.top + r.height / 2);
      },
    }),
  );
  cont.replaceChildren(svg);
}

// ---------- Tabelas ----------
function tabela(colunas, linhas, legenda) {
  return h(
    'div',
    { class: 'tabela-rol' },
    h(
      'table',
      null,
      h('caption', { class: 'so-leitor' }, legenda),
      h('thead', null, h('tr', null, ...colunas.map((c) => h('th', { scope: 'col', class: c.num ? 'num' : '' }, c.nome)))),
      h('tbody', null, ...linhas.map((l) => h('tr', null, ...l.map((v, i) => h('td', { class: colunas[i].num ? 'num' : '' }, v))))),
    ),
  );
}
const moeda = (c) => `${c < 0 ? '−' : ''}${reais(Math.abs(c))}`;

function renderTabelas(d) {
  const alvo = (id) => $(`#${id} .vista-tabela`);
  alvo('card-meses').replaceChildren(
    tabela(
      [{ nome: 'Mês' }, { nome: 'Receitas', num: 1 }, { nome: 'Despesas', num: 1 }, { nome: 'Saldo', num: 1 }],
      d.meses.map((x) => [nomeMes(x.mes), reais(x.receitas), reais(x.despesas), moeda(x.receitas - x.despesas)]),
      'Receitas e despesas dos últimos 6 meses',
    ),
  );
  alvo('card-categorias').replaceChildren(
    tabela(
      [{ nome: 'Categoria' }, { nome: 'Valor', num: 1 }, { nome: '% do total', num: 1 }],
      d.categorias.map((c) => [c.nome, reais(c.valor), pct(c.pct)]),
      'Despesas por categoria no mês',
    ),
  );
  const n = Math.max(d.acumulado.anterior.length, d.acumulado.atual.length);
  alvo('card-acumulado').replaceChildren(
    tabela(
      [{ nome: 'Dia', num: 1 }, { nome: 'Este mês', num: 1 }, { nome: 'Mês anterior', num: 1 }, { nome: 'Diferença', num: 1 }],
      Array.from({ length: n }, (_, i) => {
        const a = d.acumulado.atual[i];
        const b = d.acumulado.anterior[i];
        return [String(i + 1), a ? reais(a.valor) : '—', b ? reais(b.valor) : '—', a && b ? moeda(a.valor - b.valor) : '—'];
      }),
      'Gasto acumulado por dia, este mês e o anterior',
    ),
  );
}

// ---------- KPIs, contas, maiores ----------
function renderKpis(d) {
  const ajusta = (id, valor) => {
    const el = $(`#${id} .kpi-valor`);
    el.classList.remove('esqueleto');
    el.textContent = valor;
  };
  ajusta('kpi-receitas', reais(d.kpis.receitas));
  ajusta('kpi-despesas', reais(d.kpis.despesas));
  ajusta('kpi-resultado', moeda(d.kpis.resultado));
  ajusta('kpi-apagar', reais(d.kpis.aPagar30));
  const r = d.kpis.resultado;
  const ind = $('#kpi-resultado .indicador');
  ind.className = `indicador ${r > 0 ? 'bom' : r < 0 ? 'ruim' : ''}`;
  ind.replaceChildren(icone(r > 0 ? 'cima' : r < 0 ? 'baixo' : 'igual'), r > 0 ? 'Positivo: sobrou no mês' : r < 0 ? 'Negativo: gastou mais do que ganhou' : 'Zerado');
  const n = d.contas.length;
  $('#kpi-apagar .kpi-sub').textContent = n ? `${n} ${n === 1 ? 'conta ou fatura aberta' : 'contas e faturas abertas'}` : 'Nada em aberto';
}

function renderContas(d) {
  const cont = $('#contas');
  if (!d.contas.length) {
    cont.replaceChildren(h('p', { class: 'vazio' }, 'Nenhuma conta ou fatura nos próximos 30 dias.'));
    return;
  }
  cont.replaceChildren(
    h(
      'ul',
      { class: 'lista' },
      ...d.contas.map((c) =>
        h(
          'li',
          null,
          h('span', { class: 'ic', title: c.tipo === 'fatura' ? 'Fatura de cartão' : 'Conta' }, icone(c.tipo === 'fatura' ? 'fatura' : 'conta')),
          h('div', null, h('div', { class: 'desc' }, c.descricao), h('div', { class: 'quando' }, `${c.tipo === 'fatura' ? 'Fatura' : 'Conta'} · ${relativo(c.data, d.hoje)} (${dataBR(c.data)})`)),
          h('span', { class: 'valor' }, reais(c.valor)),
        ),
      ),
    ),
    h('div', { class: 'total' }, h('span', null, 'Total em 30 dias'), h('span', null, reais(d.kpis.aPagar30))),
  );
}

function renderMaiores(d) {
  const cont = $('#maiores');
  if (!d.maiores.length) {
    cont.replaceChildren(h('p', { class: 'vazio' }, 'Sem despesas neste mês.'));
    return;
  }
  cont.replaceChildren(
    h(
      'div',
      { class: 'tabela-rol' },
      h(
        'table',
        null,
        h('caption', { class: 'so-leitor' }, 'Maiores despesas do mês'),
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Data'), h('th', { scope: 'col' }, 'Descrição'), h('th', { scope: 'col', class: 'esconde-estreito' }, 'Categoria'), h('th', { scope: 'col', class: 'num' }, 'Valor'))),
        h(
          'tbody',
          null,
          ...d.maiores.map((x) =>
            h('tr', null, h('td', null, dataBR(x.data)), h('td', null, x.descricao, h('small', { class: 'so-estreito' }, x.categoria)), h('td', { class: 'esconde-estreito' }, x.categoria), h('td', { class: 'num' }, reais(x.valor))),
          ),
        ),
      ),
    ),
  );
}

// ---------- Orquestração ----------
function renderGraficos() {
  const d = estado.dados;
  if (!d) return;
  graficoMeses($('#g-meses'), d.meses, d.mes, selecionarMes);
  graficoCategorias($('#g-categorias'), d.categorias);
  graficoAcumulado($('#g-acumulado'), d.acumulado, d.mes);
}

function renderTudo() {
  const d = estado.dados;
  $('#mes-rotulo').textContent = nomeMes(d.mes);
  $('#selo-demo').hidden = !d.demo;
  $('#sub-cat').textContent = `Em ${nomeMes(d.mes)}`;
  $('#leg-atual').textContent = nomeMes(d.mes);
  $('#leg-ant').textContent = nomeMes(addMes(d.mes, -1));
  renderKpis(d);
  renderContas(d);
  renderMaiores(d);
  renderTabelas(d);
  renderGraficos();
}

function atualizarSeletor() {
  $('#mes-rotulo').textContent = nomeMes(estado.mes);
  $('#mes-proximo').disabled = estado.mes >= mesAtual;
  $('#mes-anterior').disabled = !temMes(addMes(estado.mes, -1));
}

let controle = null;
async function carregar() {
  const token = ++estado.token;
  controle?.abort();
  controle = new AbortController();
  const principal = $('#principal');
  principal.classList.add('recarregando');
  $('#erro').hidden = true;
  esconderTip();
  try {
    const resp = await fetch(`api/painel-${estado.mes}.json`, { signal: controle.signal });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error('Esta demonstração só tem dados fictícios dos últimos 12 meses.');
    if (token !== estado.token) return;
    estado.dados = json;
    renderTudo();
    $('#status').textContent = `Dados de ${nomeMes(estado.mes)} carregados.`;
  } catch (e) {
    if (e.name === 'AbortError' || token !== estado.token) return;
    $('#erro-msg').textContent = e.message;
    $('#erro').hidden = false;
  } finally {
    if (token === estado.token) principal.classList.remove('recarregando');
  }
}

function selecionarMes(mes) {
  if (mes > mesAtual || mes === estado.mes || !temMes(mes)) return;
  estado.mes = mes;
  atualizarSeletor();
  carregar();
}

// ---------- Tema ----------
function temaEfetivo() {
  return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function atualizarBotaoTema() {
  const escuro = temaEfetivo() === 'dark';
  const b = $('#tema');
  b.replaceChildren(icone(escuro ? 'sol' : 'lua'));
  b.setAttribute('aria-label', escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro');
  b.title = b.getAttribute('aria-label');
}

// ---------- Inicialização ----------
$('#mes-anterior').replaceChildren(icone('esquerda'));
$('#mes-proximo').replaceChildren(icone('direita'));
$('#mes-anterior').addEventListener('click', () => selecionarMes(addMes(estado.mes, -1)));
$('#mes-proximo').addEventListener('click', () => selecionarMes(addMes(estado.mes, 1)));
$('#erro-repetir').addEventListener('click', carregar);
$('#tema').addEventListener('click', () => {
  const novo = temaEfetivo() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = novo;
  try {
    localStorage.setItem('painel-tema', novo);
  } catch {
    // sem armazenamento: a escolha vale só nesta sessão
  }
  atualizarBotaoTema();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', atualizarBotaoTema);
atualizarBotaoTema();

document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.target.closest?.('[data-teclas], input, select, textarea')) return;
  if (e.key === 'ArrowLeft') selecionarMes(addMes(estado.mes, -1));
  else if (e.key === 'ArrowRight') selecionarMes(addMes(estado.mes, 1));
});

for (const botao of document.querySelectorAll('[data-alternar]')) {
  botao.addEventListener('click', () => {
    const card = document.getElementById(botao.dataset.alternar);
    const comoTabela = botao.getAttribute('aria-pressed') !== 'true';
    botao.setAttribute('aria-pressed', String(comoTabela));
    botao.textContent = comoTabela ? 'Ver como gráfico' : 'Ver como tabela';
    card.querySelector('.vista-grafico').hidden = comoTabela;
    card.querySelector('.vista-tabela').hidden = !comoTabela;
    esconderTip();
    if (!comoTabela) renderGraficos();
  });
}

let quadro = 0;
const observador = new ResizeObserver(() => {
  cancelAnimationFrame(quadro);
  quadro = requestAnimationFrame(renderGraficos);
});
for (const el of document.querySelectorAll('.grafico')) observador.observe(el);
window.addEventListener('scroll', esconderTip, { passive: true });

atualizarSeletor();
carregar();
