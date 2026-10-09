"use strict";
/* ============================================================ GRÁFICOS AO VIVO */
PG.graficos = {
  async carregar(){ const at=(S.est?.ativos||[]).filter(a=>a.ativo!==false&&a.liberado); if(!S.gAtivo||!at.some(a=>a.nome===S.gAtivo)) S.gAtivo=at[0]?.nome; S.g=S.gAtivo?await call("grafico",S.gAtivo):null; },
  async tick(){ if(S.page!=="graficos"||!S.gAtivo) return; S.g=await call("grafico",S.gAtivo); this.dinamico(); },
  render(){
    const at=(S.est?.ativos||[]).filter(a=>a.ativo!==false&&a.liberado);
    $("#pg").innerHTML=`<div class="chips mb">${at.map(a=>`<button class="chip ${a.nome===S.gAtivo?"on":""}" ${A("trocarGrafico",a.nome)}>${esc(a.nome)}</button>`).join("")}</div>
      <div class="grid g-main"><div class="card"><div class="hd"><h3>${ic("chart")}<span id="gTit"></span></h3><div class="grow"></div>
        <span class="badge up"><span class="dot pulse"></span>ao vivo</span><span class="muted" style="font-size:12px" id="gInfo"></span></div>
        <div class="chart-wrap" style="height:440px" id="gChart"></div>
        <div class="row wrap mt" style="gap:14px;font-size:12px"><span class="leg"><i style="background:#7C6CFF"></i>Entrada</span><span class="leg"><i style="background:#F43F5E"></i>Stop (limita a perda)</span><span class="leg"><i style="background:#22C55E"></i>Alvo (realiza o lucro)</span><span class="leg"><i class="tri"></i>Operações fechadas</span></div></div>
      <div class="col" style="gap:16px"><div class="card" id="gLado"></div><div class="card" id="gVotos"></div></div></div>`;
    this.dinamico();
  },
  dinamico(){
    const g=S.g; if(!g||!$("#gChart")) return;
    if(g.ok===false){ setHTML($("#gLado"),`<div class="empty">${ic("alert")}<div>${esc(g.erro)}</div></div>`); return; }
    const a=(S.est.ativos||[]).find(x=>x.nome===S.gAtivo)||{};
    setHTML($("#gTit"), esc(S.gAtivo)+` <span class="muted" style="font-weight:500">· velas de ${S.cfg?.config?.timeframe_min||60} min</span>`);
    setHTML($("#gInfo"), g.ticks?.length?`último preço ${hhmm(g.ticks[g.ticks.length-1][0])}`:"");
    candles($("#gChart"), g);
    const p=g.pensamento||{titulo:S.est.rodando?"Analisando…":"Robô parado",texto:"",estado:"aguardando"}, pos=g.posicao;
    setHTML($("#gLado"), `<div class="muted" style="font-size:12.5px">Preço agora</div><div class="num" style="font-size:30px;font-weight:750;letter-spacing:-.6px">${price(g.preco)}</div>
      <div class="num ${cls(a.variacao)}" style="font-weight:600">${a.variacao!=null?pct(a.variacao,2)+" em 24h":""}</div>
      <div class="nav-sep" style="margin:14px 0"></div><span class="badge ${PENS_COR[p.estado]||""}">${esc(p.titulo)}</span><p class="muted" style="font-size:13px;margin-top:8px">${esc(p.texto||"")}</p>
      ${p.ia?`<p class="av-ia" style="margin-top:8px">${ic("spark")}<span><b>IA:</b> ${esc(p.ia)}</span></p>`:""}
      ${pos?`<div class="nav-sep" style="margin:14px 0"></div><b>${pos.lado>0?"Comprado":"Vendido"}</b>${[["Entrada",pos.entrada],["Stop",pos.stop],["Alvo",pos.alvo]].map(([k,v])=>`<div class="row num" style="font-size:13px;margin-top:6px"><span class="muted">${k}</span><div class="grow"></div>${price(v)}</div>`).join("")}`:""}`);
    const vt=Object.entries(g.votos||{});
    setHTML($("#gVotos"), `<div class="hd"><h3>${ic("bot")}Votos dos agentes</h3><div class="grow"></div><b class="num ${g.score>0.1?"up":g.score<-0.1?"down":""}">${g.score!=null?(g.score*100>0?"+":"")+(g.score*100).toFixed(0):"—"}</b></div>
      ${vt.length?vt.map(([k,v])=>`<div class="row" style="font-size:12.5px;margin-top:8px"><span style="width:92px">${esc(nomeAgente(k))}</span><div class="vbar"><i style="${v>=0?`left:50%;width:${v*50}%;background:var(--up)`:`left:${50+v*50}%;width:${-v*50}%;background:var(--down)`}"></i></div><b class="num" style="width:38px;text-align:right">${(v*100).toFixed(0)}</b></div>`).join("")
        :`<p class="muted" style="font-size:13px">Os votos aparecem depois do primeiro ciclo do robô.</p>`}`);
  },
};
AG_NOMES.ia="IA Claude";
async function trocarGrafico(n){ S.gAtivo=n; S.g=await call("grafico",n); PG.graficos.render(); }

function candles(wrap, g){
  let cv=$("canvas",wrap), tt=$(".tt",wrap);
  if(!cv){ wrap.innerHTML=`<canvas></canvas><div class="tt"></div>`; cv=$("canvas",wrap); tt=$(".tt",wrap);
    cv.addEventListener("mousemove",e=>{ cv._hx=e.offsetX; cv._draw(); }); cv.addEventListener("mouseleave",()=>{ cv._hx=null; tt.style.opacity=0; cv._draw(); }); }
  cv._g=g;
  cv._draw=()=>{
    const G=cv._g, dpr=devicePixelRatio||1, W=cv.clientWidth, H=cv.clientHeight;
    if(cv.width!==W*dpr||cv.height!==H*dpr){ cv.width=W*dpr; cv.height=H*dpr; }
    const c=cv.getContext("2d"); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H);
    let B=(G.barras||[]).slice(-90).map(b=>b.slice());
    if(!B.length){ c.fillStyle="#5C6B7D"; c.font="13px Segoe UI"; c.textAlign="center"; c.fillText("Carregando gráfico…",W/2,H/2); return; }
    const tk=G.ticks||[]; const ult=B[B.length-1];
    if(tk.length){ const p=tk[tk.length-1][1]; ult[4]=p; ult[2]=Math.max(ult[2],p); ult[3]=Math.min(ult[3],p); }   // vela atual se mexe com o preço ao vivo
    const linhas=[]; const pos=G.posicao;
    if(pos){ linhas.push([pos.entrada,"#7C6CFF","Entrada"],[pos.stop,"#F43F5E","Stop"],[pos.alvo,"#22C55E","Alvo"]); }
    let mn=Math.min(...B.map(b=>b[3]),...linhas.map(l=>l[0])), mx=Math.max(...B.map(b=>b[2]),...linhas.map(l=>l[0]));
    const pad=(mx-mn)*.08||1; mn-=pad; mx+=pad;
    const L=8,R=78,T=10,Bm=24, w=(W-L-R)/B.length, X=i=>L+i*w+w/2, Y=v=>T+(1-(v-mn)/(mx-mn))*(H-T-Bm);
    c.font="11px Segoe UI"; c.textAlign="left"; c.strokeStyle="rgba(255,255,255,.05)";
    for(let k=0;k<=5;k++){ const v=mn+(mx-mn)*k/5, y=Y(v); c.beginPath(); c.moveTo(L,y); c.lineTo(W-R,y); c.stroke(); c.fillStyle="#5C6B7D"; c.fillText(price(v),W-R+8,y+4); }
    c.textAlign="center"; for(let k=0;k<B.length;k+=Math.ceil(B.length/6)) { c.fillStyle="#5C6B7D"; c.fillText(hhmm(B[k][0]),X(k),H-7); }
    B.forEach((b,i)=>{ const up=b[4]>=b[1], col=up?"#22C55E":"#F43F5E"; c.strokeStyle=col; c.fillStyle=col;
      c.beginPath(); c.moveTo(X(i),Y(b[2])); c.lineTo(X(i),Y(b[3])); c.stroke();
      const y1=Y(Math.max(b[1],b[4])), y2=Y(Math.min(b[1],b[4])); c.globalAlpha=i===B.length-1?1:.85; c.fillRect(X(i)-w*.35,y1,w*.7,Math.max(1,y2-y1)); c.globalAlpha=1; });
    linhas.forEach(([v,col,rot])=>{ const y=Y(v); c.setLineDash([6,5]); c.strokeStyle=col; c.beginPath(); c.moveTo(L,y); c.lineTo(W-R,y); c.stroke(); c.setLineDash([]);
      c.fillStyle=col; c.fillRect(W-R+2,y-9,R-4,18); c.fillStyle="#fff"; c.textAlign="left"; c.fillText(rot,W-R+6,y+4); });
    const t0=B[0][0], passo=(B[1]?.[0]-B[0][0])||3600;
    (G.trades||[]).forEach(t=>{ const ts=Date.parse(t.quando)/1000, i=Math.round((ts-t0)/passo); if(i<0||i>=B.length) return;
      const y=Y(t.saida), up=t.pnl>0; c.fillStyle=up?"#22C55E":"#F43F5E"; c.beginPath(); c.moveTo(X(i),y-9); c.lineTo(X(i)-6,y-17); c.lineTo(X(i)+6,y-17); c.closePath(); c.fill(); });
    const yp=Y(ult[4]); c.fillStyle="#22D3EE"; c.fillRect(W-R+2,yp-9,R-4,18); c.fillStyle="#04151a"; c.textAlign="left"; c.fillText(price(ult[4]),W-R+6,yp+4);
    if(cv._hx!=null){ const i=Math.max(0,Math.min(B.length-1,Math.floor((cv._hx-L)/w))), b=B[i];
      c.strokeStyle="rgba(255,255,255,.2)"; c.beginPath(); c.moveTo(X(i),T); c.lineTo(X(i),H-Bm); c.stroke();
      tt.innerHTML=`<b>${dthr(b[0])}</b><div class="num muted">A ${price(b[1])} · Máx ${price(b[2])}<br>Mín ${price(b[3])} · F ${price(b[4])}</div>`; tt.style.left=X(i)+"px"; tt.style.top=(Y(b[2])+10)+"px"; tt.style.opacity=1; }
  };
  cv._draw();
}

/* ============================================================ COPILOTO IA */
const SUGESTOES=["O que o robô está fazendo agora?","Por que ele ainda não comprou?","Explique a arbitragem de um jeito simples","Como deixo o robô mais conservador?","Qual estratégia está indo melhor?"];
PG.copiloto = {
  render(){
    const ia=S.est?.ia||{}; if(!S.chat) S.chat=[];
    if(!ia.na_licenca){
      $("#pg").innerHTML=`<div class="card ia-hero"><div class="row wrap" style="gap:24px"><div style="flex:1;min-width:300px"><span class="badge brand">${ic("spark")}IA de verdade, já instalada</span>
        <h2 style="font-size:26px;letter-spacing:-.5px;margin-top:12px">Um analista e um professor dentro do robô</h2>
        <p class="muted mt" style="font-size:14.5px">A IA do Quorum usa o <b>Claude</b>, da Anthropic. Ela lê as manchetes e os indicadores de cada ativo, vota junto com os agentes e explica o porquê — e responde suas dúvidas aqui, olhando o que o seu robô está fazendo agora.</p>
        <p class="muted mt" style="font-size:14.5px"><b>Nada para instalar:</b> sem chave de API, sem MCP, sem ChatGPT. Ela roda no servidor do Quorum e é liberada pela sua licença.</p>
        <div class="row mt2"><button class="btn pri" ${A("comprar","ia")}>${ic("unlock")}Assinar IA Quorum — R$ 79/mês</button><button class="btn" ${A("comprar","pro")}>Plano Pro (30 dias inclusos)</button></div></div>
        <div class="col" style="gap:10px;min-width:280px;flex:1">${[["Você","Por que ele não comprou BTC?"],["IA","O consenso dos agentes está em −30 e precisa chegar a +50 para comprar. Tendência e MACD estão contra, e as manchetes da última hora falam de saída de ETFs. Ele está esperando confirmação."]].map(([q,t])=>`<div class="msg ${q==="Você"?"eu":"ia"}"><b>${q}</b><p>${t}</p></div>`).join("")}</div></div></div>`;
      return;
    }
    $("#pg").innerHTML=`<div class="grid g-main"><div class="card chat"><div class="hd"><h3>${ic("spark")}Copiloto</h3><div class="grow"></div><span class="muted" style="font-size:12px" id="cpRest"></span></div>
        <div id="cpMsgs" class="msgs"></div>
        <div class="chips" id="cpSug">${SUGESTOES.map((t,i)=>`<button class="chip" ${A("perguntarSug",i)}>${esc(t)}</button>`).join("")}</div>
        <div class="row mt"><input class="inp" id="cpIn" placeholder="Pergunte qualquer coisa sobre o seu robô…" maxlength="1000"><button class="btn pri" id="cpGo" ${A("perguntar")} data-el>${ic("send")}Enviar</button></div></div>
      <div class="col" style="gap:16px"><div class="card"><div class="hd"><h3>${ic("bot")}Agente IA nas decisões</h3></div>
          <p class="muted" style="font-size:13px">A cada ${S.cfg?.config?.ia_intervalo_min||60} min a IA lê manchetes e indicadores de cada ativo e dá um voto, que entra no consenso junto com os outros agentes.</p>
          <p class="muted mt" style="font-size:12.5px" id="cpStatus"></p><button class="btn sm mt" ${A("iaAgora")} data-el>${ic("refresh")}Analisar agora</button></div>
        <div class="card"><div class="hd"><h3>${ic("eye")}Última opinião da IA</h3></div><div id="cpOps" class="col" style="gap:10px"></div></div></div></div>`;
    $("#cpIn").addEventListener("keydown",e=>{ if(e.key==="Enter") perguntar($("#cpGo")); });
    this.desenhar(); this.dinamico();
  },
  tick(){ this.dinamico(); },
  dinamico(){
    const ia=S.est?.ia||{}; if(!$("#cpStatus")) return;
    setHTML($("#cpStatus"), esc(ia.status||(ia.ultimo?"":"Ainda não analisou — roda junto com o robô ligado."))+(ia.ate?` Assinatura até ${new Date(ia.ate*1000).toLocaleDateString("pt-BR")}.`:""));
    const ops=(S.est.ativos||[]).filter(a=>a.pensamento?.ia);
    setHTML($("#cpOps"), ops.length?ops.map(a=>`<div><b>${esc(a.nome)}</b><p class="muted" style="font-size:12.5px">${esc(a.pensamento.ia)}</p></div>`).join(""):`<p class="muted" style="font-size:13px">Aparece aqui depois da primeira análise.</p>`);
  },
  desenhar(){
    const el=$("#cpMsgs"); if(!el) return;
    el.innerHTML=(S.chat.length?S.chat:[{papel:"ia",texto:"Oi! Sou o Copiloto do Quorum. Pergunte o que o robô está fazendo, por que entrou ou não entrou numa operação, ou peça para eu explicar qualquer estratégia."}])
      .map(m=>`<div class="msg ${m.papel==="usuario"?"eu":"ia"}"><b>${m.papel==="usuario"?"Você":"Copiloto"}</b><p>${esc(m.texto).replace(/\n/g,"<br>")}</p></div>`).join("")
      + (S.chatPensando?`<div class="msg ia"><b>Copiloto</b><p class="digitando"><i></i><i></i><i></i></p></div>`:"");
    el.scrollTop=el.scrollHeight;
  },
};
async function perguntar(b, texto){
  const inp=$("#cpIn"), q=(texto??inp.value).trim(); if(!q||S.chatPensando) return;
  inp.value=""; S.chat.push({papel:"usuario",texto:q}); S.chatPensando=true; PG.copiloto.desenhar();
  const r=await call("copiloto",q,S.chat.slice(0,-1)); S.chatPensando=false;
  S.chat.push({papel:"ia",texto:r.ok===false?("⚠️ "+r.erro):r.resposta});
  if(r.restante!=null) setHTML($("#cpRest"),`${r.restante} perguntas restantes hoje`);
  PG.copiloto.desenhar();
}
function perguntarSug(i){ perguntar($("#cpGo"), SUGESTOES[i]); }
async function iaAgora(b){ const r=await withLoading(b,()=>call("ia_agora")); r.ok===false?toast(r.erro,"erro",6000):toast("IA analisou os ativos","ok"); tick(); }

/* ============================================================ FERRAMENTAS */
const FERR=[["calc","Calculadora de posição","calc"],["alertas","Alertas de preço","bell"],["relogio","Relógio dos mercados","globe"],["telegram","Avisos no Telegram","send"],["relatorio","Relatório","file"]];
PG.ferramentas = {
  render(){
    if(!S.fTab) S.fTab="calc";
    $("#pg").innerHTML=`<div class="tabs-est">${FERR.map(([k,n,i])=>`<button class="tab-est ${S.fTab===k?"on":""}" ${A("abrirFerramenta",k)}>${ic(i)}<span>${n}</span></button>`).join("")}</div><div id="fCorpo" class="page"></div>`;
    ({calc:fCalc,alertas:fAlertas,relogio:fRelogio,telegram:fTelegram,relatorio:fRelatorio})[S.fTab]();
  },
  tick(){ if(S.fTab==="relogio") fRelogio(true); if(S.fTab==="alertas") fAlertasPrecos(); },
};
function abrirFerramenta(k){ S.fTab=k; PG.ferramentas.render(); }
const TIPOS_CALC={cripto:["Cripto / ações (quantidade)",1],win:["Mini índice WIN (R$ 0,20 por ponto)",0.2],wdo:["Mini dólar WDO (R$ 10 por ponto)",10],forex:["Forex (lote padrão = 100.000)",100000]};
function fCalc(){
  $("#fCorpo").innerHTML=`<div class="grid g2"><div class="card"><div class="hd"><h3>${ic("calc")}Quanto comprar sem arriscar demais?</h3></div>
    <div class="grid g2"><div class="field"><label>Capital (R$ ou USDT)</label><input class="inp num" id="cCap" type="number" value="${S.cfg?.config?.saldo_inicial_simulado||10000}"></div>
    <div class="field"><label>Risco por operação (%)</label><input class="inp num" id="cRis" type="number" step="0.1" value="${S.cfg?.config?.risco_por_trade_pct||1}"></div>
    <div class="field"><label>Preço de entrada</label><input class="inp num" id="cEnt" type="number" value="100"></div>
    <div class="field"><label>Preço do stop</label><input class="inp num" id="cStop" type="number" value="97"></div>
    <div class="field" style="grid-column:1/-1"><label>Tipo de ativo</label><select class="inp" id="cTipo">${Object.entries(TIPOS_CALC).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join("")}</select></div></div></div>
    <div class="card" id="cRes"></div></div>`;
  $$("#fCorpo input,#fCorpo select").forEach(el=>el.addEventListener("input",calcular)); calcular();
}
function calcular(){
  const cap=+$("#cCap").value, ris=+$("#cRis").value, ent=+$("#cEnt").value, st=+$("#cStop").value, [rot,mult]=TIPOS_CALC[$("#cTipo").value];
  const dist=Math.abs(ent-st), perda=cap*ris/100;
  if(!(cap>0&&ris>0&&dist>0)) return setHTML($("#cRes"),`<div class="empty">${ic("calc")}<div>Preencha capital, risco, entrada e stop (diferentes).</div></div>`);
  const qtd=perda/(dist*mult), lado=st<ent?"compra":"venda", alvo=ent+(ent-st)*2;
  const un=$("#cTipo").value==="win"||$("#cTipo").value==="wdo"?"contratos":$("#cTipo").value==="forex"?"lotes":"unidades";
  setHTML($("#cRes"),`<div class="hd"><h3>${ic("check")}Resultado</h3></div>
    <div class="num" style="font-size:34px;font-weight:750;letter-spacing:-.8px">${qtd>=100?nf2.format(qtd):qtd.toFixed(un==="unidades"?6:2)} <span class="muted" style="font-size:16px;font-weight:500">${un}</span></div>
    <p class="muted mt" style="font-size:13.5px">Numa <b>${lado}</b>, se o stop for atingido você perde no máximo <b class="down">${nf2.format(perda)}</b> (${ris}% do capital).</p>
    ${[["Valor da posição",un==="contratos"?"margem definida pela corretora":nf2.format(qtd*ent*(un==="lotes"?100000:1))],["Distância do stop",`${price(dist)} (${(dist/ent*100).toFixed(2)}%)`],["Alvo 2× o risco",`${price(alvo)} → ganho de ${nf2.format(perda*2)}`]].map(([k,v])=>`<div class="row" style="padding:8px 0;border-bottom:1px dashed var(--border)"><span class="muted">${k}</span><div class="grow"></div><b class="num">${v}</b></div>`).join("")}
    ${un==="contratos"&&qtd<1?`<p class="warn mt" style="font-size:13px">Menos de 1 contrato: com esse capital e stop, operar 1 contrato arriscaria ${nf2.format(dist*mult)} (${(dist*mult/cap*100).toFixed(1)}%).</p>`:""}`);
}
function fAlertas(){
  const C=S.cfg.config, at=C.ativos.filter(a=>a.ativo!==false);
  $("#fCorpo").innerHTML=`<div class="grid g2"><div class="card"><div class="hd"><h3>${ic("bell")}Novo alerta</h3></div>
      <div class="grid g2"><div class="field"><label>Ativo</label><select class="inp" id="aAt">${at.map(a=>`<option>${esc(a.nome)}</option>`).join("")}</select></div>
      <div class="field"><label>Quando o preço ficar</label><select class="inp" id="aCond"><option value="acima">acima de</option><option value="abaixo">abaixo de</option></select></div>
      <div class="field"><label>Preço</label><input class="inp num" id="aPr" type="number" step="any"></div><div class="field"><label>Preço agora</label><div class="inp num" id="aAgora" style="display:flex;align-items:center"></div></div></div>
      <div class="row mt"><span class="help">Avisa no app${S.est.telegram_ok?" e no Telegram":" (e no Telegram, se você configurar)"} — funciona mesmo com o robô pausado.</span><div class="grow"></div><button class="btn pri" ${A("addAlerta")}>${ic("plus")}Criar alerta</button></div></div>
    <div class="card"><div class="hd"><h3>${ic("bell")}Seus alertas</h3></div><div id="aLista"></div></div></div>`;
  $("#aAt").addEventListener("change",fAlertasPrecos); fAlertasPrecos(); listaAlertas();
}
function fAlertasPrecos(){ const a=(S.est.ativos||[]).find(x=>x.nome===$("#aAt")?.value); if(a&&$("#aAgora")) setHTML($("#aAgora"),price(a.preco)); if(!$("#aPr")?.value && a?.preco && $("#aPr")) $("#aPr").value=+a.preco.toPrecision(6); }
function listaAlertas(){
  const L=S.cfg.config.alertas||[];
  setHTML($("#aLista"), L.length?L.map((a,i)=>`<div class="pos"><span class="badge ${a.ligado?"brand":"up"}">${a.ligado?"vigiando":"disparou"}</span><div style="flex:1"><b>${esc(a.ativo)}</b> <span class="muted">${a.condicao} de</span> <b class="num">${price(a.preco)}</b>${a.disparado?`<div class="faint" style="font-size:12px">disparou ${dthr(a.disparado)}</div>`:""}</div><button class="btn sm icon ghost" ${A("rmAlerta",i)}>${ic("trash")}</button></div>`).join("")
    :`<div class="empty">${ic("bell")}<div>Nenhum alerta. Crie um ao lado.</div></div>`);
}
async function salvarAlertasUI(L){ const r=await call("salvar_alertas",L); if(r.ok===false) return toast(r.erro,"erro"); S.cfg=await call("config"); listaAlertas(); }
async function addAlerta(){ const p=+$("#aPr").value; if(!(p>0)) return toast("Informe o preço do alerta","aviso");
  await salvarAlertasUI([...(S.cfg.config.alertas||[]),{ativo:$("#aAt").value,condicao:$("#aCond").value,preco:p,ligado:true}]); toast("Alerta criado","ok"); }
async function rmAlerta(i){ const L=[...S.cfg.config.alertas]; L.splice(i,1); await salvarAlertasUI(L); }
const SESSOES=[["B3 (Brasil)","b3",12,21.25,"#22C55E","Mini índice e mini dólar · 9h às 18h15"],["Sydney","fx",22,7,"#38BDF8","Forex"],["Tóquio","fx",0,9,"#38BDF8","Forex · iene"],["Londres","fx",8,17,"#38BDF8","Forex · maior volume"],["Nova York","fx",13,22,"#38BDF8","Forex e ouro · notícias dos EUA"],["Cripto","cr",0,24,"#F7931A","24 horas, 7 dias"]];
function fRelogio(soAtualiza){
  const u=new Date(), hu=u.getUTCHours()+u.getUTCMinutes()/60, dia=u.getUTCDay(), fds=dia===6||(dia===0&&hu<22)||(dia===5&&hu>=21);
  const aberto=(s)=>s[1]==="cr"?true:s[1]==="b3"?(dia>=1&&dia<=5&&hu>=12.08&&hu<21.25):!fds&&(s[2]<s[3]?hu>=s[2]&&hu<s[3]:hu>=s[2]||hu<s[3]);
  const html=`<div class="card"><div class="hd"><h3>${ic("globe")}Quem está aberto agora</h3><div class="grow"></div><span class="muted num">${u.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} no seu PC · ${String(u.getUTCHours()).padStart(2,"0")}:${String(u.getUTCMinutes()).padStart(2,"0")} UTC</span></div>
    <div class="relogio">${SESSOES.map(s=>{ const ab=aberto(s); const a=s[2]/24*100, b=(s[3]>s[2]?s[3]-s[2]:24-s[2]+s[3])/24*100;
      return `<div class="sess"><div style="width:190px"><b>${s[0]}</b><div class="faint" style="font-size:12px">${s[5]}</div></div>
        <div class="trilho"><i style="left:${a}%;width:${Math.min(b,100-a)}%;background:${s[4]}"></i>${a+b>100?`<i style="left:0;width:${a+b-100}%;background:${s[4]}"></i>`:""}<u style="left:${hu/24*100}%"></u></div>
        <span class="badge ${ab?"up":""}" style="width:82px;justify-content:center"><span class="dot ${ab?"pulse":""}"></span>${ab?"Aberto":"Fechado"}</span></div>`; }).join("")}
      <div class="row faint num" style="font-size:11px;padding-left:200px;padding-right:96px"><span>0h UTC</span><div class="grow"></div><span>12h</span><div class="grow"></div><span>24h</span></div></div>
    <p class="help mt">A linha branca é o horário de agora. Os horários de maior movimento (e de mais oportunidades) são quando Londres e Nova York estão abertas juntas. Feriados da B3 são respeitados pelo robô.</p></div>`;
  soAtualiza&&$("#fCorpo")?setHTML($("#fCorpo"),html):($("#fCorpo").innerHTML=html);
}
function fTelegram(){
  const C=S.cfg.config.telegram||{};
  $("#fCorpo").innerHTML=`<div class="grid g2"><div class="card"><div class="hd"><h3>${ic("send")}Receba os avisos no celular</h3><div class="grow"></div><span class="badge ${S.est.telegram_ok?"up":""}"><span class="dot"></span>${S.est.telegram_ok?"Conectado":"Não configurado"}</span></div>
      <div class="field"><label>Token do bot</label><input class="inp" id="tgTok" value="${esc(C.token||"")}" placeholder="123456:ABC-DEF…" autocomplete="off"></div>
      <div class="field mt"><label>Seu chat_id</label><input class="inp num" id="tgChat" value="${esc(C.chat_id||"")}" placeholder="ex.: 123456789"></div>
      <div class="row mt">${S.est.telegram_ok?`<button class="btn ghost" ${A("rmTelegram")}>${ic("trash")}Desconectar</button>`:""}<div class="grow"></div><button class="btn pri" ${A("salvarTelegram")} data-el>${ic("send")}Testar e salvar</button></div></div>
    <div class="card"><div class="hd"><h3>${ic("help")}Como pegar esses dados (2 minutos)</h3></div>
      <ol class="muted" style="margin-left:18px;font-size:13.5px;display:flex;flex-direction:column;gap:8px"><li>No Telegram, abra o <b>@BotFather</b>, mande <b>/newbot</b> e escolha um nome. Ele te dá o <b>token</b>.</li>
      <li>Abra o seu bot novo e mande qualquer mensagem (ex.: “oi”).</li><li>Abra o <b>@userinfobot</b>: ele responde com o seu <b>Id</b> — esse é o chat_id.</li><li>Cole os dois aqui e clique em Testar. Você recebe uma mensagem de confirmação.</li></ol>
      <p class="help mt">Você será avisado de compras, vendas, lucros, prejuízos, alertas de preço, pânico, perda máxima e meta do dia.</p></div></div>`;
}
async function salvarTelegram(b){ const r=await withLoading(b,()=>call("salvar_telegram",$("#tgTok").value,$("#tgChat").value)); if(r.ok===false) return toast(r.erro,"erro",7000); toast("Telegram conectado! Confira a mensagem no celular.","ok"); S.cfg=await call("config"); await tick(); fTelegram(); }
async function rmTelegram(){ await call("remover_telegram"); S.cfg=await call("config"); await tick(); fTelegram(); }
function fRelatorio(){
  $("#fCorpo").innerHTML=`<div class="card row wrap" style="gap:24px;padding:28px"><div class="ico-g">${ic("file")}</div><div style="flex:1;min-width:260px"><h2 style="font-size:20px">Relatório completo em um clique</h2>
    <p class="muted mt" style="font-size:14px">Gera uma página com o patrimônio, os resultados de cada estratégia e todas as operações — pronta para imprimir ou salvar em PDF (Ctrl+P). Fica salva na sua pasta Documentos.</p></div>
    <button class="btn pri lg" ${A("gerarRelatorio")} data-el>${ic("file")}Gerar relatório</button></div>`;
}
async function gerarRelatorio(b){ const r=await withLoading(b,()=>call("relatorio")); r.ok===false?toast(r.erro,"erro"):toast("Relatório salvo em "+r.caminho,"ok",6000); }

/* ============================================================ TOUR GUIADO */
const PASSOS_TOUR=[
  ["[data-tour=start]","Ligue e desligue aqui","Este é o botão principal. Ligado, o robô trabalha sozinho: lê notícias, baixa preços, ouve os agentes e decide. Ele começa no modo simulado — dinheiro de mentira, preços de verdade."],
  ["[data-tour=status]","Em que etapa ele está","Esta faixa mostra, ao vivo, o que o robô está fazendo agora e quanto falta para a próxima análise. Se o ponto verde estiver piscando, está rodando."],
  ["[data-tour=ativos]","O que ele pensa de cada ativo","Cada linha explica em português: se está esperando sinal (e quanto falta), se comprou, por que não entrou, ou se o mercado está fechado."],
  ["[data-tour=estrategias]","Mais formas de ganhar","Além dos agentes, você liga arbitragem, funding, grid, DCA e pares. Cada uma tem sua aba explicando como funciona e mostrando tudo o que faz."],
  [".nav[data-p*=copiloto]","Pergunte para a IA","O Copiloto responde qualquer dúvida olhando o seu robô: “por que ele não comprou?”, “como deixo mais conservador?”."],
  [".btn.danger","Botão de pânico","Fecha todas as posições na hora e bloqueia novas entradas. Use se algo parecer estranho."],
];
async function tour(){
  if(S.page!=="painel") await go("painel");
  let i=0; const ov=document.createElement("div"); ov.className="tour"; document.body.appendChild(ov);
  const fim=()=>{ ov.remove(); gravarLocal("tour_ok","1"); document.removeEventListener("keydown",k); };
  const k=e=>{ if(e.key==="Escape") fim(); if(e.key==="ArrowRight") prox(1); if(e.key==="ArrowLeft") prox(-1); };
  document.addEventListener("keydown",k);
  function prox(d){ i+=d; if(i<0) i=0; if(i>=PASSOS_TOUR.length) return fim(); mostra(); }
  function mostra(){
    const [sel,tit,txt]=PASSOS_TOUR[i], el=$(sel); if(!el) return prox(1);
    el.scrollIntoView({block:"center",behavior:"smooth"});
    setTimeout(()=>{ const r=el.getBoundingClientRect(), pad=8, abaixo=r.bottom+230<innerHeight;
      ov.innerHTML=`<div class="tour-luz" style="left:${r.left-pad}px;top:${r.top-pad}px;width:${r.width+pad*2}px;height:${r.height+pad*2}px"></div>
        <div class="tour-card" style="left:${Math.min(Math.max(16,r.left),innerWidth-376)}px;top:${abaixo?r.bottom+16:Math.max(16,r.top-216)}px">
          <div class="row"><span class="badge brand">${i+1} de ${PASSOS_TOUR.length}</span><div class="grow"></div><button class="btn sm ghost" id="tSair">Pular</button></div>
          <h3 style="margin-top:10px;font-size:17px">${tit}</h3><p class="muted" style="font-size:13.5px;margin-top:6px">${txt}</p>
          <div class="row mt">${i?`<button class="btn sm" id="tVolta">Voltar</button>`:""}<div class="grow"></div><button class="btn sm pri" id="tProx">${i===PASSOS_TOUR.length-1?"Começar a usar":"Próximo"}</button></div></div>`;
      $("#tSair",ov).onclick=fim; $("#tProx",ov).onclick=()=>prox(1); $("#tVolta",ov)&&($("#tVolta",ov).onclick=()=>prox(-1)); },220);
  }
  mostra();
}
registrarAcoes({trocarGrafico, perguntar, perguntarSug, iaAgora, abrirFerramenta, addAlerta, rmAlerta, salvarTelegram, rmTelegram, gerarRelatorio, tour});
