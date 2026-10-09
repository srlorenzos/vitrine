// Miniaturas decorativas (composições em HTML/CSS/SVG) que lembram cada demo.
const linha = (w, extra = '') => `<i class="pv-linha ${extra}" style="--w:${w}%"></i>`;

export const previews = {
  resumo: `
    <div class="pv pv-resumo">
      <div class="pv-cab"><span>RESUMO DO DIA</span><b>quinta-feira, 8 de outubro</b></div>
      <div class="pv-sec">Agenda</div>
      <div class="pv-lin"><em>09:30</em>${linha(55)}</div>
      <div class="pv-sec">Tarefas <span class="pv-pill perigo">2 atrasadas</span></div>
      <div class="pv-lin"><u class="pv-ponto alta"></u>${linha(62)}</div>
    </div>`,
  email: `
    <div class="pv pv-email">
      <div class="pv-assunto"><small>Assunto</small><span>Pagar luz <mark class="t">#casa</mark> <mark class="p">!alta</mark> <mark class="d">@sexta</mark></span></div>
      <svg class="pv-seta" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v14M6 13l6 6 6-6"/></svg>
      <div class="pv-tarefa"><u class="pv-check"></u><div><b>Pagar luz</b><span><mark class="t">casa</mark><mark class="p">alta</mark><mark class="d">sex, 10 out</mark></span></div></div>
    </div>`,
  painel: `
    <div class="pv pv-painel">
      <div class="pv-kpis"><i></i><i></i><i></i></div>
      <svg viewBox="0 0 220 84" preserveAspectRatio="none" aria-hidden="true">
        <g class="barras">
          <rect x="8" y="36" width="12" height="44" rx="2" class="rec"/><rect x="22" y="46" width="12" height="34" rx="2" class="desp"/>
          <rect x="48" y="28" width="12" height="52" rx="2" class="rec"/><rect x="62" y="40" width="12" height="40" rx="2" class="desp"/>
          <rect x="88" y="34" width="12" height="46" rx="2" class="rec"/><rect x="102" y="24" width="12" height="56" rx="2" class="desp"/>
          <rect x="128" y="22" width="12" height="58" rx="2" class="rec"/><rect x="142" y="38" width="12" height="42" rx="2" class="desp"/>
        </g>
        <path d="M168 76 L182 64 L196 66 L212 40" class="linha-acum"/>
        <path d="M168 78 L182 70 L196 72 L212 58" class="linha-ant"/>
      </svg>
    </div>`,
  mcp: `
    <div class="pv pv-mcp">
      <div class="pv-bolha eu">O que tenho pra hoje?</div>
      <div class="pv-tool"><span class="pv-chave"></span>Usou ferramenta: <code>agenda_do_dia</code></div>
      <div class="pv-bolha ia">${linha(88)}${linha(64)}</div>
    </div>`,
  palavreco: `
    <div class="pv pv-palavreco">
      <div class="pv-tiles">
        <b class="c">T</b><b class="a">E</b><b class="c">R</b><b class="c">M</b><b class="c">O</b>
        <b class="a">L</b><b class="c">I</b><b class="v">V</b><b class="c">R</b><b class="a">O</b>
        <b class="v">P</b><b class="v">A</b><b class="v">L</b><b class="v">A</b><b class="v">V</b>
      </div>
    </div>`,
  gtd: `
    <div class="pv pv-gtd">
      <div class="pv-term"><span class="pr">$</span> gtd proximas</div>
      <div class="pv-term"><span class="v">@casa</span> <span class="d">Trocar lâmpada da sala</span></div>
      <div class="pv-term"><span class="a">@pc</span> <span class="d">Enviar proposta ao cliente</span></div>
      <div class="pv-term"><span class="x">! projeto sem próxima ação:</span> <span class="d">Reforma</span></div>
      <div class="pv-term"><span class="pr">$</span> <i class="cursor"></i></div>
    </div>`,
  farol: `
    <div class="pv pv-farol">
      <div class="pv-maq"><u class="ok"></u>${linha(46)}<em>CPU 12%</em></div>
      <div class="pv-maq"><u class="ok"></u>${linha(58)}<em>CPU 34%</em></div>
      <div class="pv-maq"><u class="mal"></u>${linha(38)}<em>alerta</em></div>
      <div class="pv-maq"><u class="ok"></u>${linha(52)}<em>CPU 8%</em></div>
    </div>`,
};
