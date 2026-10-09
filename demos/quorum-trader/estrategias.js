"use strict";
/* ============================================================ ESTRATÉGIAS (uma aba por forma de ganho) */
const AGENTES_EST = {
  id:"agentes", nome:"Agentes direcionais", icone:"bot",
  resumo:"Vários agentes analisam cada ativo e votam em comprar ou vender; o robô só entra quando o consenso é forte.",
  passos:["Baixa o gráfico de cada ativo e lê as notícias.","Cada agente vota de −100 (venda) a +100 (compra).",
          "O robô soma os votos, ponderados por quem vem acertando mais.","Passou do limite? Entra com stop e alvo; senão, espera."],
  risco:"Opera a direção do preço: pode perder quando o mercado vira. Stop em toda operação e limite diário protegem o capital. Executa de verdade no MT5 (B3/forex) e na Binance no modo real.",
};
const ETAPA_TXT = {coletando:"buscando dados",decidindo:"decidindo",aguardando:"vigiando",erro:"com problema",parada:"parada",iniciando:"começando"};

PG.estrategias = {
  async carregar(){ S.ests = await call("estrategias"); if(!S.estTab) S.estTab="agentes"; },
  async tick(){ if(S.page!=="estrategias") return; S.ests = await call("estrategias"); this.dinamico(); },
  recarregar(){ this.tick(); },
  atual(){ return S.estTab==="agentes" ? null : (S.ests||[]).find(x=>x.id===S.estTab); },
  render(){
    const pg=$("#pg"), ests=S.ests||[];
    const tabs=[{...AGENTES_EST, ativa:S.est?.estrategias && (S.cfg?.config?.agentes_direcional_ativo!==false)}, ...ests];
    pg.innerHTML=`<div class="tabs-est" id="esTabs">${tabs.map(t=>`<button class="tab-est ${S.estTab===t.id?"on":""}" ${A("abrirAba",t.id)}>
        ${ic(t.icone)}<span>${esc(t.nome.split(" (")[0])}</span>${t.ativa?`<i class="dot ${S.est?.rodando?"pulse":""}" style="color:var(--up)"></i>`:""}</button>`).join("")}</div>
      <div id="esCorpo" class="page"></div>`;
    S.estTab==="agentes" ? this.renderAgentes() : this.renderEstrategia();
  },
  renderAgentes(){
    const C=S.cfg?.config||{}, ligado=C.agentes_direcional_ativo!==false, t=AGENTES_EST;
    $("#esCorpo").innerHTML=`${this.cabecalho(t, ligado, `${CH("salvarCampo","agentes_direcional_ativo")}`, true)}
      ${this.comoFunciona(t)}
      <div class="card mt"><div class="hd"><h3>${ic("eye")}O que cada agente está pensando agora</h3><div class="grow"></div>
        <button class="btn sm ghost" ${A("go","agentes")}>Pesos e acertos ${ic("chev")}</button><button class="btn sm ghost" ${A("go","ativos")}>Escolher ativos ${ic("chev")}</button></div>
        <div id="esAgAtivos" class="col" style="gap:8px"></div></div>
      <div class="card mt row" style="gap:12px">${ic("info")}<span class="muted" style="font-size:13px">${esc(t.risco)} Ajuste risco, stop e alvo em <a href="#" ${A("go","config")} style="color:#B7AEFF">Configurações</a>.</span></div>`;
    this.dinamico();
  },
  cabecalho(x, ligado, attrSwitch, real){
    return `<div class="card est-hero ${ligado?"on":""}"><div class="row" style="gap:16px;align-items:flex-start">
      <div class="ico-g">${ic(x.icone)}</div>
      <div style="flex:1;min-width:0"><div class="row wrap" style="gap:8px"><h2 style="font-size:21px;letter-spacing:-.3px">${esc(x.nome)}</h2>
        ${real?`<span class="badge ${S.est?.modo==="real"?"warn":"brand"}">${S.est?.modo==="real"?"Executa de verdade (modo real)":"Simulação com preços reais"}</span>`:`<span class="badge brand" data-tip="Usa preços reais do mercado; o dinheiro é virtual.">Simulação com preços reais</span>`}</div>
        <p class="muted" style="margin-top:4px;font-size:14px">${esc(x.resumo)}</p>
        <div id="esStatus" class="est-status"></div></div>
      <label class="sw lg" data-tip="Ligar/desligar esta estratégia"><input type="checkbox" ${ligado?"checked":""} ${attrSwitch}><span></span></label></div></div>`;
  },
  comoFunciona(x){
    return `<h3 class="sec mt2 mb">${ic("help")}Como funciona, em ${x.passos.length} passos</h3>
      <div class="passos">${x.passos.map((p,i)=>`<div class="passo"><b>${i+1}</b><span>${esc(p)}</span></div>`).join("")}</div>`;
  },
  renderEstrategia(){
    const x=this.atual(); if(!x){ S.estTab="agentes"; return this.renderAgentes(); }
    const campos=x.campos.map(([k,rot,tipo,mn,mx,passo,aj])=>{
      const v=x.params[k];
      if(tipo==="bool") return `<div class="field"><label>${esc(rot)}</label><div class="row" style="height:40px"><label class="sw"><input type="checkbox" data-campo="${k}" ${v?"checked":""}><span></span></label>
        ${k==="executar_real"?`<span class="help">${S.est?.licenca?.real?"Só vale no modo real, com a Binance conectada.":"Exige licença Essencial ou Pro."}</span>`:`<span class="help">${esc(aj||"")}</span>`}</div></div>`;
      return `<div class="field"><label>${esc(rot)}</label><input class="inp ${tipo==="num"?"num":""}" data-campo="${k}" ${tipo==="num"?`type="number" min="${mn}" max="${mx}" step="${passo}"`:""} value="${esc(v)}">${aj?`<span class="help">${esc(aj)}</span>`:""}</div>`;
    }).join("");
    $("#esCorpo").innerHTML=`${this.cabecalho(x, x.ativa, CH("estrategiaLigar",x.id), x.real_suportado)}
      <div class="grid g4 mt" id="esK"></div>
      ${this.comoFunciona(x)}
      <div class="grid g-main mt2"><div class="card"><div class="hd"><h3 id="esEspT">${ic("eye")}Ao vivo</h3><div class="grow"></div><span class="muted" id="esProx" style="font-size:12px"></span></div><div id="esEsp"></div></div>
        <div class="card"><div class="hd"><h3>${ic("hist")}O que ela fez</h3></div><div id="esEv" style="max-height:420px;overflow:auto"></div></div></div>
      <div class="grid g2 mt2"><div class="card"><div class="hd"><h3>${ic("sliders")}Ajustes</h3></div><div class="grid g2" id="esForm">${campos}</div>
          <div class="row mt"><button class="btn ghost" ${A("resetarEstrategia",x.id)}>${ic("refresh")}Reiniciar simulação</button><div class="grow"></div><button class="btn pri" ${A("salvarEstrategia",x.id)} data-el>${ic("check")}Salvar ajustes</button></div></div>
        <div class="card"><div class="hd"><h3>${ic("alert")}Riscos e limites (leia antes)</h3></div><p class="muted" style="font-size:13.5px">${esc(x.risco)}</p>
          <div class="hd mt2"><h3>${ic("coins")}Operações</h3></div><div id="esOps" style="max-height:260px;overflow:auto"></div></div></div>`;
    this.dinamico();
  },
  dinamico(){
    if(S.page!=="estrategias" || !$("#esCorpo")) return;
    const tabs=$$("#esTabs .tab-est"), ests=S.ests||[];
    if(S.estTab==="agentes"){
      const e=S.est, ligado=S.cfg?.config?.agentes_direcional_ativo!==false;
      setHTML($("#esStatus"), `<span class="dot ${e?.rodando&&ligado?"pulse":""}" style="color:${ligado?"var(--up)":"var(--faint)"}"></span>${!ligado?"Desligada — mostro os sinais mas não opero.":e?.rodando?esc(e.etapa?.texto||""):"Ligada. Clique em Iniciar robô para começar."}`);
      const lista=(e?.ativos||[]).filter(a=>a.ativo!==false&&a.liberado);
      setHTML($("#esAgAtivos"), lista.map(a=>{ const p=a.pensamento||{titulo:"Aguardando o primeiro ciclo",texto:"",estado:"aguardando"};
        return `<div class="pos"><div style="width:150px"><b>${esc(a.nome)}</b><div class="muted num" style="font-size:12px">${price(a.preco)}</div></div>
          <span class="badge ${PENS_COR[p.estado]||""}">${esc(p.titulo)}</span><span class="muted" style="flex:1;font-size:12.5px">${esc(p.texto)}</span></div>`; }).join("") || `<div class="empty">${ic("coins")}<div>Nenhum ativo ligado</div></div>`);
      return;
    }
    const x=this.atual(); if(!x) return;
    ests.forEach((t,i)=>{ const b=tabs[i+1]; if(b) b.classList.toggle("ativa",t.ativa); });
    setHTML($("#esStatus"), `<span class="dot ${x.ativa&&S.est?.rodando?"pulse":""}" style="color:${x.erro?"var(--down)":x.ativa?"var(--up)":"var(--faint)"}"></span>
      ${x.ativa&&S.est?.rodando?`<b>${ETAPA_TXT[x.etapa]||x.etapa}:</b> `:""}${esc(x.status)}`);
    setHTML($("#esProx"), x.ativa&&S.est?.rodando&&x.proxima!=null?`verifica de novo em ${fmtSeg(x.proxima)}`:(x.ativa?"aguardando o robô iniciar":"desligada"));
    setHTML($("#esK"), [kpi("Capital da simulação", nf2.format(x.capital), "Dinheiro virtual só desta estratégia","coins","rgba(124,108,255,.2)"),
      kpi("Patrimônio agora", nf2.format(x.patrimonio), "Saldo + posições abertas","trend","rgba(34,211,238,.18)"),
      kpi("Resultado", `<span class="${cls(x.pnl)}">${signed(x.pnl)}</span>`, x.capital?pct(x.pnl/x.capital*100,2)+" sobre o capital":"", "spark", x.pnl>=0?"rgba(34,197,94,.2)":"rgba(244,63,94,.2)"),
      kpi("Operações", String(x.n_trades), x.acerto!=null?`${nf2.format(x.acerto)}% positivas`:"Nenhuma ainda","zap","rgba(245,165,36,.18)")].join(""));
    setHTML($("#esEsp"), (ESP[x.id]||(()=>""))(x));
    if(x.id==="pares" && x.extra?.historico_z) zChart($("#zc"), x.extra.historico_z, x.params.z_entrada, x.params.z_saida);
    setHTML($("#esEv"), x.eventos.length?x.eventos.map(ev=>`<div class="log ${ev.nivel}"><time>${hhmm(ev.ts)}</time><span class="tag"></span><span>${esc(ev.msg)}</span></div>`).join("")
      :`<div class="empty">${ic("hist")}<div>${x.ativa?"Ainda nada — está vigiando.":"Ligue a estratégia para ela começar."}</div></div>`);
    setHTML($("#esOps"), x.trades.length?`<table><tbody>${x.trades.map(t=>`<tr><td class="muted num" style="white-space:nowrap">${dthr(t.ts)}</td><td>${esc(t.descricao)}</td><td class="num ${cls(t.pnl)}" style="text-align:right"><b>${signed(t.pnl)}</b></td></tr>`).join("")}</tbody></table>`
      :`<div class="empty" style="padding:20px">${ic("coins")}<div>Nenhuma operação ainda</div></div>`);
  },
};

/* visualizações específicas de cada estratégia */
const tabela=(cab, linhas)=>`<div style="overflow:auto;max-height:380px"><table><thead><tr>${cab.map(c=>`<th>${c}</th>`).join("")}</tr></thead><tbody>${linhas.join("")||`<tr><td colspan="${cab.length}" class="muted">Carregando dados…</td></tr>`}</tbody></table></div>`;
const ESP = {
  arbitragem(x){
    const ok=x.extra?.corretoras_ok||[];
    return `<div class="chips mb">${["Binance","OKX","Bybit","KuCoin","Gate"].map(c=>`<span class="badge ${ok.includes(c)?"up":"down"}"><span class="dot"></span>${c}</span>`).join("")}</div>
      ${tabela(["Moeda","Compra em","Vende em","Diferença","Após taxas"], x.oportunidades.slice(0,14).map(o=>`<tr><td><b>${esc(o.moeda)}</b></td><td>${esc(o.compra_em)} <span class="faint num">${price(o.preco_compra)}</span></td>
        <td>${esc(o.vende_em)} <span class="faint num">${price(o.preco_venda)}</span></td><td class="num">${pct(o.bruto_pct,3)}</td><td class="num ${o.liquido_pct>=x.params.lucro_minimo_pct?"up":"down"}"><b>${pct(o.liquido_pct,3)}</b></td></tr>`))}
      <p class="help mt">Verde = passaria do lucro mínimo e seria executada. Quase sempre fica vermelho: as diferenças reais são menores que as taxas.</p>`;
  },
  triangular(x){
    return tabela(["Caminho (dentro da Binance)","Resultado após 3 taxas"], x.oportunidades.slice(0,14).map(o=>`<tr><td>${esc(o.caminho)}</td><td class="num ${o.lucro_pct>=x.params.lucro_minimo_pct?"up":"down"}"><b>${pct(o.lucro_pct,3)}</b></td></tr>`))
      + `<p class="help mt">Cada linha é uma volta completa começando e terminando em USDT. Verde = sobraria lucro.</p>`;
  },
  funding(x){
    const pos=x.extra?.posicoes||[], sw=x.extra?.swaps_mt5||{};
    return `<div class="hd"><h3 style="font-size:13.5px">Quem paga mais agora (Binance, contratos perpétuos)</h3></div>
      ${tabela(["Moeda","A cada 8h","Por ano"], x.oportunidades.slice(0,8).map(t=>`<tr><td><b>${esc(t.simbolo.replace("USDT",""))}</b></td><td class="num">${pct(t.taxa_8h_pct,4)}</td><td class="num ${t.anual_pct>=x.params.minimo_anual_pct?"up":""}"><b>${pct(t.anual_pct,1)}</b></td></tr>`))}
      <div class="hd mt"><h3 style="font-size:13.5px">Suas posições neutras</h3></div>
      ${pos.length?tabela(["Moeda","Valor","Recebido até agora","Taxa agora"], pos.map(p=>`<tr><td><b>${esc(p.simbolo.replace("USDT",""))}</b></td><td class="num">${nf2.format(p.valor)}</td><td class="num ${cls(p.acumulado)}">${signed(p.acumulado)}</td><td class="num">${p.anual_agora!=null?pct(p.anual_agora,1)+" a.a.":"—"}</td></tr>`)):`<p class="muted" style="font-size:13px">Nenhuma ainda.</p>`}
      <div class="hd mt"><h3 style="font-size:13.5px">Swap no forex (MetaTrader 5)</h3></div>
      ${sw.conectado?tabela(["Par","Swap comprado","Swap vendido"], sw.lista.map(s=>`<tr><td><b>${esc(s.simbolo)}</b></td><td class="num ${cls(s.swap_compra)}">${s.swap_compra}</td><td class="num ${cls(s.swap_venda)}">${s.swap_venda}</td></tr>`))
        :`<p class="muted" style="font-size:13px">Conecte o MetaTrader 5 em Configurações para ver os swaps reais da sua corretora (quanto você recebe ou paga por noite em cada par).</p>`}`;
  },
  grid(x){
    const n=x.extra?.niveis||[], comp=new Set((x.extra?.comprados||[]).map(Number)), p=x.extra?.preco;
    if(!n.length) return `<div class="empty">${ic("grid")}<div>O grid é montado quando a estratégia liga.</div></div>`;
    const lv=[...n].reverse();
    return `<div class="escada">${lv.map((v,i)=>{ const prox=lv[i+1]; const aqui=p!=null&&p<=v&&(prox==null||p>prox);
        const c=[...comp].some(k=>Math.abs(k-v)<1e-6);
        return `<div class="degrau ${c?"comprado":""}"><span class="num">${price(v)}</span><i></i><small>${c?"comprado — vende 1 degrau acima":"aguardando"}</small></div>${aqui?`<div class="preco-agora"><span>${ic("chev")} preço agora ${price(p)}</span></div>`:""}`; }).join("")}</div>`;
  },
  dca(x){
    const e=x.extra||{}, m=e.medio, p=e.preco;
    if(!m) return `<div class="empty">${ic("calendar")}<div>${x.ativa?"Fazendo a primeira compra…":"Ligue para começar a comprar aos poucos."}</div></div>`;
    const reforco=m*(1-x.params.reforco_queda_pct/100), lucro=m*(1+x.params.realizar_lucro_pct/100);
    const pos=Math.min(100,Math.max(0,(p-reforco)/(lucro-reforco)*100));
    return `<div class="grid g2"><div>${[["Quantidade",(e.qtd||0).toFixed(6)],["Preço médio",price(m)],["Investido",nf2.format(e.investido||0)+" USDT"],["Preço agora",price(p)]].map(([k,v])=>`<div class="row" style="padding:7px 0;border-bottom:1px dashed var(--border)"><span class="muted">${k}</span><div class="grow"></div><b class="num">${v}</b></div>`).join("")}</div>
      <div><div class="muted" style="font-size:12.5px;margin-bottom:10px">Onde o preço está entre o reforço e a realização do lucro</div>
        <div class="faixa"><i style="left:${pos}%"></i></div><div class="row num" style="font-size:12px;margin-top:6px"><span class="down">reforça ${price(reforco)}</span><div class="grow"></div><span class="muted">médio ${price(m)}</span><div class="grow"></div><span class="up">realiza ${price(lucro)}</span></div></div></div>`;
  },
  pares(x){
    const z=x.extra?.z;
    return `<div class="row mb" style="gap:14px"><div><div class="muted" style="font-size:12px">z-score agora</div><div class="num" style="font-size:28px;font-weight:750" >${z!=null?(z>0?"+":"")+z.toFixed(2):"—"}</div></div>
      <div class="muted" style="font-size:13px;flex:1">Mostra quantos "desvios" a relação ${esc(x.params.moeda_a)}/${esc(x.params.moeda_b)} está do normal. Entre as faixas tracejadas (±${x.params.z_entrada}) não opera; fora delas, aposta na volta.</div></div>
      <svg id="zc" class="zc" viewBox="0 0 600 180" preserveAspectRatio="none"></svg>`;
  },
};
function zChart(svg, vals, ze, zs){
  if(!svg||!vals.length) return;
  const W=600,H=180, mx=Math.max(4,...vals.map(Math.abs)), Y=v=>H/2-v/mx*(H/2-10), X=i=>i/(vals.length-1)*W;
  const d=vals.map((v,i)=>(i?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1)).join("");
  svg.innerHTML=`<rect x="0" y="${Y(ze)}" width="${W}" height="${Y(-ze)-Y(ze)}" fill="rgba(124,108,255,.07)"/>
    ${[ze,-ze].map(v=>`<line x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="#7C6CFF" stroke-dasharray="5 5" stroke-opacity=".7"/>`).join("")}
    <line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke="rgba(255,255,255,.15)"/>
    <path d="${d}" fill="none" stroke="#22D3EE" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <circle cx="${X(vals.length-1)}" cy="${Y(vals[vals.length-1])}" r="4" fill="#22D3EE"/>`;
}
async function abrirAba(id){ S.estTab=id; S.cfg=await call("config"); PG.estrategias.render(); }
async function salvarEstrategia(id, b){
  const params={}; $$("#esForm [data-campo]").forEach(el=>params[el.dataset.campo]= el.type==="checkbox"?el.checked: el.type==="number"?Number(el.value):el.value);
  const r=await withLoading(b,()=>call("estrategia_params",id,params)); if(r.ok===false) return toast(r.erro,"erro");
  toast("Ajustes salvos — valem a partir da próxima verificação","ok"); await PG.estrategias.tick(); PG.estrategias.renderEstrategia();
}
async function resetarEstrategia(id){
  const x=PG.estrategias.atual(); const v=await confirmar("Reiniciar a simulação desta estratégia?",`Saldo volta para o capital inicial e o histórico de operações dela é apagado. Capital atual: <b>${nf2.format(x.capital)}</b>.`,{ok:"Reiniciar",perigo:true});
  if(!v) return; const r=await call("estrategia_resetar",id,x.capital); r.ok===false?toast(r.erro,"erro"):toast("Simulação reiniciada","ok"); PG.estrategias.tick();
}
registrarAcoes({abrirAba, salvarEstrategia, resetarEstrategia});
