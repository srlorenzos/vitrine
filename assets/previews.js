// Miniaturas decorativas (composições em HTML/CSS/SVG) que lembram cada demo.
const linha = (w, extra = '') => `<i class="pv-linha ${extra}" style="--w:${w}%"></i>`;

export const previews = {
  coube: `
    <div class="pv pv-coube" style="display:flex;align-items:center;justify-content:center;height:100%;gap:10px">
      <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color:#38bdf8"><path d="M32 6l20 8v16c0 12-8.4 20.6-20 24-11.6-3.4-20-12-20-24V14z"/><path d="M22 31l7 7 13-14"/></svg>
    </div>`,
  'coube-desinstalador': `
    <div class="pv pv-coubeapp pv-desinstalador">
      <div class="pv-ca-top"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.6c0-.9.7-1.6 1.6-1.6h2.8c.9 0 1.6.7 1.6 1.6V7"/><path d="M6.5 7l.9 12.4a2 2 0 002 1.8h5.2a2 2 0 002-1.8L17.5 7"/></svg><b>Remover programa</b></div>
      <div class="pv-ca-row fora"><span>App antigo</span><em>412 MB</em></div>
      <div class="pv-ca-row fora"><span>Sobras no registro</span><em>18 chaves</em></div>
      <div class="pv-ca-row fora"><span>Pastas órfãs</span><em>6</em></div>
      <div class="pv-ca-bar"><i style="width:100%"></i></div>
    </div>`,
  'coube-turbo': `
    <div class="pv pv-coubeapp pv-turbo">
      <svg class="pv-gauge" viewBox="0 0 120 68" aria-hidden="true">
        <path d="M10 62a50 50 0 01100 0" fill="none" stroke="var(--borda)" stroke-width="8" stroke-linecap="round"/>
        <path d="M10 62a50 50 0 0170-46" fill="none" stroke="#fb923c" stroke-width="8" stroke-linecap="round"/>
        <line x1="60" y1="62" x2="92" y2="30" stroke="#fb923c" stroke-width="3" stroke-linecap="round"/>
        <circle cx="60" cy="62" r="4" fill="#fb923c"/>
      </svg>
      <div class="pv-ca-row"><span>Inicialização do Windows</span><em class="up">-38%</em></div>
      <div class="pv-ca-row"><span>Processos em segundo plano</span><em class="up">-12</em></div>
    </div>`,
  'coube-atualiza': `
    <div class="pv pv-coubeapp pv-atualiza">
      <div class="pv-ca-row ok"><span>Navegador</span><em>1.2 → 1.4</em></div>
      <div class="pv-ca-row ok"><span>Leitor de PDF</span><em>atualizado</em></div>
      <div class="pv-ca-row pendente"><span>Compactador</span><em>3.0 → 3.3</em></div>
      <div class="pv-ca-row pendente"><span>Runtime .NET</span><em>baixando…</em></div>
    </div>`,
  'coube-escudo': `
    <div class="pv pv-coubeapp pv-escudo">
      <div class="pv-escudo-radar">
        <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="#34d399" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M32 6l20 8v16c0 12-8.4 20.6-20 24-11.6-3.4-20-12-20-24V14z"/><path d="M22 31l7 7 13-14"/></svg>
        <i class="pv-pulso"></i>
      </div>
      <div class="pv-ca-row"><span>Varredura em tempo real</span><em class="up">ativa</em></div>
      <div class="pv-ca-row"><span>Ameaças encontradas</span><em>0</em></div>
    </div>`,
  'coube-drivers': `
    <div class="pv pv-coubeapp pv-drivers">
      <div class="pv-ca-row ok"><span>Placa de vídeo</span><em>v31.0 ✓</em></div>
      <div class="pv-ca-row ok"><span>Chipset</span><em>v10.1 ✓</em></div>
      <div class="pv-ca-row pendente"><span>Rede Wi-Fi</span><em>novo: v22.6</em></div>
      <div class="pv-ca-row"><span>Backup de drivers</span><em class="up">pronto</em></div>
    </div>`,
  'status-sentinela': `
    <div class="pv pv-sentinela">
      <div class="pv-sent-row"><u class="on"></u><span>portfolio.coube.shop</span><em>99.9%</em></div>
      <div class="pv-sent-row"><u class="on"></u><span>quorum-trader</span><em>100%</em></div>
      <div class="pv-sent-row"><u class="on"></u><span>farol-rmm</span><em>99.7%</em></div>
      <div class="pv-sent-foot">checado a cada hora · GitHub Actions</div>
    </div>`,
  'valida-br': `
    <div class="pv pv-valida">
      <div class="pv-valida-row ok"><span>CPF</span><code>123.456.789-09</code></div>
      <div class="pv-valida-row ok"><span>CNPJ</span><code>12.ABC.345/0001-9X</code></div>
      <div class="pv-valida-row erro"><span>CEP</span><code>00000-000</code></div>
    </div>`,
  'infra-toolkit': `
    <div class="pv pv-infra">
      <div class="pv-infra-row"><span>CPU</span><i style="--p:28%"></i></div>
      <div class="pv-infra-row"><span>Disco</span><i style="--p:64%"></i></div>
      <div class="pv-infra-row"><span>Rede</span><i style="--p:12%"></i></div>
      <div class="pv-infra-foot">relatório HTML · Windows &amp; Linux</div>
    </div>`,
  'wand-enhancer': `
    <div class="pv pv-wand">
      <svg viewBox="0 0 160 90" aria-hidden="true">
        <defs><linearGradient id="pvwand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#60a5fa"/></linearGradient></defs>
        <path d="M20 70L100 10" stroke="url(#pvwand)" stroke-width="5" stroke-linecap="round"/>
        <circle cx="100" cy="10" r="10" fill="none" stroke="#a78bfa" stroke-width="2" opacity=".7"/>
        <circle cx="112" cy="24" r="3" fill="#a78bfa"/><circle cx="122" cy="14" r="2" fill="#60a5fa"/><circle cx="108" cy="36" r="2" fill="#60a5fa"/>
      </svg>
      <span class="pv-wand-tag">UX + interoperabilidade</span>
    </div>`,
  'veil-wardens': `
    <div class="pv pv-veil">
      <svg viewBox="0 0 224 120" aria-hidden="true">
        <defs>
          <radialGradient id="pvveilbg" cx="30%" cy="35%" r="75%"><stop offset="0" stop-color="#2a3a66"/><stop offset="1" stop-color="#0a0d16"/></radialGradient>
          <linearGradient id="pvveilblade" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7cc7ff"/><stop offset="1" stop-color="#eaf6ff"/></linearGradient>
        </defs>
        <rect width="224" height="120" fill="url(#pvveilbg)"/>
        <path d="M40 104L150 20" stroke="url(#pvveilblade)" stroke-width="5" stroke-linecap="round"/>
        <path d="M40 104L150 20" stroke="#eaf6ff" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>
        <path d="M136 30l20-14 10 10-20 14z" fill="#283449" stroke="#7cc7ff" stroke-width="1.5"/>
        <circle cx="178" cy="34" r="30" fill="#7cc7ff" opacity=".08"/>
        <path d="M30 108l-10 10M150 20l10-10" stroke="#eaf6ff" stroke-width="2" stroke-linecap="round" opacity=".6"/>
      </svg>
      <span class="pv-veil-selo">protótipo 2.5D · pausado</span>
    </div>`,
  horda: `
    <div class="pv pv-horda" style="display:flex;align-items:center;justify-content:center;height:100%;gap:6px">
      <svg viewBox="0 0 120 56" width="150" height="70" fill="#f43f5e" opacity=".9"><circle cx="60" cy="30" r="9" fill="#fbbf24"/><circle cx="20" cy="14" r="5"/><circle cx="34" cy="44" r="5"/><circle cx="96" cy="12" r="5"/><circle cx="104" cy="40" r="5"/><circle cx="82" cy="50" r="4"/><circle cx="44" cy="8" r="4"/></svg>
    </div>`,
  reinos: `
    <div class="pv pv-reinos" style="height:100%;background:#2a2418 url(/assets/construcao/reinos.webp) center/cover no-repeat;border-radius:8px"></div>`,
  coroa: `
    <div class="pv pv-coroa" style="display:flex;align-items:center;justify-content:center;height:100%">
      <svg viewBox="0 0 220 96" width="224" height="98" style="border-radius:8px" aria-hidden="true">
        <rect width="220" height="96" fill="#2a2418"/>
        <g stroke="#4a4030" stroke-width=".8" fill="none"><path d="M0 24h220M0 48h220M0 72h220M44 0v96M88 0v96M132 0v96M176 0v96"/></g>
        <path d="M0 78 C50 64 90 84 140 70 S200 78 220 66 V96 H0Z" fill="#33402a" opacity=".7"/>
        <g stroke="#0d0f14" stroke-width="2"><circle cx="30" cy="30" r="9" fill="#4f8fe0"/><circle cx="30" cy="62" r="9" fill="#4f8fe0"/><circle cx="62" cy="46" r="7" fill="#7fb2f0"/><circle cx="170" cy="40" r="11" fill="#d85a46"/><circle cx="150" cy="66" r="8" fill="#e8806a"/></g>
        <path d="M96 40l4-18 8 9 8-14 8 14 8-9 4 18z" fill="#ffd24a" stroke="#6a4310" stroke-width="2" stroke-linejoin="round"/>
        <path d="M118 54l22-10" stroke="#ff8a3a" stroke-width="2.5" stroke-dasharray="4 4"/><circle cx="142" cy="44" r="4" fill="#ffb347"/>
      </svg>
    </div>`,
  rumo: `
    <div class="pv pv-resumo">
      <div class="pv-cab"><span>RUMO</span><b>Hoje · 5 tarefas</b></div>
      <div class="pv-lin"><u class="pv-ponto alta"></u>${linha(72)}</div>
      <div class="pv-lin"><u class="pv-ponto"></u>${linha(54)}</div>
      <div class="pv-sec">Finanças <span class="pv-pill">Open Finance</span></div>
      <svg viewBox="0 0 220 30" preserveAspectRatio="none" aria-hidden="true" style="width:100%;height:26px">
        <g><rect x="10" y="12" width="12" height="16" rx="2" fill="#4fd1c5"/><rect x="24" y="18" width="12" height="10" rx="2" fill="#7c9cff"/><rect x="58" y="8" width="12" height="20" rx="2" fill="#4fd1c5"/><rect x="72" y="16" width="12" height="12" rx="2" fill="#7c9cff"/><rect x="106" y="10" width="12" height="18" rx="2" fill="#4fd1c5"/><rect x="120" y="14" width="12" height="14" rx="2" fill="#7c9cff"/><rect x="154" y="4" width="12" height="24" rx="2" fill="#4fd1c5"/><rect x="168" y="12" width="12" height="16" rx="2" fill="#7c9cff"/></g>
      </svg>
    </div>`,
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
  quorum: `
    <div class="pv pv-quorum">
      <svg viewBox="0 0 224 70" class="pv-q-graf"><defs><linearGradient id="pvq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22c55e" stop-opacity=".35"/><stop offset="1" stop-color="#22c55e" stop-opacity="0"/></linearGradient></defs>
        <path d="M0 58 L18 52 L34 55 L52 44 L70 47 L88 36 L106 39 L124 28 L142 32 L160 20 L178 24 L196 12 L224 8 L224 70 L0 70Z" fill="url(#pvq)"/>
        <path d="M0 58 L18 52 L34 55 L52 44 L70 47 L88 36 L106 39 L124 28 L142 32 L160 20 L178 24 L196 12 L224 8" fill="none" stroke="#22c55e" stroke-width="2"/></svg>
      <div class="pv-q-linha"><b>BTC</b><span class="pv-q-medidor"><i style="left:72%"></i></span><em class="c">compra</em></div>
      <div class="pv-q-linha"><b>WIN</b><span class="pv-q-medidor"><i style="left:30%"></i></span><em class="v">venda</em></div>
    </div>`,
};
