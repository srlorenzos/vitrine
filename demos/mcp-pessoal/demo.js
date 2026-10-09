const $ = (s) => document.querySelector(s);
const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esperar = (ms) => new Promise((r) => setTimeout(r, reduzido ? 0 : ms));
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// ---------- dados fictícios, relativos a hoje ----------
const p2 = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const somar = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; };
const br = (d) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
const hoje = new Date();
const extenso = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(hoje);
const proximaSexta = somar(hoje, ((5 - hoje.getDay() + 6) % 7) + 1);
const mes = iso(hoje).slice(0, 7);

function rodarAgenda() {
  const saida = [
    `# ${extenso}`,
    '',
    '## Agenda',
    '- dia inteiro: Aniversário da Marina',
    '- 09:30-09:45: Daily do time',
    '- 12:30-14:00: Almoço com cliente (Restaurante Dona Lúcia, Pinheiros)',
    '- 16:00-17:00: Revisão do roadmap',
    '',
    '## Tarefas atrasadas',
    `- Renovar certificado digital [alta] (${br(somar(hoje, -3))}, atrasada 3d) em Trabalho \`lst_7f3a/tsk_91c2\``,
    `- Enviar nota fiscal de setembro [média] (${br(somar(hoje, -1))}, atrasada 1d) em Financeiro \`lst_2b9d/tsk_4e07\``,
    '',
    '## Tarefas do dia',
    `- Responder proposta da agência [alta] (${br(hoje)} 11:00) em Trabalho \`lst_7f3a/tsk_a3d8\``,
    `- Comprar presente da Marina (${br(hoje)}) em Pessoal \`lst_c510/tsk_77b1\``,
    `- Marcar dentista [baixa] (${br(hoje)}) em Entrada \`lst_in01/tsk_0f6c\``,
    '',
    '## Contas (hoje e próximos 3 dias)',
    `- Internet: R$ 129,90 (${br(somar(hoje, 1))}, vence em 1d)`,
    `- Fatura Nubank: R$ 1.842,37 (${br(somar(hoje, 2))}, vence em 2d)`,
    `- Aluguel: R$ 2.200,00 (${br(somar(hoje, 3))}, vence em 3d)`,
  ].join('\n');
  return saida;
}

const CENAS = [
  {
    pergunta: 'O que tenho pra hoje?',
    ferramenta: 'agenda_do_dia',
    entrada: {},
    saida: rodarAgenda,
    resposta: () => `
      <p>Seu dia está cheio, mas administrável. Em ordem de horário:</p>
      <ul>
        <li><b>09:30</b> Daily do time, <b>12:30</b> almoço com cliente (Pinheiros) e <b>16:00</b> revisão do roadmap. O aniversário da Marina é hoje.</li>
        <li><b>Atrasadas:</b> renovar o certificado digital (3 dias, prioridade alta) e enviar a nota fiscal de setembro.</li>
        <li><b>Hoje:</b> responder a proposta da agência até as 11:00, comprar o presente da Marina e marcar o dentista.</li>
      </ul>
      <p>E atenção às contas: <b>R$ 4.172,27</b> vencem nos próximos 3 dias (internet, fatura do Nubank e aluguel). Quer que eu monte um plano por horário?</p>`,
  },
  {
    pergunta: 'Cria uma tarefa pra pagar o IPVA sexta, prioridade alta',
    ferramenta: 'criar_tarefa',
    entrada: () => ({ titulo: 'Pagar IPVA', data: iso(proximaSexta), prioridade: 'alta' }),
    saida: () => 'Tarefa criada: Pagar IPVA `lst_in01/tsk_b41e`',
    resposta: () => `
      <p>Pronto! Criei <b>“Pagar IPVA”</b> para <b>sexta, ${br(proximaSexta)}</b>, com prioridade <b>alta</b>, na sua Entrada do TickTick.</p>
      <p>Como a tarefa é uma conta, vale lembrar que o <code>contas_a_pagar</code> só mostra o que está lançado no Organizze. Se o IPVA ainda não estiver lá, posso te lembrar de lançá-lo.</p>`,
  },
  {
    pergunta: 'Como estão minhas finanças este mês?',
    ferramenta: 'resumo_financeiro',
    entrada: () => ({ mes }),
    saida: () => [
      `# Resumo de ${mes}`,
      '- Receitas: R$ 9.850,00',
      '- Despesas: R$ 6.312,45',
      '- Resultado: R$ 3.537,55',
      '',
      '## Maiores categorias de despesa',
      '- Moradia: R$ 2.200,00',
      '- Mercado: R$ 1.184,30',
      '- Transporte: R$ 742,15',
      '- Restaurantes: R$ 689,90',
      '- Saúde: R$ 411,20',
    ].join('\n'),
    resposta: () => `
      <p>O mês está <b>positivo</b>: entraram R$ 9.850,00, saíram R$ 6.312,45 e sobraram <b>R$ 3.537,55</b>, cerca de 36% da receita.</p>
      <ul>
        <li><b>Moradia</b> pesa mais: R$ 2.200,00, quase 35% das despesas.</li>
        <li><b>Mercado</b> (R$ 1.184,30) e <b>transporte</b> (R$ 742,15) vêm em seguida.</li>
        <li><b>Restaurantes</b> somam R$ 689,90, a categoria mais fácil de ajustar se quiser guardar mais.</li>
      </ul>`,
  },
];

const FERRAMENTAS = [
  ['agenda_do_dia', 'qualquer', 'Eventos do dia, tarefas atrasadas e do dia, contas dos próximos 3 dias'],
  ['listar_eventos', 'Google', 'Eventos entre duas datas (inicio, fim, calendarios?)'],
  ['criar_evento', 'Google', 'Cria evento (titulo, inicio, fim, descricao?)'],
  ['listar_tarefas', 'TickTick', 'Filtro atrasadas, hoje, semana, sem_data ou todas'],
  ['criar_tarefa', 'TickTick', 'titulo, data?, hora?, prioridade?, lista?, tags?, descricao?'],
  ['concluir_tarefa', 'TickTick', 'Conclui por tarefa_id e lista_id'],
  ['listar_listas', 'TickTick', 'Lista os projetos'],
  ['contas_a_pagar', 'Organizze', 'Contas não pagas e faturas em aberto (dias, padrão 7)'],
  ['resumo_financeiro', 'Organizze', 'Receitas, despesas, resultado e top categorias de um mês'],
];

const lista = $('#ferramentas');
for (const [nome, fonte, o] of FERRAMENTAS) {
  const li = document.createElement('li');
  li.innerHTML = `<code>${nome}</code><span class="fonte">${fonte}</span><span class="o-que">${esc(o)}</span>`;
  lista.append(li);
}

// ---------- animação ----------
const caixa = $('#mensagens');
const descer = () => { caixa.scrollTop = caixa.scrollHeight; };
let geracao = 0;
let ocupado = false;

function nosDeTexto(raiz) {
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const lista = [];
  while (w.nextNode()) lista.push(w.currentNode);
  return lista;
}

async function digitar(el, vez, ritmo = 14) {
  const nos = nosDeTexto(el);
  const originais = nos.map((n) => n.nodeValue);
  if (reduzido) return;
  nos.forEach((n) => { n.nodeValue = ''; });
  el.classList.add('cursor');
  for (let i = 0; i < nos.length; i++) {
    const t = originais[i];
    for (let c = 0; c < t.length; c += 3) {
      if (vez !== geracao) return;
      nos[i].nodeValue = t.slice(0, c + 3);
      descer();
      await esperar(ritmo);
    }
    nos[i].nodeValue = t;
  }
  el.classList.remove('cursor');
}

function bolhaUsuario() {
  const d = document.createElement('div');
  d.className = 'msg eu';
  caixa.append(d);
  return d;
}

function blocoIa() {
  const d = document.createElement('div');
  d.className = 'msg ia';
  d.innerHTML = '<div class="avatar" aria-hidden="true">C</div><div class="ia-corpo"></div>';
  caixa.append(d);
  return d.querySelector('.ia-corpo');
}

async function tocar(cena) {
  const vez = geracao;
  ocupado = true;
  document.querySelectorAll('.sug').forEach((b) => { b.disabled = true; });

  const u = bolhaUsuario();
  u.textContent = cena.pergunta;
  descer();
  await digitar(u, vez, 22);
  if (vez !== geracao) return;
  await esperar(350);

  const ia = blocoIa();
  ia.innerHTML = '<span class="digitando" aria-label="Claude está pensando"><i></i><i></i><i></i></span>';
  descer();
  await esperar(900);
  if (vez !== geracao) return;

  const entrada = typeof cena.entrada === 'function' ? cena.entrada() : cena.entrada;
  const det = document.createElement('details');
  det.className = 'ferr rodando';
  det.innerHTML = `<summary><span class="estado" aria-hidden="true"></span><span>Usou ferramenta: <code>${cena.ferramenta}</code></span></summary>
    <div class="ferr-det"><h4>Entrada</h4><pre>${esc(JSON.stringify(entrada, null, 2))}</pre><h4>Saída</h4><pre class="saida">Aguardando...</pre></div>`;
  ia.innerHTML = '';
  ia.append(det);
  descer();
  await esperar(1100);
  if (vez !== geracao) return;
  det.classList.replace('rodando', 'ok');
  det.querySelector('.saida').textContent = cena.saida();
  descer();
  await esperar(500);
  if (vez !== geracao) return;

  const txt = document.createElement('div');
  txt.className = 'texto-ia';
  txt.innerHTML = cena.resposta();
  ia.append(txt);
  descer();
  await digitar(txt, vez, 10);
  if (vez !== geracao) return;
  ocupado = false;
  document.querySelectorAll('.sug').forEach((b) => { b.disabled = false; });
  descer();
}

document.querySelectorAll('.sug').forEach((b) => {
  b.addEventListener('click', () => { if (!ocupado) tocar(CENAS[Number(b.dataset.cena)]); });
});
$('#reiniciar').addEventListener('click', () => {
  geracao++;
  ocupado = false;
  caixa.innerHTML = '';
  document.querySelectorAll('.sug').forEach((b) => { b.disabled = false; });
  tocar(CENAS[0]);
});
$('#copiar').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  try {
    await navigator.clipboard.writeText($('#cmd').textContent);
    b.textContent = 'Copiado!';
  } catch {
    b.textContent = 'Selecione e copie';
  }
  setTimeout(() => { b.textContent = 'Copiar'; }, 1800);
});

tocar(CENAS[0]);
