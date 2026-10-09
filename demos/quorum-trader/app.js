"use strict";
/* ============================================================ utilidades */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const ic = (n, cls="") => `<svg class="i ${cls}"><use href="#i-${n}"/></svg>`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nf2 = new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const money = v => (v<0?"−":"")+"R$ "+nf2.format(Math.abs(v||0));
const signed = v => (v>0?"+":v<0?"−":"")+nf2.format(Math.abs(v||0));
const pct = (v,d=1) => (v>0?"+":"")+(v||0).toFixed(d).replace(".",",")+"%";
function price(v){ if(v==null||isNaN(v)) return "—"; const a=Math.abs(v);
  const d = a>=1000?2: a>=10?3: a>=1?4:5; return new Intl.NumberFormat("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}).format(v); }
function ago(ts){ const s=Math.max(0,Date.now()/1000-ts); if(s<60) return "agora"; if(s<3600) return Math.floor(s/60)+" min"; if(s<86400) return Math.floor(s/3600)+" h"; return Math.floor(s/86400)+" d"; }
const hhmm = ts => new Date(ts*1000).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
const dthr = ts => new Date(ts*1000).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
function setHTML(el, html){ if(el && el._h!==html){ el.innerHTML=html; el._h=html; } }
const cls = v => v>0?"up":v<0?"down":"";
const COR_ATIVO = {cripto:["#F7931A","rgba(247,147,26,.14)"], forex:["#38BDF8","rgba(56,189,248,.13)"], b3:["#22C55E","rgba(34,197,94,.13)"]};
const MERC = {cripto:"Cripto", forex:"Forex", b3:"B3"};
const FONTE = {binance:"Binance", yahoo:"Yahoo Finance", mt5:"MetaTrader 5"};

/* ripple em qualquer botão */
document.addEventListener("pointerdown", e => {
  const b = e.target.closest(".btn"); if(!b) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width,r.height), sp = document.createElement("span");
  sp.className="ripple"; sp.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;
  b.appendChild(sp); setTimeout(()=>sp.remove(),600);
});

/* ============================================================ toasts e modais */
function toast(msg, tipo="info", ms=4200){
  const t=document.createElement("div"); t.className="toast "+tipo;
  const icn = {ok:"check",erro:"alert",aviso:"info",info:"info"}[tipo]||"info";
  t.innerHTML = `${ic(icn)}<div>${esc(msg)}</div>`; $("#toasts").appendChild(t);
  setTimeout(()=>{t.classList.add("out"); setTimeout(()=>t.remove(),300)}, ms);
}
function modal(html, {wide=false, onclose}={}){
  const ov=document.createElement("div"); ov.className="ov";
  ov.innerHTML=`<div class="modal ${wide?"wide":""}">${html}</div>`;
  const close=()=>{ ov.remove(); onclose&&onclose(); document.removeEventListener("keydown",esc_); };
  const esc_ = e=>{ if(e.key==="Escape") close(); };
  ov.addEventListener("mousedown", e=>{ if(e.target===ov) close(); });
  document.addEventListener("keydown", esc_);
  $("#modalRoot").appendChild(ov); ov.close=close;
  setTimeout(()=>{ const f=$("input,textarea,select",ov); f&&f.focus(); },60);
  return ov;
}
function confirmar(titulo, texto, {ok="Confirmar", perigo=false, digitar=null}={}){
  return new Promise(res=>{
    const m = modal(`<h2>${esc(titulo)}</h2><p class="muted">${texto}</p>
      ${digitar?`<div class="field mt"><label>Digite <b style="color:var(--text)">${digitar}</b> para confirmar</label><input class="inp" id="cfTxt" autocomplete="off"></div>`:""}
      <div class="acts"><button class="btn ghost" id="cfN">Cancelar</button><button class="btn ${perigo?"danger":"pri"}" id="cfS">${esc(ok)}</button></div>`,
      {onclose:()=>res(null)});
    $("#cfN",m).onclick=()=>m.close();
    $("#cfS",m).onclick=()=>{ const v=digitar?$("#cfTxt",m).value:true; if(digitar && v.trim().toUpperCase()!==digitar){ $("#cfTxt",m).focus(); $("#cfTxt",m).style.borderColor="var(--down)"; return;} m.remove(); res(v); };
    if(digitar) $("#cfTxt",m).addEventListener("keydown",e=>{ if(e.key==="Enter") $("#cfS",m).click(); });
  });
}
async function withLoading(btn, fn){ btn&&btn.classList.add("loading"); try{ return await fn(); } finally{ btn&&btn.classList.remove("loading"); } }

/* ============================================================ gráficos */
function sparkSVG(vals, up){
  if(!vals||vals.length<2) return `<svg class="spark"></svg>`;
  const w=240,h=46,mn=Math.min(...vals),mx=Math.max(...vals),rg=(mx-mn)||1;
  const pts=vals.map((v,i)=>[i/(vals.length-1)*w, h-4-(v-mn)/rg*(h-8)]);
  const d=pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join("");
  const c= up?"#22C55E":"#F43F5E", id="g"+Math.random().toString(36).slice(2,8);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>
    <path d="${d}L${w} ${h}L0 ${h}Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${c}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
}
function lineChart(wrap, pts, {fmt=money, base=null}={}){
  let cv=$("canvas",wrap), tt=$(".tt",wrap);
  if(!cv){ wrap.innerHTML=`<canvas></canvas><div class="tt"></div>`; cv=$("canvas",wrap); tt=$(".tt",wrap);
    cv.addEventListener("mousemove",e=>{ cv._hx=e.offsetX; draw(); });
    cv.addEventListener("mouseleave",()=>{ cv._hx=null; tt.style.opacity=0; draw(); });
  }
  cv._pts=pts; cv._fmt=fmt; cv._base=base;
  function draw(){
    const P=cv._pts||[], dpr=devicePixelRatio||1, W=cv.clientWidth, H=cv.clientHeight;
    if(cv.width!==W*dpr||cv.height!==H*dpr){ cv.width=W*dpr; cv.height=H*dpr; }
    const g=cv.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
    if(P.length<2){ g.fillStyle="#5C6B7D"; g.font="13px Segoe UI"; g.textAlign="center"; g.fillText("O gráfico aparece após os primeiros ciclos do robô",W/2,H/2); return; }
    const L=64,R=12,T=12,B=26, vs=P.map(p=>p[1]); let mn=Math.min(...vs), mx=Math.max(...vs);
    if(cv._base!=null){ mn=Math.min(mn,cv._base); mx=Math.max(mx,cv._base); }
    const pad=(mx-mn)*.12||Math.abs(mx)*.01||1; mn-=pad; mx+=pad;
    const t0=P[0][0], t1=P[P.length-1][0]||t0+1;
    const X=t=>L+(t-t0)/((t1-t0)||1)*(W-L-R), Y=v=>T+(1-(v-mn)/(mx-mn))*(H-T-B);
    g.font="11px Segoe UI"; g.fillStyle="#5C6B7D"; g.strokeStyle="rgba(255,255,255,.05)"; g.lineWidth=1; g.textAlign="right";
    for(let k=0;k<=4;k++){ const v=mn+(mx-mn)*k/4, y=Y(v); g.beginPath(); g.moveTo(L,y); g.lineTo(W-R,y); g.stroke(); g.fillText(cv._fmt(v).replace("R$ ",""),L-8,y+4); }
    g.textAlign="center";
    for(let k=0;k<=4;k++){ const t=t0+(t1-t0)*k/4; g.fillText(dthr(t),X(t),H-7); }
    const up = vs[vs.length-1] >= (cv._base ?? vs[0]), col= up?"#22C55E":"#F43F5E";
    if(cv._base!=null){ g.setLineDash([4,4]); g.strokeStyle="rgba(255,255,255,.18)"; g.beginPath(); g.moveTo(L,Y(cv._base)); g.lineTo(W-R,Y(cv._base)); g.stroke(); g.setLineDash([]); }
    const grd=g.createLinearGradient(0,T,0,H-B); grd.addColorStop(0,up?"rgba(34,197,94,.25)":"rgba(244,63,94,.25)"); grd.addColorStop(1,"rgba(0,0,0,0)");
    g.beginPath(); P.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));
    g.lineTo(X(t1),H-B); g.lineTo(X(t0),H-B); g.closePath(); g.fillStyle=grd; g.fill();
    g.beginPath(); P.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1]))); g.strokeStyle=col; g.lineWidth=2; g.lineJoin="round"; g.stroke();
    if(cv._hx!=null && cv._hx>=L){
      const t=t0+(cv._hx-L)/(W-L-R)*(t1-t0); let best=P[0]; for(const p of P) if(Math.abs(p[0]-t)<Math.abs(best[0]-t)) best=p;
      const x=X(best[0]), y=Y(best[1]);
      g.strokeStyle="rgba(255,255,255,.25)"; g.beginPath(); g.moveTo(x,T); g.lineTo(x,H-B); g.stroke();
      g.beginPath(); g.arc(x,y,5,0,7); g.fillStyle=col; g.fill(); g.lineWidth=2.5; g.strokeStyle="#0A0E13"; g.stroke();
      tt.innerHTML=`<b class="num">${cv._fmt(best[1])}</b><div class="muted">${dthr(best[0])}</div>`; tt.style.left=x+"px"; tt.style.top=y+"px"; tt.style.opacity=1;
    }
  }
  cv._draw=draw; draw();
}
window.addEventListener("resize",()=>$$("canvas").forEach(c=>c._draw&&c._draw()));


/* ============================================================ eventos (delegação com lista branca, sem JS inline) */
const A = (fn,...a) => `data-a="${fn}"${a.length?` data-p="${esc(JSON.stringify(a))}"`:""}`;
const CH = (fn,...a) => `data-ch="${fn}"${a.length?` data-p="${esc(JSON.stringify(a))}"`:""}`;
function filtrarNews(k){ S.newsFiltro=k; pgNoticias(); }
function copiarIndic(i){ copiar(S.cfg.config.indicacoes[i]?.link); }
function abrirPasta(){ call("abrir_pasta_dados"); }
function abrirSite(caminho){ call("abrir_link",(S.est?.site||"https://quorum-trader.netlify.app")+caminho); }
function atualizarSlider(el){ const mn=+el.min,mx=+el.max; el.style.setProperty("--p",((el.value-mn)/(mx-mn)*100)+"%"); const l=$("#"+el.id+"V"); if(l) l.textContent=String(el.value).replace(".",",")+el.dataset.suf; }
let ACOES = null;
function acoes(){ return ACOES || (ACOES = {toggleRun,panic,go,destravar,fecharPos,cicloAgora,editarAtivo,toggleAtivo,testarAtivo,removerAtivo,addPreset,resetAprendizado,toggleAgente,comprar,
  filtrarNews,atualizarNews,abrir,ordHist,exportar,rodarBT,trocarModo,aplicarPerfil,salvarCampo,salvarCusto,salvarMT5,removerBN,salvarBN,salvarRSS,resetSim,abrirPasta,
  onboarding,removerLic,ativarLic,abrirSite,addIndic,editIndic,copiarIndic,rmIndic}); }
function despachar(el, tipo){
  const fn = acoes()[el.dataset[tipo]]; if(!fn) return;
  let args=[]; try{ args = el.dataset.p ? JSON.parse(el.dataset.p) : []; }catch{ return; }
  if(tipo==="ch") args.push(el.type==="checkbox" ? el.checked : el.hasAttribute("data-num") ? Number(el.value) : el.value);
  if(el.hasAttribute("data-el")) args.push(el);
  fn(...args);
}
document.addEventListener("click", e => { const el=e.target.closest("[data-a]"); if(el && !el.disabled) despachar(el,"a"); });
document.addEventListener("change", e => { const el=e.target.closest("[data-ch]"); if(el) despachar(el,"ch"); });
document.addEventListener("input", e => { if(e.target.matches("input[type=range][data-suf]")) atualizarSlider(e.target); });
document.addEventListener("keydown", e => { if((e.key==="Enter"||e.key===" ") && e.target.matches("[data-a][tabindex]")){ e.preventDefault(); despachar(e.target,"a"); } });

/* ============================================================ API (pywebview ou demonstração) */
let API=null, booted=false;
const call = async (fn,...a) => { try{ return await API[fn](...a); } catch(e){ console.error(fn,e); toast("Erro: "+(e.message||e),"erro"); return {ok:false,erro:String(e)}; } };
function usarDemo(){ if(API) return; API=MockAPI(); document.body.insertAdjacentHTML("beforeend",`<div class="demo-flag">Demonstração interativa · dados simulados</div>`); boot(); }
window.addEventListener("pywebviewready",()=>{ if(API) return; const api=window.pywebview?.api; if(api && typeof api.estado==="function"){ API=api; boot(); } else usarDemo(); });
setTimeout(()=>{ if(!API && !window.pywebview) usarDemo(); }, 700);
setTimeout(()=>{ if(!API) usarDemo(); }, 4000);

/* ============================================================ estado da UI */
const S = {page:"painel", est:null, cfg:null, lastLog:0, logs:[], news:[], newsFiltro:"todas", hist:[], histOrd:["quando",-1], bt:null, btAtivo:null, busy:false};
const PAGES = [
  ["painel","Painel","home","Visão geral do robô em tempo real"],
  ["ativos","Ativos","coins","O que o robô acompanha e opera"],
  ["agentes","Agentes","bot","Quem vota em cada decisão e como estão aprendendo"],
  ["noticias","Notícias","news","Manchetes em tempo real e o sentimento de cada uma"],
  ["historico","Histórico","hist","Todos os trades fechados"],
  ["backtest","Backtest","flask","Teste a estratégia no histórico antes de arriscar"],
  "sep",
  ["config","Configurações","sliders","Risco, estratégia, conexões e notícias"],
  ["licenca","Licença","key","Seu plano e adicionais"],
  ["indique","Indique e ganhe","gift","Comissões por indicação"],
];
function renderNav(){
  setHTML($("#nav"), PAGES.map(p=>p==="sep"?`<div class="nav-sep"></div>`:
    `<div class="nav ${S.page===p[0]?"on":""}" tabindex="0" ${A("go",p[0])}>${ic(p[2])}<span>${p[1]}</span>${
      p[0]==="noticias"&&S.est?`<span class="badge">${S.est.n_noticias}</span>`:""}${p[0]==="painel"&&S.est&&S.est.posicoes.length?`<span class="badge brand">${S.est.posicoes.length}</span>`:""}</div>`).join(""));
}
async function go(p){
  S.page=p; const def=PAGES.find(x=>x[0]===p);
  $("#ttl").textContent=def[1]; $("#sub").textContent=def[3];
  renderNav(); $("#content").innerHTML=`<div class="page" id="pg"></div>`; $("#content").scrollTop=0;
  if(["agentes","ativos","config","licenca","indique","backtest"].includes(p)) S.cfg = await call("config");
  if(p==="noticias") S.news = await call("noticias");
  if(p==="historico") S.hist = await call("historico");
  render(true);
}
document.addEventListener("keydown",e=>{
  if(e.target.matches("input,textarea,select")) return;
  const n=parseInt(e.key); const ps=PAGES.filter(p=>p!=="sep");
  if(e.ctrlKey && n>=1 && n<=ps.length){ e.preventDefault(); go(ps[n-1][0]); }
});

function render(full){
  const f = {painel:pgPainel, ativos:pgAtivos, agentes:pgAgentes, noticias:pgNoticias, historico:pgHistorico,
             backtest:pgBacktest, config:pgConfig, licenca:pgLicenca, indique:pgIndique}[S.page];
  if(full || S.page==="painel") f && f(full);
}

/* ============================================================ topo e loop */
function renderChrome(){
  const e=S.est; if(!e) return;
  const b=$("#btnRun");
  b.className="btn "+(e.rodando?"":"go"); b.innerHTML= e.rodando? `${ic("pause")}Pausar`:`${ic("play")}Iniciar robô`;
  let st="";
  if(e.rodando){
    const p=e.proximo_ciclo, tot=Math.max(1,(S.cfg?.config?.intervalo_ciclo_seg)||60), frac=p==null?0:Math.min(1,p/tot);
    st+=`<span class="badge up" data-tip="O robô analisa todos os ativos a cada ciclo"><span class="dot pulse"></span>Operando · próximo ciclo ${p==null?"…":Math.ceil(p)+"s"}</span>`;
  } else st+=`<span class="badge"><span class="dot"></span>Pausado</span>`;
  st+= e.modo==="real"? `<span class="badge warn">${ic("zap")}MODO REAL</span>` : `<span class="badge brand" data-tip="Nenhuma ordem real é enviada">Simulado</span>`;
  setHTML($("#hdrStatus"),st);
  const L=e.licenca;
  setHTML($("#planCard"),`<div class="row"><div style="flex:1"><b>Plano ${esc(L.plano)}</b><span>${L.plano==="Demonstração"?"Desbloqueie o modo real":esc(L.email)}</span></div>${ic(L.plano==="Pro"?"spark":"key")}</div>`);
  setHTML($("#ver"),`v${e.versao} · ${e.agentes_em_uso.length} agentes ativos · <span class="kbd">Ctrl</span>+<span class="kbd">1–9</span> navega`);
  renderNav();
}
async function tick(){
  if(S.tickando) return; S.tickando=true;
  try{ await tick_(); } finally{ S.tickando=false; }
}
async function tick_(){
  const e = await call("estado", S.lastLog);
  if(!e || e.ok===false) return;
  S.est=e;
  for(const l of e.logs){ S.logs.unshift(l); S.lastLog=Math.max(S.lastLog,l.id);
    if(booted && ["compra","venda","ganho","perda","erro"].includes(l.nivel) && l._new!==false) toast(l.msg, l.nivel==="erro"||l.nivel==="perda"?"erro":l.nivel==="ganho"?"ok":"info"); }
  S.logs=S.logs.slice(0,200);
  renderChrome(); render(false);
}
async function boot(){
  const e = await call("estado",0); S.est=e; e.logs.forEach(l=>{S.logs.unshift(l); S.lastLog=Math.max(S.lastLog,l.id);});
  S.cfg = await call("config");
  renderChrome(); await go("painel"); booted=true;
  setInterval(tick, 1500);
  if(!e.onboarding_ok) onboarding();
}
async function toggleRun(){
  const b=$("#btnRun");
  if(S.est.rodando){ await call("pausar"); toast("Robô pausado","aviso"); }
  else { const r=await withLoading(b,()=>call("iniciar")); if(r.ok===false) return toast(r.erro,"erro"); toast(S.est.modo==="real"?"Robô iniciado em MODO REAL":"Robô iniciado no modo simulado","ok"); }
  tick();
}
async function panic(){
  if(!await confirmar("Acionar pânico?","Todas as posições abertas serão fechadas a mercado agora e o robô não abrirá novas entradas até você liberar.",{ok:"Zerar tudo agora",perigo:true})) return;
  await call("panico"); toast("Tudo zerado. Entradas bloqueadas.","aviso"); tick();
}

/* ============================================================ PAINEL */
function pgPainel(full){
  const e=S.est, pg=$("#pg"); if(!e||!pg) return;
  if(full||!$("#pnK",pg)) pg.innerHTML=`<div id="pnBan"></div><div class="grid g4" id="pnK"></div>
    <div class="grid g-main mt"><div class="card"><div class="hd"><h3>${ic("trend")}Evolução do patrimônio</h3><div class="grow"></div><span class="muted" id="pnCurvaInfo" style="font-size:12px"></span></div><div class="chart-wrap" id="pnChart"></div></div>
    <div class="card col"><div class="hd" style="margin:0"><h3>${ic("zap")}Posições abertas</h3><div class="grow"></div><span id="pnPosN" class="badge"></span></div><div class="col" id="pnPos" style="gap:8px;overflow:auto;max-height:300px"></div></div></div>
    <div class="row mt2 mb"><h3 style="font-size:15px">Ativos monitorados</h3><div class="grow"></div><span class="muted" style="font-size:12px">Passe o mouse para ver o voto de cada agente</span><button class="btn sm" ${A("cicloAgora")} data-el>${ic("refresh")}Analisar agora</button></div>
    <div class="grid" id="pnA" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))"></div>
    <div class="card mt2"><div class="hd"><h3>${ic("hist")}Atividade</h3><div class="grow"></div><span class="muted" style="font-size:12px">Últimos eventos do robô</span></div><div id="pnLog" style="max-height:260px;overflow:auto"></div></div>`;
  let ban="";
  if(e.travado) ban=`<div class="banner trava">${ic("alert")}<div style="flex:1"><b>Entradas bloqueadas</b> — ${e.motivo_trava==="perda"?"limite de perda diária atingido. Libera automaticamente amanhã.":"pânico acionado."}</div><button class="btn sm" ${A("destravar")}>Liberar entradas</button></div>`;
  else if(e.modo==="real") ban=`<div class="banner real">${ic("zap")}<div><b>Modo real ativo.</b> O robô envia ordens de verdade para a corretora. Acompanhe e use o Pânico se precisar.</div></div>`;
  else if(!e.rodando && !e.stats.trades) ban=`<div class="banner sim">${ic("info")}<div style="flex:1"><b>Tudo pronto.</b> Clique em <b>Iniciar robô</b> para começar no modo simulado — com dados reais de mercado e dinheiro fictício.</div><button class="btn sm go" ${A("toggleRun")}>${ic("play")}Iniciar</button></div>`;
  setHTML($("#pnBan"),ban);
  const s=e.stats, real=e.modo==="real";
  setHTML($("#pnK"),[
    kpi(real?"Capital nas corretoras":"Patrimônio", money(e.patrimonio), real?Object.entries(e.capital_real).map(([k,v])=>k.toUpperCase()+": "+nf2.format(v)).join(" · ")||"conecte uma corretora":`Saldo ${money(e.saldo)} · aberto ${signed(e.nao_realizado)}`, "coins","rgba(124,108,255,.2)"),
    kpi("Resultado hoje", `<span class="${cls(e.pnl_dia)}">${signed(e.pnl_dia)}</span>`, "Realizado + em aberto", "trend", e.pnl_dia>=0?"rgba(34,197,94,.2)":"rgba(244,63,94,.2)"),
    kpi("Taxa de acerto", s.trades?nf2.format(s.acerto).replace(",00","")+"%":"—", s.trades?`${s.trades} trades · expectativa ${signed(s.expectativa)}`:"Ainda sem trades fechados", "check","rgba(34,211,238,.18)",
        "Acerto sozinho engana: o que importa é a expectativa\n(ganho médio × acerto − perda média × erro)."),
    kpi("Fator de lucro", s.trades?String(s.fator_lucro).replace(".",","):"—", s.trades?`Drawdown máx. ${nf2.format(s.drawdown)}%`:"Lucro bruto ÷ prejuízo bruto", "shield","rgba(245,165,36,.18)",
        "Acima de 1 = estratégia lucrativa no período.\nDrawdown = maior queda desde um topo."),
  ].join(""));
  const curva=e.curva; lineChart($("#pnChart"), curva, {base: e.modo==="simulado"?(S.cfg?.config?.saldo_inicial_simulado??null):null});
  setHTML($("#pnCurvaInfo"), curva.length? `${curva.length} pontos · desde ${dthr(curva[0][0])}`:"");
  setHTML($("#pnPosN"), String(e.posicoes.length));
  setHTML($("#pnPos"), e.posicoes.length? e.posicoes.map(p=>`<div class="pos"><span class="badge ${p.lado>0?"up":"down"}">${p.lado>0?"COMPRA":"VENDA"}</span>
      <div style="flex:1;min-width:0"><b>${esc(p.ativo)}</b>${p.real?' <span class="badge warn" style="height:18px">REAL</span>':""}<div class="muted num" style="font-size:12px">${price(p.entrada)} → ${price(p.preco)} · stop ${price(p.stop)}</div></div>
      <div style="text-align:right" class="num"><b class="${cls(p.pnl)}">${signed(p.pnl)}</b><div class="${cls(p.pct)}" style="font-size:12px">${pct(p.pct,2)}</div></div>
      <button class="btn sm icon ghost x" data-tip="Fechar agora" ${A("fecharPos",p.ativo)}>${ic("x")}</button></div>`).join("")
    : `<div class="empty">${ic("zap")}<div>Nenhuma posição aberta</div><div class="faint" style="font-size:12px">O robô entra quando os agentes concordam o suficiente</div></div>`);
  const ativos=e.ativos.filter(a=>a.ativo!==false);
  setHTML($("#pnA"), ativos.map(assetCard).join("") || `<div class="card empty" style="grid-column:1/-1">${ic("coins")}<div>Nenhum ativo ligado</div><button class="btn sm pri" ${A("go","ativos")}>Escolher ativos</button></div>`);
  setHTML($("#pnLog"), S.logs.length? S.logs.slice(0,80).map(l=>`<div class="log ${l.nivel}"><time>${hhmm(l.ts)}</time><span class="tag"></span><span>${esc(l.msg)}</span></div>`).join("")
    : `<div class="empty">${ic("hist")}<div>Sem eventos ainda</div></div>`);
}
function kpi(lbl,val,foot,icon,glow,tip){
  return `<div class="card kpi hov" style="--glow:${glow}"><div class="lbl">${ic(icon)}${lbl}${tip?`<span data-tip="${esc(tip)}" class="faint" style="display:inline-flex">${ic("info")}</span>`:""}</div><div class="val num">${val}</div><div class="foot num">${foot}</div></div>`;
}
function assetCard(a){
  const [c,bg]=COR_ATIVO[a.mercado]||COR_ATIVO.forex, sc=a.score??0, has=a.score!=null;
  const lbl = !has?"Aguardando":sc>(S.cfg?.config?.limiar_entrada??.35)?"Compra forte":sc>.1?"Viés de compra":sc<-(S.cfg?.config?.limiar_entrada??.35)?"Venda forte":sc<-.1?"Viés de venda":"Neutro";
  const sig = sc>.1?"up":sc<-.1?"down":"";
  const votos=Object.entries(a.votos||{}).map(([k,v])=>`<div class="vote">${esc(nomeAgente(k))}<div class="b"><i style="${v>=0?`left:50%;width:${v*50}%;background:var(--up)`:`left:${50+v*50}%;width:${-v*50}%;background:var(--down)`}"></i></div></div>`).join("");
  return `<div class="card asset hov ${a.liberado?"":"locked"}">
    <div class="top"><div class="ic" style="background:${bg};color:${c}">${esc(sigla(a.nome))}</div>
      <div style="flex:1;min-width:0"><b>${esc(a.nome)}</b><div class="muted" style="font-size:12px">${MERC[a.mercado]} · ${esc(a.origem||FONTE[a.fonte])}</div></div>
      <span class="badge ${a.aberto?"up":""}" data-tip="${esc(a.status)}"><span class="dot"></span>${a.aberto?"Aberto":"Fechado"}</span></div>
    ${a.liberado?`<div class="row" style="align-items:baseline"><div class="px num ${has?"":"skel"}">${has?price(a.preco):"000000"}</div><div class="grow"></div><span class="num ${cls(a.variacao)}" style="font-weight:600">${a.variacao!=null?pct(a.variacao,2):""}</span></div>
    ${sparkSVG(a.spark,(a.variacao||0)>=0)}
    <div class="meter"><i style="left:${50+sc*50}%"></i></div><div class="meter-l"><span>Venda</span><b class="${sig}" style="text-transform:none;font-size:12px">${lbl}${has?` · ${(sc*100).toFixed(0)}`:""}</b><span>Compra</span></div>
    ${a.posicao?`<div class="row mt" style="margin-top:10px"><span class="badge ${a.posicao.lado>0?"up":"down"}">${a.posicao.lado>0?"Comprado":"Vendido"}</span><span class="num ${cls(a.posicao.pnl)}" style="font-weight:600">${signed(a.posicao.pnl)}</span></div>`:""}
    <div class="votes">${votos||'<span class="faint" style="font-size:12px">Votos aparecem após o 1º ciclo</span>'}</div>`
    :`<div class="empty" style="padding:18px 0 4px">${ic("lock")}<div style="font-size:12.5px">Fora do limite de ativos do seu plano</div><button class="btn sm" ${A("go","licenca")}>Ver planos</button></div>`}
  </div>`;
}
const AG_NOMES={tendencia:"Tendência",reversao:"Reversão",rompimento:"Rompimento",momento:"Momento",noticias:"Notícias",macd:"MACD",bollinger:"Bollinger"};
const nomeAgente = k => AG_NOMES[k]||k;
const sigla = n => { const m=/\(([A-Za-z]{2,4})\)/.exec(n); return (m?m[1]:n.replace(/[^A-Za-z]/g,"").slice(0,3)).toUpperCase(); };
async function fecharPos(n){ if(!await confirmar("Fechar posição?",`A posição em <b>${esc(n)}</b> será encerrada a mercado agora.`,{ok:"Fechar posição"})) return; const r=await call("fechar_posicao",n); r.ok===false?toast(r.erro,"erro"):toast("Posição fechada","ok"); tick(); }
async function destravar(){ await call("destravar"); toast("Entradas liberadas","ok"); tick(); }
async function cicloAgora(b){ await withLoading(b,()=>call("ciclo_agora")); toast("Análise solicitada — resultados em alguns segundos"); setTimeout(tick,2500); }

/* ============================================================ ATIVOS */
function pgAtivos(){
  const C=S.cfg.config, lim=S.est.licenca.max_ativos, ligados=C.ativos.filter(a=>a.ativo!==false).length;
  $("#pg").innerHTML=`<div class="row mb"><div><b>${ligados}</b> <span class="muted">de ${lim>=999?"ilimitados":lim} ativos do seu plano em uso</span></div><div class="grow"></div>
    <button class="btn" ${A("editarAtivo",-1)}>${ic("plus")}Ativo personalizado</button></div>
    <div class="card"><table><thead><tr><th>Ativo</th><th>Mercado</th><th>Fonte de dados</th><th>Símbolo</th><th>Lote máx. (real)</th><th>Ligado</th><th></th></tr></thead><tbody>
    ${C.ativos.map((a,i)=>`<tr><td><b>${esc(a.nome)}</b>${i>=lim?' <span class="badge warn">fora do plano</span>':""}</td><td><span class="badge">${MERC[a.mercado]}</span></td><td>${FONTE[a.fonte]}${a.reserva?`<div class="faint" style="font-size:11.5px">reserva: ${esc(a.reserva)}</div>`:""}</td>
      <td class="num">${esc(a.simbolo)}</td><td class="num">${a.lote_max}</td>
      <td><label class="sw"><input type="checkbox" ${a.ativo!==false?"checked":""} ${CH("toggleAtivo",i)}><span></span></label></td>
      <td style="text-align:right;white-space:nowrap"><button class="btn sm icon ghost" data-tip="Testar conexão" ${A("testarAtivo",i)} data-el>${ic("plug")}</button><button class="btn sm icon ghost" data-tip="Editar" ${A("editarAtivo",i)}>${ic("edit")}</button><button class="btn sm icon ghost" data-tip="Remover" ${A("removerAtivo",i)}>${ic("trash")}</button></td></tr>`).join("")}
    </tbody></table></div>
    <h3 class="mt2 mb" style="font-size:15px">Adicionar da biblioteca</h3>
    <div class="grid g4">${S.cfg.presets.filter(p=>!C.ativos.some(a=>a.nome===p.nome)).map(p=>{const [c,bg]=COR_ATIVO[p.mercado];return `<div class="card hov row" style="padding:14px;cursor:pointer" ${A("addPreset",p.nome)}>
      <div class="ic" style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:${bg};color:${c};font-weight:800;font-size:11px">${esc(sigla(p.nome))}</div>
      <div style="flex:1"><b>${esc(p.nome)}</b><div class="muted" style="font-size:12px">${MERC[p.mercado]} · ${FONTE[p.fonte]}</div></div>${ic("plus")}</div>`}).join("")||'<div class="muted">Todos os ativos da biblioteca já foram adicionados.</div>'}</div>
    <div class="card mt2 row" style="gap:14px">${ic("info")}<div class="muted" style="font-size:13px"><b style="color:var(--text)">Como funciona a execução real:</b> ativos com fonte <b>MetaTrader 5</b> enviam ordens pela sua corretora no MT5 (XP para B3; uma corretora de forex com MT5 para pares de moedas — use a fonte MT5 com o símbolo dela, ex.: EURUSD). Ativos com fonte <b>Binance</b> operam na sua conta Spot (somente comprado). Ativos com fonte Yahoo ficam apenas em simulação.</div></div>`;
}
async function salvarAtivos(lista){ const r=await call("salvar_config",{ativos:lista}); if(r.ok===false){ toast(r.erro,"erro"); return false;} S.cfg=await call("config"); return true; }
async function toggleAtivo(i,v){ const l=structuredClone(S.cfg.config.ativos); l[i].ativo=v; if(await salvarAtivos(l)) { toast(v?"Ativo ligado":"Ativo desligado","ok"); pgAtivos(); } }
async function removerAtivo(i){ const a=S.cfg.config.ativos[i]; if(!await confirmar("Remover ativo?",`<b>${esc(a.nome)}</b> sairá da lista (posições abertas nele continuam até fechar).`,{ok:"Remover",perigo:true})) return; const l=structuredClone(S.cfg.config.ativos); l.splice(i,1); if(await salvarAtivos(l)){ toast("Ativo removido","ok"); pgAtivos(); } }
async function addPreset(n){ const p=S.cfg.presets.find(x=>x.nome===n); const l=structuredClone(S.cfg.config.ativos); l.push({...p,ativo:true,lote_max:1}); if(await salvarAtivos(l)){ toast(n+" adicionado","ok"); pgAtivos(); } }
async function testarAtivo(i,b){ const r=await withLoading(b,()=>call("testar_ativo",S.cfg.config.ativos[i])); r.ok?toast(`${S.cfg.config.ativos[i].nome}: ${price(r.preco)} via ${r.origem} (${r.barras} barras)`,"ok"):toast(r.erro,"erro"); }
function editarAtivo(i){
  const a = i>=0? S.cfg.config.ativos[i] : {nome:"",fonte:"mt5",simbolo:"",mercado:"forex",reserva:"",palavras:[],ativo:true,lote_max:1};
  const m=modal(`<h2>${i>=0?"Editar ativo":"Novo ativo"}</h2><p class="muted mb">Defina de onde vêm os dados e como o robô reconhece notícias sobre ele.</p>
   <div class="grid g2"><div class="field"><label>Nome</label><input class="inp" id="eaNome" value="${esc(a.nome)}" placeholder="Ex.: EUR/USD"></div>
   <div class="field"><label>Símbolo</label><input class="inp" id="eaSim" value="${esc(a.simbolo)}" placeholder="Ex.: EURUSD, WIN$N, BTCUSDT"></div>
   <div class="field"><label>Fonte de dados / execução</label><select class="inp" id="eaFonte">${Object.entries(FONTE).map(([k,v])=>`<option value="${k}" ${a.fonte===k?"selected":""}>${v}</option>`).join("")}</select></div>
   <div class="field"><label>Mercado (define o horário)</label><select class="inp" id="eaMerc">${Object.entries(MERC).map(([k,v])=>`<option value="${k}" ${a.mercado===k?"selected":""}>${v}</option>`).join("")}</select></div>
   <div class="field"><label>Símbolo reserva (Yahoo) <span class="faint">opcional</span></label><input class="inp" id="eaRes" value="${esc(a.reserva||"")}" placeholder="Usado se o MT5 estiver fechado"></div>
   <div class="field"><label>Lote máximo no modo real</label><input class="inp" id="eaLote" type="number" min="0.01" step="0.01" value="${a.lote_max||1}"></div></div>
   <div class="field mt"><label>Palavras-chave para notícias <span class="faint">separadas por vírgula</span></label><input class="inp" id="eaPal" value="${esc((a.palavras||[]).join(", "))}"></div>
   <div class="acts"><button class="btn ghost" id="eaT">${ic("plug")}Testar</button><div class="grow"></div><button class="btn ghost" id="eaN">Cancelar</button><button class="btn pri" id="eaS">Salvar</button></div>`);
  const ler=()=>({nome:$("#eaNome",m).value.trim(),simbolo:$("#eaSim",m).value.trim(),fonte:$("#eaFonte",m).value,mercado:$("#eaMerc",m).value,reserva:$("#eaRes",m).value.trim(),
    lote_max:parseFloat($("#eaLote",m).value)||1,palavras:$("#eaPal",m).value.split(",").map(s=>s.trim().toLowerCase()).filter(Boolean),ativo:a.ativo!==false});
  $("#eaN",m).onclick=()=>m.close();
  $("#eaT",m).onclick=async e=>{ const r=await withLoading(e.currentTarget,()=>call("testar_ativo",ler())); r.ok?toast(`Funcionou: ${price(r.preco)} via ${r.origem}`,"ok"):toast(r.erro,"erro"); };
  $("#eaS",m).onclick=async()=>{ const v=ler(); if(!v.nome||!v.simbolo) return toast("Preencha nome e símbolo","aviso");
    const l=structuredClone(S.cfg.config.ativos); i>=0?l[i]=v:l.push(v); if(await salvarAtivos(l)){ m.close(); toast("Ativo salvo","ok"); pgAtivos(); } };
}

/* ============================================================ AGENTES */
function pgAgentes(){
  const C=S.cfg, ativos=S.est.ativos.map(a=>a.nome);
  $("#pg").innerHTML=`<div class="card row mb" style="gap:14px;background:linear-gradient(120deg,rgba(124,108,255,.12),rgba(34,211,238,.04))">${ic("spark")}
    <div style="flex:1"><b>Como os agentes decidem juntos</b><div class="muted" style="font-size:13px">Cada agente dá um voto de −100 (venda) a +100 (compra). O robô soma os votos ponderados pelo peso de cada um e só entra quando o consenso passa do limiar (${Math.round(C.config.limiar_entrada*100)}). A cada hora ele confere quem acertou a direção: quem acerta ganha peso, quem erra perde — separadamente em cada ativo.</div></div>
    <button class="btn sm" ${A("resetAprendizado")}>${ic("refresh")}Reiniciar aprendizado</button></div>
  <div class="grid g3">${C.agentes.map(g=>{
    let tot=0,ac=0; for(const n of ativos){ const p=C.acertos[n]?.[g.id]; if(p){ac+=p[0];tot+=p[1];} }
    const pesos=ativos.map(n=>[n,C.pesos[n]?.[g.id]??1]);
    return `<div class="card hov agent ${g.liberado?"":"locked"}" style="position:relative"><div class="body">
      <div class="row"><div class="ico">${ic(g.icone)}</div><div style="flex:1"><b style="font-size:15px">${esc(g.nome)}</b><div class="muted" style="font-size:12px">${g.addon?"Adicional":"Incluso em todos os planos"}</div></div>
      <label class="sw" data-tip="${g.ligado?"Desligar":"Ligar"} este agente"><input type="checkbox" ${g.ligado&&g.liberado?"checked":""} ${g.liberado?"":"disabled"} ${CH("toggleAgente",g.id)}><span></span></label></div>
      <p class="muted mt" style="font-size:13px;min-height:38px">${esc(g.desc)}</p>
      <div class="row mt" style="font-size:12.5px"><span class="muted">Acerto de direção (1h)</span><div class="grow"></div><b class="num">${tot?Math.round(ac/tot*100)+"%":"—"}</b><span class="faint num">${tot?`(${tot})`:""}</span></div>
      <div class="bar" style="margin-top:6px"><i style="width:${tot?ac/tot*100:0}%"></i></div>
      <div class="muted mt" style="font-size:12px">Peso por ativo</div>
      ${pesos.map(([n,w])=>`<div class="row" style="font-size:12px;margin-top:6px"><span style="width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n)}</span><div class="bar" style="flex:1"><i style="width:${Math.min(100,w/5*100)}%"></i></div><b class="num" style="width:36px;text-align:right">${w.toFixed(2)}</b></div>`).join("")}
    </div>${g.liberado?"":`<div class="lock-ov">${ic("lock")}<b>Agente adicional</b><button class="btn sm pri" ${A("comprar",g.addon)}>${ic("unlock")}Desbloquear</button></div>`}</div>`;}).join("")}</div>`;
}
async function toggleAgente(id,v){
  const lst=new Set(S.cfg.config.agentes_ativos); v?lst.add(id):lst.delete(id);
  const r=await call("salvar_config",{agentes_ativos:[...lst]}); if(r.ok===false) return toast(r.erro,"erro");
  S.cfg=await call("config"); toast(`Agente ${nomeAgente(id)} ${v?"ligado":"desligado"}`,"ok");
}
async function resetAprendizado(){ if(!await confirmar("Reiniciar aprendizado?","Todos os pesos voltam a 1,00 e o histórico de acertos dos agentes é apagado.",{ok:"Reiniciar",perigo:true})) return; await call("resetar_aprendizado"); S.cfg=await call("config"); pgAgentes(); toast("Aprendizado reiniciado","ok"); }

/* ============================================================ NOTÍCIAS */
function pgNoticias(){
  const N=S.news||[], f=S.newsFiltro, nomes=[...new Set(N.flatMap(n=>n.ativos))];
  const lst=N.filter(n=>f==="todas"||(f==="pos"&&n.score>0)||(f==="neg"&&n.score<0)||n.ativos.includes(f));
  const pos=N.filter(n=>n.score>0).length, neg=N.filter(n=>n.score<0).length;
  $("#pg").innerHTML=`<div class="grid g3 mb">${kpi("Manchetes (12h)",N.length,"De "+(S.cfg?.config?.rss?.length||"várias")+" fontes RSS","news","rgba(56,189,248,.18)")}
    ${kpi("Positivas",`<span class="up">${pos}</span>`,"Tendem a favorecer compra","trend","rgba(34,197,94,.18)")}${kpi("Negativas",`<span class="down">${neg}</span>`,"Tendem a favorecer venda","alert","rgba(244,63,94,.18)")}</div>
    <div class="row mb wrap"><div class="chips">${[["todas","Todas"],["pos","Positivas"],["neg","Negativas"],...nomes.map(n=>[n,n])].map(([k,v])=>`<button class="chip ${f===k?"on":""}" ${A("filtrarNews",k)}>${esc(v)}</button>`).join("")}</div>
    <div class="grow"></div><button class="btn sm" ${A("atualizarNews")} data-el>${ic("refresh")}Atualizar</button></div>
    <div class="card" style="padding:8px">${lst.length?lst.map(n=>`<div class="news" tabindex="0" ${A("abrir",n.link)}><div class="s ${n.score>0?"p":n.score<0?"n":""}"></div><div style="flex:1"><h4>${esc(n.titulo)}</h4>
      <div class="row wrap" style="margin-top:6px;gap:6px"><span class="faint" style="font-size:12px">${esc(n.fonte)} · ${ago(n.ts)}</span>${n.ativos.map(a=>`<span class="badge brand">${esc(a)}</span>`).join("")}
      <span class="badge ${n.score>0?"up":n.score<0?"down":""}">${n.score>0?"Positiva":n.score<0?"Negativa":"Neutra"}</span></div></div><span class="faint">${ic("ext")}</span></div>`).join("")
      :`<div class="empty">${ic("news")}<div>Nenhuma notícia${f!=="todas"?" com esse filtro":" ainda — clique em Atualizar"}</div></div>`}</div>`;
}
async function atualizarNews(b){ const r=await withLoading(b,()=>call("atualizar_noticias")); S.news=await call("noticias"); pgNoticias(); toast(`${r.novos||0} novas manchetes`,"ok"); }
function abrir(u){ if(u) call("abrir_link",u); }

/* ============================================================ HISTÓRICO */
function pgHistorico(){
  const H=[...(S.hist||[])], [k,d]=S.histOrd, s=S.est.stats;
  H.sort((a,b)=>(a[k]>b[k]?1:a[k]<b[k]?-1:0)*d);
  $("#pg").innerHTML=`<div class="grid g4 mb">${kpi("Resultado total",`<span class="${cls(s.pnl_total)}">${signed(s.pnl_total)}</span>`,`${s.trades} trades fechados`,"coins","rgba(124,108,255,.2)")}
    ${kpi("Ganho médio",`<span class="up">${signed(s.ganho_medio)}</span>`,`Melhor: ${signed(s.melhor)}`,"trend","rgba(34,197,94,.18)")}
    ${kpi("Perda média",`<span class="down">${signed(s.perda_media)}</span>`,`Pior: ${signed(s.pior)}`,"alert","rgba(244,63,94,.18)")}
    ${kpi("Expectativa por trade",`<span class="${cls(s.expectativa)}">${signed(s.expectativa)}</span>`,"Positiva = estratégia com vantagem","shield","rgba(245,165,36,.18)")}</div>
    <div class="row mb"><span class="muted">${H.length} operações · modo ${S.est.modo}</span><div class="grow"></div><button class="btn sm" ${A("exportar")} data-el>${ic("down")}Exportar CSV</button></div>
    <div class="card" style="padding:6px 6px">${H.length?`<table><thead><tr>${[["ativo","Ativo"],["lado","Lado"],["entrada","Entrada"],["saida","Saída"],["pnl","Resultado"],["pct","Variação"],["motivo","Motivo"],["quando","Fechado em"]].map(([c,t])=>`<th ${A("ordHist",c)}>${t}${k===c?(d>0?" ↑":" ↓"):""}</th>`).join("")}</tr></thead><tbody>
      ${H.map(t=>`<tr><td><b>${esc(t.ativo)}</b>${t.real?' <span class="badge warn">REAL</span>':""}</td><td><span class="badge ${t.lado>0?"up":"down"}">${t.lado>0?"Compra":"Venda"}</span></td><td class="num">${price(t.entrada)}</td><td class="num">${price(t.saida)}</td>
      <td class="num ${cls(t.pnl)}"><b>${signed(t.pnl)}</b></td><td class="num ${cls(t.pct)}">${pct(t.pct,2)}</td><td><span class="badge">${esc(t.motivo)}</span></td><td class="muted num">${new Date(t.quando).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td></tr>`).join("")}</tbody></table>`
      :`<div class="empty">${ic("hist")}<div>Nenhum trade fechado ainda</div><div class="faint" style="font-size:12px">Inicie o robô e acompanhe as operações aqui</div></div>`}</div>`;
}
function ordHist(c){ S.histOrd = S.histOrd[0]===c? [c,-S.histOrd[1]] : [c,-1]; pgHistorico(); }
async function exportar(b){ const r=await withLoading(b,()=>call("exportar_csv")); r.ok?toast("Planilha salva em "+r.caminho,"ok",6000):toast(r.erro,"erro"); }

/* ============================================================ BACKTEST */
function pgBacktest(){
  const AT=S.cfg.config.ativos; S.btAtivo = S.btAtivo || AT[0]?.nome;
  const r=S.bt;
  $("#pg").innerHTML=`<div class="card row wrap" style="gap:14px"><div class="field" style="min-width:240px"><label>Ativo</label><select class="inp" id="btSel">${AT.map(a=>`<option ${a.nome===S.btAtivo?"selected":""}>${esc(a.nome)}</option>`).join("")}</select></div>
    <div class="muted" style="flex:1;font-size:13px;min-width:260px">Roda os agentes liberados em todo o histórico disponível (até ~4.000 barras de ${S.cfg.config.timeframe_min} min) com as suas regras de risco, stop, alvo e custos — e com o aprendizado de pesos ligado. O agente de notícias fica de fora (não há manchetes históricas).</div>
    <button class="btn pri" id="btGo" ${A("rodarBT")} data-el>${ic("flask")}Rodar backtest</button></div>
    <div id="btRes" class="mt">${r?btHTML(r):`<div class="card empty">${ic("flask")}<div>Escolha um ativo e rode o backtest</div><div class="faint" style="font-size:12px">Leva de 5 a 30 segundos</div></div>`}</div>`;
  $("#btSel").onchange=e=>S.btAtivo=e.target.value;
  if(r) lineChart($("#btChart"), r.curva, {base:10000});
}
function btHTML(r){
  return `<div class="grid g4">${kpi("Retorno do robô",`<span class="${cls(r.retorno_pct)}">${pct(r.retorno_pct,2)}</span>`,`Comprar e segurar: ${pct(r.buy_hold_pct,2)}`,"trend","rgba(124,108,255,.2)")}
    ${kpi("Trades",r.trades,`Acerto ${nf2.format(r.acerto)}%`,"zap","rgba(34,211,238,.18)")}
    ${kpi("Fator de lucro",String(r.fator_lucro).replace(".",","),`Expectativa ${signed(r.expectativa)} / trade`,"shield","rgba(245,165,36,.18)")}
    ${kpi("Drawdown máximo",`<span class="down">${nf2.format(r.drawdown)}%</span>`,"Maior queda desde um topo","alert","rgba(244,63,94,.18)")}</div>
    <div class="card mt"><div class="hd"><h3>${ic("trend")}Curva de capital simulada (base 10.000)</h3><div class="grow"></div><span class="muted" style="font-size:12px">${r.barras} barras · ${dthr(r.inicio)} → ${dthr(r.fim)} · fonte ${esc(r.origem)}</span></div><div class="chart-wrap" id="btChart"></div></div>
    <div class="grid g2 mt"><div class="card"><h3>${ic("bot")}Pesos aprendidos no período</h3>${Object.entries(r.pesos).map(([k,w])=>`<div class="row" style="font-size:12.5px;margin-top:10px"><span style="width:100px">${nomeAgente(k)}</span><div class="bar" style="flex:1"><i style="width:${Math.min(100,w/5*100)}%"></i></div><b class="num" style="width:40px;text-align:right">${w.toFixed(2)}</b></div>`).join("")}</div>
    <div class="card"><h3>${ic("info")}Como ler</h3><p class="muted mt" style="font-size:13px">Backtest mostra como as regras <b>teriam</b> se comportado no passado, já descontando os custos por mercado definidos em Configurações. Resultado passado não garante resultado futuro. Prefira estratégias com fator de lucro acima de 1,2, drawdown que você aguentaria emocionalmente e que funcionem em vários ativos — não só em um.</p></div></div>`;
}
async function rodarBT(b){
  const res = await withLoading(b,()=>call("backtest",S.btAtivo));
  if(res.ok===false) return toast(res.erro,"erro");
  S.bt=res.resultado; pgBacktest(); toast("Backtest concluído","ok");
}

/* ============================================================ CONFIGURAÇÕES */
const PERFIS={conservador:{risco_por_trade_pct:.5,perda_max_dia_pct:2,max_posicoes:2,limiar_entrada:.6},moderado:{risco_por_trade_pct:1,perda_max_dia_pct:3,max_posicoes:4,limiar_entrada:.5},arrojado:{risco_por_trade_pct:2,perda_max_dia_pct:5,max_posicoes:6,limiar_entrada:.4}};
function slider(id,lbl,v,min,max,step,suf,help){
  const p=(v-min)/(max-min)*100;
  return `<div class="field"><label>${lbl}<b class="num" id="${id}V" style="color:var(--text)">${String(v).replace(".",",")}${suf}</b></label>
  <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}" style="--p:${p}%" data-suf="${suf}" ${CH("salvarCampo",id)} data-num>
  ${help?`<span class="help">${help}</span>`:""}</div>`;
}
function pgConfig(){
  const C=S.cfg.config, e=S.est, L=e.licenca;
  $("#pg").innerHTML=`
  <div class="card"><div class="hd"><h3>${ic("zap")}Modo de operação</h3></div>
    <div class="row wrap" style="gap:18px"><div class="seg"><button class="${e.modo_cfg==="simulado"?"on":""}" ${A("trocarModo","simulado")}>Simulado</button><button class="${e.modo_cfg==="real"?"on real":""}" ${A("trocarModo","real")}>${L.real?"":ic("lock")} Real</button></div>
    <div class="muted" style="flex:1;font-size:13px;min-width:280px">${e.modo==="real"?"<b class='warn'>Ordens reais estão sendo enviadas.</b> Volte ao simulado a qualquer momento.":"No simulado o robô usa dados reais de mercado com dinheiro fictício. Recomendamos algumas semanas aqui antes de ir para o real."}</div></div></div>

  <div class="grid g2 mt"><div class="card"><div class="hd"><h3>${ic("shield")}Gestão de risco</h3></div>
      <div class="row mb" style="margin-top:-4px"><span class="muted" style="font-size:12.5px">Perfil rápido:</span><div class="chips">${Object.keys(PERFIS).map(k=>`<button class="chip" ${A("aplicarPerfil",k)}>${k[0].toUpperCase()+k.slice(1)}</button>`).join("")}</div></div>
    <div class="col" style="gap:20px">${slider("risco_por_trade_pct","Risco por operação",C.risco_por_trade_pct,.1,5,.1,"%","Quanto do capital você aceita perder se o stop for atingido.")}
    ${slider("perda_max_dia_pct","Perda máxima por dia",C.perda_max_dia_pct,.5,20,.5,"%","Ao atingir, o robô para de abrir posições até o dia seguinte.")}
    ${slider("max_posicoes","Posições simultâneas",C.max_posicoes,1,20,1,"","")}
    <div class="row"><div style="flex:1"><b>Retomar sozinho ao abrir o app</b><div class="help">Se o PC reiniciar, o robô volta a operar assim que o app abrir (se estava ligado).</div></div><label class="sw"><input type="checkbox" ${C.iniciar_automatico?"checked":""} ${CH("salvarCampo","iniciar_automatico")}><span></span></label></div>
    <div class="row"><div style="flex:1"><b>Fechar no fim do pregão (B3)</b><div class="help">Zera mini índice/dólar às 18h15 — evita carregar de um dia pro outro.</div></div><label class="sw"><input type="checkbox" ${C.fechar_fim_pregao?"checked":""} ${CH("salvarCampo","fechar_fim_pregao")}><span></span></label></div></div></div>

  <div class="card"><div class="hd"><h3>${ic("sliders")}Estratégia</h3></div><div class="col" style="gap:20px">
    ${slider("limiar_entrada","Consenso mínimo para entrar",C.limiar_entrada,.05,.95,.01,"","Mais alto = menos trades, mais seletivos.")}
    ${slider("stop_atr","Distância do stop (× ATR)",C.stop_atr,.5,6,.1,"×","ATR mede a volatilidade média; stop acompanha o “humor” do ativo.")}
    ${slider("alvo_rr","Alvo (× risco)",C.alvo_rr,.5,6,.1,"×","2× = busca ganhar o dobro do que arrisca.")}
    <div class="grid g2"><div class="field"><label>Tempo gráfico</label><select class="inp" ${CH("salvarCampo","timeframe_min")} data-num>${[1,5,15,30,60].map(t=>`<option value="${t}" ${C.timeframe_min==t?"selected":""}>${t} minuto${t>1?"s":""}</option>`).join("")}</select></div>
    <div class="field"><label>Analisar a cada</label><select class="inp" ${CH("salvarCampo","intervalo_ciclo_seg")} data-num>${[30,60,120,300,900].map(t=>`<option value="${t}" ${C.intervalo_ciclo_seg==t?"selected":""}>${t<60?t+" segundos":t/60+" min"}</option>`).join("")}</select></div>
    <div class="field"><label>Stop móvel (trailing)</label><div class="row" style="height:40px"><label class="sw"><input type="checkbox" ${C.trailing?"checked":""} ${CH("salvarCampo","trailing")}><span></span></label><span class="muted" style="font-size:12.5px">Protege o lucro</span></div></div>
    <div class="field"><label>Filtro de tendência</label><div class="row" style="height:40px"><label class="sw"><input type="checkbox" ${C.filtro_tendencia?"checked":""} ${CH("salvarCampo","filtro_tendencia")}><span></span></label><span class="muted" style="font-size:12.5px" data-tip="Só compra acima da média de 100 barras
e só vende abaixo dela.">Não opera contra a maré</span></div></div></div>
    <div class="field"><label>Custo estimado por lado na simulação <span class="faint">taxa + spread, em %</span></label><div class="grid g3" style="gap:10px">${Object.entries(MERC).map(([k,v])=>`<div class="row" style="gap:8px"><span class="badge" style="width:56px;justify-content:center">${v}</span><input class="inp num" type="number" step="0.001" min="0" max="1" value="${C.custos?.[k]??0}" ${CH("salvarCusto",k)}></div>`).join("")}</div></div></div></div></div>

  <div class="grid g2 mt"><div class="card"><div class="hd"><h3>${ic("plug")}MetaTrader 5 (XP · B3 · Forex)</h3><div class="grow"></div><span class="badge ${e.mt5.ok?"up":""}"><span class="dot"></span>${e.mt5.ok?"Conectado":"Desconectado"}</span></div>
    <div class="grid g2"><div class="field"><label>Login (número da conta)</label><input class="inp" id="m5L" value="${C.mt5.login||""}" inputmode="numeric"></div>
    <div class="field"><label>Senha</label><input class="inp" id="m5P" type="password" value="${C.mt5.senha}" autocomplete="off"></div>
    <div class="field"><label>Servidor</label><input class="inp" id="m5S" value="${esc(C.mt5.servidor)}" placeholder="XPMT5-PRD"></div>
    <div class="field"><label>Caminho do terminal <span class="faint">opcional</span></label><input class="inp" id="m5C" value="${esc(C.mt5.caminho_terminal)}" placeholder="C:\\Program Files\\...\\terminal64.exe"></div></div>
    <p class="help mt">Deixe o MetaTrader 5 instalado e com “Algo Trading” habilitado. A senha fica criptografada no seu Windows (DPAPI) e nunca sai do computador.${e.mt5.info?`<br><b style="color:var(--text)">${esc(e.mt5.info)}</b>`:""}</p>
    <div class="row mt"><div class="grow"></div><button class="btn pri" ${A("salvarMT5")} data-el>${ic("plug")}Conectar e salvar</button></div></div>

  <div class="card"><div class="hd"><h3>${ic("plug")}Binance (cripto)</h3><div class="grow"></div><span class="badge ${e.binance_ok?"up":""}"><span class="dot"></span>${e.binance_ok?"Configurada":"Não configurada"}</span></div>
    <div class="field"><label>API Key</label><input class="inp" id="bnK" value="${esc(C.binance.api_key)}" autocomplete="off"></div>
    <div class="field mt"><label>Secret Key</label><input class="inp" id="bnS" type="password" value="${C.binance.api_secret}" autocomplete="off"></div>
    <p class="help mt">Crie a chave em Binance → Gerenciamento de API com <b>apenas “Spot Trading”</b> e <b>sem permissão de saque</b>. Restrinja ao IP do seu PC. Só é usada no modo real — o simulado usa dados públicos.</p>
    <div class="row mt">${e.binance_ok?`<button class="btn ghost" ${A("removerBN")}>${ic("trash")}Remover</button>`:""}<div class="grow"></div><button class="btn pri" ${A("salvarBN")} data-el>${ic("check")}Testar e salvar</button></div></div></div>

  <div class="grid g2 mt"><div class="card"><div class="hd"><h3>${ic("news")}Fontes de notícias (RSS)</h3></div>
    <textarea class="inp" id="rssT" rows="7">${esc(C.rss.join("\n"))}</textarea><p class="help mt">Um link de feed RSS por linha.</p>
    <div class="row mt"><div class="grow"></div><button class="btn" ${A("salvarRSS")} data-el>${ic("check")}Salvar fontes</button></div></div>
  <div class="card"><div class="hd"><h3>${ic("flask")}Simulação e dados</h3></div>
    <div class="field"><label>Saldo inicial do simulado (R$)</label><input class="inp" id="simS" type="number" min="100" step="100" value="${C.saldo_inicial_simulado}"></div>
    <div class="row mt wrap"><button class="btn" ${A("resetSim")} data-el>${ic("refresh")}Reiniciar simulação</button><button class="btn ghost" ${A("abrirPasta")}>${ic("folder")}Abrir pasta de dados</button>
    <button class="btn ghost" ${A("onboarding")}>${ic("spark")}Refazer configuração guiada</button></div>
    <p class="help mt">Seus dados ficam só no seu computador. Ao reiniciar a simulação, o histórico simulado é apagado; o aprendizado dos agentes é mantido.</p></div></div>`;
}
async function salvarCampo(k,v){ const r=await call("salvar_config",{[k]:v}); if(r.ok===false) return toast(r.erro,"erro"); S.cfg=await call("config"); toast("Configuração salva","ok",1800); }
async function salvarCusto(k,v){ const c={...(S.cfg.config.custos||{}),[k]:v}; await salvarCampo("custos",c); }
async function aplicarPerfil(p){ const r=await call("salvar_config",PERFIS[p]); if(r.ok===false) return toast(r.erro,"erro"); S.cfg=await call("config"); pgConfig(); toast("Perfil "+p+" aplicado","ok"); }
async function trocarModo(m){
  const e=S.est; if(m===e.modo_cfg) return;
  if(m==="real"){
    if(!e.licenca.real){ comprar("essencial"); return toast("O modo real faz parte dos planos Essencial e Pro","aviso"); }
    const v=await confirmar("Ativar modo REAL?",`O robô passará a enviar <b>ordens reais</b> para as corretoras conectadas, usando seu dinheiro. Não existe garantia de lucro e perdas podem acontecer. Confirme que você entende os riscos e que as configurações de risco estão adequadas.`,{ok:"Ativar modo real",perigo:true,digitar:"CONFIRMO"});
    if(!v) return; const r=await call("definir_modo","real",v); if(r.ok===false) return toast(r.erro,"erro"); toast("Modo real ativado","aviso");
  } else { const r=await call("definir_modo","simulado",""); if(r.ok===false) return toast(r.erro,"erro"); toast("De volta ao modo simulado","ok"); }
  await tick(); pgConfig();
}
async function salvarMT5(b){ const r=await withLoading(b,()=>call("salvar_mt5",$("#m5L").value,$("#m5P").value,$("#m5S").value,$("#m5C").value)); r.ok?toast(r.info,"ok"):toast(r.erro||r.info,"erro",7000); S.cfg=await call("config"); await tick(); pgConfig(); }
async function salvarBN(b){ const r=await withLoading(b,()=>call("salvar_binance",$("#bnK").value,$("#bnS").value)); r.ok?toast(r.info,"ok"):toast(r.erro,"erro",7000); if(r.ok){ S.cfg=await call("config"); await tick(); pgConfig(); } }
async function removerBN(){ if(!await confirmar("Remover chaves da Binance?","O modo real deixará de operar cripto.",{ok:"Remover",perigo:true})) return; await call("remover_binance"); S.cfg=await call("config"); await tick(); pgConfig(); }
async function salvarRSS(b){ const l=$("#rssT").value.split("\n").map(s=>s.trim()).filter(Boolean); const r=await withLoading(b,()=>call("salvar_config",{rss:l})); r.ok===false?toast(r.erro,"erro"):toast("Fontes salvas","ok"); S.cfg=await call("config"); }
async function resetSim(b){ if(!await confirmar("Reiniciar simulação?","Saldo, posições e histórico simulados serão apagados.",{ok:"Reiniciar",perigo:true})) return; await withLoading(b,()=>call("resetar_simulacao",+$("#simS").value)); S.cfg=await call("config"); await tick(); toast("Simulação reiniciada","ok"); }

/* ============================================================ LICENÇA */
const PRECOS={essencial:"R$ 297",pro:"R$ 497",ag_momento:"R$ 59",ag_noticias:"R$ 79",ag_macd:"R$ 59",ag_bollinger:"R$ 59",ativos_ilimitados:"R$ 99"};
function comprar(item){ call("abrir_link",(S.est?.site||"https://quorum-trader.netlify.app")+"/#planos"+(item?"?item="+item:"")); }
function pgLicenca(){
  const L=S.est.licenca, AD=S.cfg.addons;
  const feats=[["Modo simulado com dados reais",true],["Modo real (MT5 / Binance)",L.real],[`Até ${L.max_ativos>=999?"ilimitados":L.max_ativos} ativos`,true],["3 agentes base: Tendência, Reversão, Rompimento",true],
    ...Object.entries(AD).filter(([k])=>k.startsWith("ag_")).map(([k,v])=>[v,L.addons.includes(k)]),["Backtest, histórico e exportação",true]];
  $("#pg").innerHTML=`<div class="grid g2"><div class="card" style="background:linear-gradient(150deg,rgba(124,108,255,.16),rgba(34,211,238,.05) 60%)">
    <div class="row"><div class="agent"><div class="ico" style="width:52px;height:52px">${ic(L.plano==="Pro"?"spark":"key")}</div></div><div><div class="muted" style="font-size:12.5px">Seu plano</div><div style="font-size:26px;font-weight:750;letter-spacing:-.5px">${esc(L.plano)}</div></div></div>
    ${L.email?`<div class="muted mt" style="font-size:13px">Licenciado para <b style="color:var(--text)">${esc(L.nome||L.email)}</b> · ${esc(L.email)}<br>${L.expira?"Válida até "+new Date(L.expira*1000).toLocaleDateString("pt-BR"):"Acesso vitalício"} · ID ${esc(L.id)}</div>`:`<div class="muted mt" style="font-size:13px">Você está na demonstração: tudo funciona no modo simulado com os agentes base.</div>`}
    <div class="col mt" style="gap:9px">${feats.map(([t,ok])=>`<div class="row" style="font-size:13.5px"><span class="${ok?"up":"faint"}">${ic(ok?"check":"lock")}</span><span class="${ok?"":"muted"}">${esc(t)}</span></div>`).join("")}</div></div>
  <div class="card"><div class="hd"><h3>${ic("key")}Ativar chave de licença</h3></div>
    <p class="muted" style="font-size:13px">Cole a chave recebida após a compra. Ela é verificada por assinatura digital — funciona mesmo offline.</p>
    <textarea class="inp mt" id="licT" rows="5" placeholder="QT1-..."></textarea>
    <div class="row mt">${L.email?`<button class="btn ghost" ${A("removerLic")}>Remover licença</button>`:""}<div class="grow"></div><button class="btn pri" ${A("ativarLic")} data-el>${ic("check")}Ativar</button></div>
    <div class="nav-sep" style="margin:20px 0"></div>
    <div class="row"><div style="flex:1"><b>Ainda não tem?</b><div class="muted" style="font-size:12.5px">Essencial ${PRECOS.essencial} · Pro ${PRECOS.pro} — pagamento único</div></div><button class="btn" ${A("comprar")}>${ic("ext")}Ver planos</button></div></div></div>
  <h3 class="mt2 mb" style="font-size:15px">Adicionais</h3>
  <div class="grid g3">${Object.entries(AD).map(([k,v])=>{const tem=L.addons.includes(k);return `<div class="card hov row" style="gap:12px"><div class="agent"><div class="ico">${ic(k==="ativos_ilimitados"?"coins":"bot")}</div></div>
    <div style="flex:1"><b>${esc(v)}</b><div class="muted" style="font-size:12.5px">${tem?"Ativo na sua licença":PRECOS[k]+" · pagamento único"}</div></div>${tem?`<span class="badge up">${ic("check")}Seu</span>`:`<button class="btn sm pri" ${A("comprar",k)}>Adicionar</button>`}</div>`}).join("")}</div>`;
}
async function ativarLic(b){ const r=await withLoading(b,()=>call("ativar_licenca",$("#licT").value)); if(r.ok===false) return toast(r.erro,"erro",6000); toast("Licença "+r.licenca.plano+" ativada! 🎉","ok"); S.cfg=await call("config"); await tick(); pgLicenca(); }
async function removerLic(){ if(!await confirmar("Remover licença deste computador?","O app volta para a demonstração e o modo real é desligado.",{ok:"Remover",perigo:true})) return; await call("remover_licenca"); S.cfg=await call("config"); await tick(); pgLicenca(); }

/* ============================================================ INDIQUE */
function pgIndique(){
  const I=S.cfg.config.indicacoes;
  $("#pg").innerHTML=`<div class="card" style="padding:28px;background:radial-gradient(120% 140% at 0% 0%,rgba(124,108,255,.22),transparent 55%),radial-gradient(100% 120% at 100% 100%,rgba(34,211,238,.14),transparent 50%),var(--surface)">
    <div class="row wrap" style="gap:24px"><div style="flex:1;min-width:300px"><span class="badge brand">${ic("users")}Programa de afiliados</span>
    <h2 style="font-size:26px;letter-spacing:-.6px;margin-top:12px">Ganhe <span style="background:var(--grad);-webkit-background-clip:text;color:transparent">30% de comissão</span> em cada licença vendida pelo seu link</h2>
    <p class="muted mt" style="font-size:14px">Cadastre-se no site, receba seu link exclusivo e acompanhe cliques, vendas e comissões no painel de afiliado. O pagamento é feito via Pix.</p>
    <div class="row mt2"><button class="btn pri" ${A("abrirSite","/afiliados.html")}>${ic("ext")}Quero ser afiliado</button><button class="btn" ${A("abrirSite","/afiliados.html#painel")}>Abrir meu painel</button></div></div>
    <div class="col" style="gap:10px;min-width:240px">${[["1","Cadastre-se e pegue seu link"],["2","Compartilhe com quem opera"],["3","Receba 30% via Pix a cada venda"]].map(([n,t])=>`<div class="row card" style="padding:12px 14px"><b style="width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--grad);font-size:13px">${n}</b>${t}</div>`).join("")}</div></div></div>

  <div class="card mt2"><div class="hd"><h3>${ic("link")}Seus links de indicação de corretoras</h3><div class="grow"></div><button class="btn sm" ${A("addIndic")}>${ic("plus")}Adicionar</button></div>
    <p class="muted" style="font-size:13px">Binance, XP e outras corretoras têm programas oficiais de indicação que pagam bônus ou parte das taxas de quem você indicar. Cole aqui os seus links para ter tudo à mão e copiar com um clique.</p>
    <div class="col mt" id="indL">${I.map((x,i)=>`<div class="row"><input class="inp" style="max-width:220px" value="${esc(x.nome)}" ${CH("editIndic",i,"nome")} placeholder="Corretora">
      <input class="inp" value="${esc(x.link)}" ${CH("editIndic",i,"link")} placeholder="Cole seu link de indicação">
      <button class="btn icon" data-tip="Copiar" ${A("copiarIndic",i)}>${ic("copy")}</button><button class="btn icon ghost" data-tip="Remover" ${A("rmIndic",i)}>${ic("trash")}</button></div>`).join("")||'<div class="muted">Nenhum link ainda.</div>'}</div>
    <div class="row mt" style="gap:12px;font-size:12.5px">${ic("info")}<span class="muted">O Quorum não recebe nem administra dinheiro de terceiros: cada pessoa opera na própria conta, na própria corretora. Comissões vêm dos programas oficiais das corretoras e das vendas de licença.</span></div></div>`;
}
async function salvarIndic(l){ const r=await call("salvar_config",{indicacoes:l}); if(r.ok===false) return toast(r.erro,"erro"); S.cfg=await call("config"); }
async function editIndic(i,k,v){ const l=structuredClone(S.cfg.config.indicacoes); l[i][k]=v; await salvarIndic(l); toast("Salvo","ok",1500); }
async function addIndic(){ const l=structuredClone(S.cfg.config.indicacoes); l.push({nome:"",link:""}); await salvarIndic(l); pgIndique(); }
async function rmIndic(i){ const l=structuredClone(S.cfg.config.indicacoes); l.splice(i,1); await salvarIndic(l); pgIndique(); }
function copiar(t){ if(!t) return toast("Esse link está vazio","aviso"); navigator.clipboard.writeText(t).then(()=>toast("Copiado!","ok",1600),()=>toast("Não foi possível copiar","erro")); }

/* ============================================================ ONBOARDING */
function onboarding(){
  const C=S.cfg.config, P=S.cfg.presets;
  const st={i:0, aceite:C.aceite_risco, ativos:new Set(C.ativos.map(a=>a.nome)), perfil:"moderado"};
  const m=modal(`<div id="obB"></div>`,{wide:true});
  const steps=[
    ()=>`<div class="row" style="gap:14px"><svg width="52" height="52" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="url(#lg)"/><circle cx="15" cy="15" r="6.6" fill="none" stroke="#fff" stroke-width="2.7"/><path d="M19.2 19.2 24 24" stroke="#fff" stroke-width="2.7" stroke-linecap="round"/><circle cx="15" cy="15" r="2" fill="#fff"/></svg>
      <div><h2>Bem-vindo ao Quorum Trader</h2><p class="muted">Vamos configurar em menos de 1 minuto.</p></div></div>
      <div class="grid g3 mt2">${[["bot","Agentes que votam","Vários agentes analisam cada ativo; o robô só age com consenso."],["refresh","Aprende sozinho","A cada hora, os agentes que acertam ganham peso."],["shield","Travas de risco","Stop em toda operação, limite diário e botão de pânico."]].map(([i,t,d])=>`<div class="card"><div class="agent"><div class="ico">${ic(i)}</div></div><b class="mt" style="display:block;margin-top:12px">${t}</b><p class="muted" style="font-size:12.5px;margin-top:4px">${d}</p></div>`).join("")}</div>
      <div class="banner real mt2" style="margin-bottom:0">${ic("alert")}<div style="font-size:12.5px">Operar no mercado envolve <b>risco de perda</b>. Nenhum robô garante lucro ou taxa de acerto. Comece pelo modo simulado.</div></div>
      <label class="row mt" style="cursor:pointer;font-size:13.5px"><input type="checkbox" class="ck2" id="obAc" ${st.aceite?"checked":""}> Entendo os riscos e que resultados passados não garantem resultados futuros.</label>`,
    ()=>`<h2>O que o robô deve acompanhar?</h2><p class="muted mb">Você pode mudar depois na aba Ativos. Seu plano permite ${S.est.licenca.max_ativos>=999?"ativos ilimitados":S.est.licenca.max_ativos+" ativos"}.</p>
      <div class="pick">${P.map(p=>`<div class="opt ${st.ativos.has(p.nome)?"on":""}" data-n="${esc(p.nome)}"><div><b>${esc(p.nome)}</b><div class="muted" style="font-size:12px">${MERC[p.mercado]} · ${FONTE[p.fonte]}</div></div><span class="ck">${ic("check")}</span></div>`).join("")}</div>`,
    ()=>`<h2>Qual o seu perfil de risco?</h2><p class="muted mb">Define quanto o robô arrisca por operação e por dia.</p>
      <div class="col">${Object.entries(PERFIS).map(([k,v])=>`<div class="opt ${st.perfil===k?"on":""}" data-p="${k}"><div style="flex:1"><b>${k[0].toUpperCase()+k.slice(1)}</b><div class="muted" style="font-size:12.5px">Arrisca ${String(v.risco_por_trade_pct).replace(".",",")}% por operação · para no dia ao perder ${v.perda_max_dia_pct}% · até ${v.max_posicoes} posições</div></div><span class="ck">${ic("check")}</span></div>`).join("")}</div>`,
    ()=>`<h2>Conexões (opcional)</h2><p class="muted mb">Para o modo simulado nada disso é necessário — os dados vêm de fontes públicas.</p>
      <div class="col">${[["plug","MetaTrader 5 · XP","Mini índice/dólar com dados da B3 em tempo real e, no plano pago, ordens reais."],["plug","Binance","Ordens reais de cripto (Spot) no plano pago."]].map(([i,t,d])=>`<div class="card row" style="gap:12px">${ic(i)}<div style="flex:1"><b>${t}</b><div class="muted" style="font-size:12.5px">${d}</div></div><span class="badge">Configurações</span></div>`).join("")}</div>
      <p class="help mt">Você conecta quando quiser em Configurações → Conexões.</p>`,
    ()=>`<div style="text-align:center;padding:20px 0"><div style="width:72px;height:72px;margin:0 auto;border-radius:22px;display:grid;place-items:center;background:var(--up-soft);color:var(--up)">${ic("check")}</div>
      <h2 class="mt">Tudo pronto!</h2><p class="muted">O robô vai começar no <b>modo simulado</b> com R$ ${nf2.format(C.saldo_inicial_simulado)} fictícios.<br>Acompanhe tudo pelo Painel.</p></div>`];
  function draw(){
    $("#obB",m).innerHTML=`<div class="steps">${steps.map((_,k)=>`<i class="${k<=st.i?"on":""}"></i>`).join("")}</div>${steps[st.i]()}
      <div class="acts">${st.i?`<button class="btn ghost" id="obV">Voltar</button>`:""}<div class="grow"></div><button class="btn ${st.i===steps.length-1?"go":"pri"}" id="obN">${st.i===steps.length-1?ic("play")+"Iniciar simulação":"Continuar"+ic("chev")}</button></div>`;
    $$(".opt[data-n]",m).forEach(o=>o.onclick=()=>{ const n=o.dataset.n; st.ativos.has(n)?st.ativos.delete(n):st.ativos.add(n); o.classList.toggle("on"); });
    $$(".opt[data-p]",m).forEach(o=>o.onclick=()=>{ st.perfil=o.dataset.p; draw(); });
    const ac=$("#obAc",m); if(ac) ac.onchange=()=>st.aceite=ac.checked;
    $("#obV",m)&&($("#obV",m).onclick=()=>{st.i--;draw();});
    $("#obN",m).onclick=async e=>{
      if(st.i===0&&!st.aceite) return toast("Marque a caixa confirmando que entende os riscos","aviso");
      if(st.i===1&&!st.ativos.size) return toast("Escolha pelo menos um ativo","aviso");
      if(st.i<steps.length-1){ st.i++; return draw(); }
      const atuais=C.ativos.filter(a=>st.ativos.has(a.nome)), novos=P.filter(p=>st.ativos.has(p.nome)&&!atuais.some(a=>a.nome===p.nome)).map(p=>({...p,ativo:true,lote_max:1}));
      await withLoading(e.currentTarget,async()=>{
        await call("salvar_config",{...PERFIS[st.perfil],ativos:[...atuais,...novos],aceite_risco:true,onboarding_ok:true});
        S.cfg=await call("config"); await call("iniciar"); });
      m.close(); toast("Robô iniciado no modo simulado. Boa! 🚀","ok"); await tick(); go("painel");
    };
  }
  draw();
}

/* ============================================================ MOCK (demonstração no navegador) */
function MockAPI(){
  const PRE=[{nome:"BTC/USDT",fonte:"binance",simbolo:"BTCUSDT",mercado:"cripto",palavras:["bitcoin"],p:96500},{nome:"ETH/USDT",fonte:"binance",simbolo:"ETHUSDT",mercado:"cripto",palavras:["ethereum"],p:3420},
    {nome:"SOL/USDT",fonte:"binance",simbolo:"SOLUSDT",mercado:"cripto",palavras:["solana"],p:182},{nome:"BNB/USDT",fonte:"binance",simbolo:"BNBUSDT",mercado:"cripto",palavras:["bnb"],p:610},
    {nome:"EUR/USD",fonte:"yahoo",simbolo:"EURUSD=X",mercado:"forex",palavras:["euro"],p:1.0842},{nome:"GBP/USD",fonte:"yahoo",simbolo:"GBPUSD=X",mercado:"forex",palavras:["libra"],p:1.2712},
    {nome:"USD/JPY",fonte:"yahoo",simbolo:"JPY=X",mercado:"forex",palavras:["iene"],p:149.3},{nome:"Ouro (XAU)",fonte:"yahoo",simbolo:"GC=F",mercado:"forex",palavras:["ouro"],p:2650},
    {nome:"Mini Índice (WIN)",fonte:"mt5",simbolo:"WIN$N",reserva:"^BVSP",mercado:"b3",palavras:["ibovespa"],p:131250},{nome:"Mini Dólar (WDO)",fonte:"mt5",simbolo:"WDO$N",reserva:"BRL=X",mercado:"b3",palavras:["dólar"],p:5.412}];
  const AG={tendencia:["Tendência","trend","Cruza médias móveis exponenciais (9 e 21) e segue a direção dominante do preço."],reversao:["Reversão","rewind","Usa o RSI para identificar exageros de compra/venda e aposta na volta ao equilíbrio."],
    rompimento:["Rompimento","bolt","Entra quando o preço rompe a máxima ou a mínima das últimas 20 barras."],momento:["Momento","rocket","Mede a força do movimento recente, ajustada pela volatilidade do ativo."],
    noticias:["Notícias","news","Lê feeds RSS em tempo real e pontua o sentimento das manchetes ligadas a cada ativo."],macd:["MACD","wave","Histograma do MACD para captar aceleração e perda de força da tendência."],bollinger:["Bollinger","bands","Mede quantos desvios o preço está da média de 20 barras e opera o retorno."]};
  const ADD={ag_momento:"Agente Momento",ag_noticias:"Agente Notícias (RSS)",ag_macd:"Agente MACD",ag_bollinger:"Agente Bollinger",ativos_ilimitados:"Ativos ilimitados"};
  let lic={plano:"Demonstração",real:false,max_ativos:3,agentes:["tendencia","reversao","rompimento"],addons:[],email:"",nome:"",id:"",expira:null};
  const cfg={onboarding_ok:true,modo:"simulado",saldo_inicial_simulado:10000,intervalo_ciclo_seg:120,timeframe_min:60,risco_por_trade_pct:1,perda_max_dia_pct:3,max_posicoes:4,limiar_entrada:.5,stop_atr:2.5,alvo_rr:2.5,trailing:true,custos:{cripto:.1,forex:.005,b3:.008},filtro_tendencia:true,fechar_fim_pregao:true,
    agentes_ativos:Object.keys(AG),ativos:[PRE[0],PRE[4],PRE[8]].map(p=>({...p,ativo:true,lote_max:1})),rss:["https://www.infomoney.com.br/feed/","https://cointelegraph.com/rss","https://www.fxstreet.com/rss/news"],
    mt5:{login:0,senha:"",servidor:"XPMT5-PRD",caminho_terminal:""},binance:{api_key:"",api_secret:""},indicacoes:[{nome:"Binance",link:""},{nome:"XP Investimentos",link:""}],licenca:false};
  const now=()=>Date.now()/1000; let id=0; const logs=[]; const L=(msg,nivel="info")=>logs.push({id:++id,ts:now(),nivel,msg});
  const px={}, spark={}; PRE.forEach(p=>{px[p.nome]=p.p; spark[p.nome]=Array.from({length:60},(_,i)=>p.p*(1+Math.sin(i/7+p.p)*.004+(Math.random()-.5)*.003));});
  const pesos={}, acertos={}; cfg.ativos.forEach(a=>{pesos[a.nome]={}; acertos[a.nome]={}; Object.keys(AG).forEach(k=>{pesos[a.nome][k]=+(0.6+Math.random()*1.6).toFixed(2); acertos[a.nome][k]=[30+Math.floor(Math.random()*25),80];});});
  let saldo=10000, rodando=true, travado=false, prox=now()+20; const posicoes={}, fechados=[], curva=[];
  let v=10000; for(let i=300;i>0;i--){ v+= (Math.random()-.5)*28; curva.push([Math.floor(now()-i*600), +v.toFixed(2)]); } saldo=v;
  [["BTC/USDT",1,"alvo",64.2],["EUR/USD",-1,"stop",-31.5],["Mini Índice (WIN)",1,"sinal contrário",22.8],["ETH/USDT",-1,"alvo",58.1],["BTC/USDT",1,"stop",-34.7],["EUR/USD",1,"alvo",61.3]].forEach(([a,l,m,p],i)=>
    fechados.push({ativo:a,lado:l,entrada:px[a],saida:px[a]*(1+p/10000*l),qtd:1,pnl:p,pct:p/100,motivo:m,aberto:new Date((now()-(i+2)*5400)*1000).toISOString(),quando:new Date((now()-(i+1)*5000)*1000).toISOString(),real:false}));
  posicoes["BTC/USDT"]={lado:1,entrada:px["BTC/USDT"]*0.997,qtd:.05,ts:now()-1800,stop:px["BTC/USDT"]*0.988,alvo:px["BTC/USDT"]*1.015,real:false};
  L("Robô iniciado em modo SIMULADO","ok"); L("38 notícias novas analisadas","news"); L("COMPRA BTC/USDT a 96.210 · stop 95.350 · alvo 97.930","compra");
  const ultimo={};
  function passo(){
    cfg.ativos.forEach(a=>{ const vol=a.mercado==="cripto"?.0025:a.mercado==="b3"?.0012:.0006; px[a.nome]*=1+(Math.random()-.5)*vol; spark[a.nome].push(px[a.nome]); spark[a.nome]=spark[a.nome].slice(-60);
      const votos={}; Object.keys(AG).filter(k=>lic.agentes.includes(k)).forEach(k=>votos[k]=+((Math.random()-.5)*1.6).toFixed(2));
      const sc=Object.values(votos).reduce((s,x)=>s+x,0)/Math.max(1,Object.keys(votos).length);
      ultimo[a.nome]={preco:px[a.nome],score:+sc.toFixed(3),votos,variacao:(px[a.nome]/spark[a.nome][0]-1)*100,origem:a.fonte==="mt5"?"Yahoo (reserva)":({binance:"Binance",yahoo:"Yahoo"})[a.fonte]}; });
    const pat=saldo+unreal(); curva.push([Math.floor(now()),+pat.toFixed(2)]);
    if(Math.random()<.35){ const a=cfg.ativos[Math.floor(Math.random()*cfg.ativos.length)].nome; if(posicoes[a]){ const p=posicoes[a]; const pnl=(px[a]-p.entrada)*p.qtd*p.lado; saldo+=pnl; delete posicoes[a];
        fechados.unshift({ativo:a,lado:p.lado,entrada:p.entrada,saida:px[a],qtd:p.qtd,pnl,pct:(px[a]/p.entrada-1)*100*p.lado,motivo:pnl>0?"alvo":"stop",aberto:new Date(p.ts*1000).toISOString(),quando:new Date().toISOString(),real:false}); L(`Fechou ${a} (${pnl>0?"alvo":"stop"}) · resultado ${pnl>=0?"+":""}${pnl.toFixed(2)}`,pnl>0?"ganho":"perda"); }
      else if(Object.keys(posicoes).length<cfg.max_posicoes && !travado){ const l=Math.random()>.5?1:-1; posicoes[a]={lado:l,entrada:px[a],qtd:100/(px[a]*.006),ts:now(),stop:px[a]*(1-.006*l),alvo:px[a]*(1+.012*l),real:false}; L(`${l>0?"COMPRA":"VENDA"} ${a} a ${px[a].toFixed(2)}`,l>0?"compra":"venda"); } }
    prox=now()+20;
  }
  const unreal=()=>Object.entries(posicoes).reduce((s,[n,p])=>s+(px[n]-p.entrada)*p.qtd*p.lado,0);
  passo(); setInterval(()=>{ if(rodando) passo(); },20000);
  const stats=()=>{ const p=fechados.map(t=>t.pnl), g=p.filter(x=>x>0), q=p.filter(x=>x<=0), sum=a=>a.reduce((s,x)=>s+x,0);
    return {trades:p.length,acerto:p.length?g.length/p.length*100:0,expectativa:p.length?sum(p)/p.length:0,fator_lucro:q.length?+(sum(g)/-sum(q)).toFixed(2):0,drawdown:3.4,pnl_total:sum(p),ganho_medio:g.length?sum(g)/g.length:0,perda_media:q.length?sum(q)/q.length:0,melhor:Math.max(0,...p),pior:Math.min(0,...p)}; };
  const ok=x=>Promise.resolve({ok:true,...x}), no=m=>Promise.resolve({ok:false,erro:m});
  const pos=(n,p)=>({ativo:n,lado:p.lado,entrada:p.entrada,preco:px[n],stop:p.stop,alvo:p.alvo,qtd:p.qtd,real:false,desde:p.ts,pnl:(px[n]-p.entrada)*p.qtd*p.lado,pct:(px[n]/p.entrada-1)*100*p.lado});
  const N=["Bitcoin sobe após entrada recorde em ETFs","Ibovespa recua com cautela antes do Copom","Euro avança com dados fortes da zona do euro","Ethereum cai com venda de baleias","Fed sinaliza corte de juros em dezembro","Dólar recua frente ao real com fluxo estrangeiro","Ouro bate recorde com busca por proteção","Mercado cripto tem semana de alta"];
  return {
    estado:(d)=>Promise.resolve({app:"Quorum Trader",versao:"1.0.0",site:location.origin.includes("quorum-trader")?location.origin:"https://quorum-trader.netlify.app",rodando,travado,motivo_trava:travado?"panico":"",modo:"simulado",modo_cfg:cfg.modo,patrimonio:saldo+unreal(),saldo,pnl_dia:unreal()+42.3,nao_realizado:unreal(),capital_real:{},
      proximo_ciclo:rodando?Math.max(0,prox-now()):null,ultimo_ciclo:now(),stats:stats(),
      ativos:cfg.ativos.map((a,i)=>({...a,liberado:i<lic.max_ativos,...(ultimo[a.nome]||{}),spark:spark[a.nome],aberto:a.mercado!=="b3"||true,status:"Aberto",posicao:posicoes[a.nome]?pos(a.nome,posicoes[a.nome]):null})),
      posicoes:Object.entries(posicoes).map(([n,p])=>pos(n,p)),curva:curva.slice(-500),logs:logs.filter(l=>l.id>d),mt5:{ok:false,info:""},binance_ok:false,licenca:lic,onboarding_ok:cfg.onboarding_ok,agentes_em_uso:lic.agentes,n_noticias:N.length}),
    config:()=>Promise.resolve({config:structuredClone(cfg),presets:PRE,addons:ADD,agentes:Object.entries(AG).map(([k,v])=>({id:k,nome:v[0],icone:v[1],desc:v[2],liberado:lic.agentes.includes(k),ligado:cfg.agentes_ativos.includes(k),addon:["tendencia","reversao","rompimento"].includes(k)?null:"ag_"+k})),pesos,acertos}),
    noticias:()=>Promise.resolve(N.map((t,i)=>({ts:now()-i*1500,titulo:t,link:"",fonte:["infomoney.com.br","cointelegraph.com","fxstreet.com"][i%3],score:/sobe|avança|corte|recorde|alta|recua frente/.test(t)?.5:/cai|recua/.test(t)?-.5:0,ativos:[cfg.ativos[i%cfg.ativos.length].nome]}))),
    historico:()=>Promise.resolve(fechados.slice()),
    iniciar:()=>{rodando=true;L("Robô iniciado em modo SIMULADO","ok");return ok();}, pausar:()=>{rodando=false;L("Robô pausado","aviso");return ok();},
    ciclo_agora:()=>{passo();return ok();}, panico:()=>{Object.keys(posicoes).forEach(k=>delete posicoes[k]);travado=true;L("PÂNICO acionado: posições zeradas e novas entradas bloqueadas.","erro");return ok();},
    destravar:()=>{travado=false;return ok();}, fechar_posicao:(n)=>{delete posicoes[n];L("Fechou "+n+" (manual)","info");return ok();},
    salvar_config:(d)=>{Object.assign(cfg,d);return ok();}, definir_modo:()=>no("Na demonstração o modo real fica bloqueado."),
    salvar_mt5:()=>no("Disponível no aplicativo para Windows."), salvar_binance:()=>no("Disponível no aplicativo para Windows."), remover_binance:()=>ok(),
    resetar_simulacao:()=>{saldo=10000;fechados.length=0;curva.length=0;return ok();}, resetar_aprendizado:()=>ok(),
    ativar_licenca:()=>no("Ative sua chave no aplicativo para Windows."), remover_licenca:()=>ok(),
    backtest:(n)=>new Promise(r=>setTimeout(()=>{ let s=10000; const c=[]; for(let i=0;i<400;i++){ s+=(Math.random()-.5)*40; c.push([Math.floor(now()-(400-i)*900),+s.toFixed(2)]); }
      r({ok:true,resultado:{trades:64,acerto:46.9,expectativa:(s-10000)/64,fator_lucro:1.31,drawdown:6.2,pnl_total:s-10000,ganho_medio:88,perda_media:-58,melhor:240,pior:-110,curva:c,origem:"Binance",barras:1000,inicio:c[0][0],fim:c[399][0],pesos:{tendencia:1.8,reversao:.7,rompimento:1.2},retorno_pct:(s/10000-1)*100,buy_hold_pct:4.1,agentes:["tendencia","reversao","rompimento"]}})},1600)),
    testar_ativo:()=>ok({preco:1.0842,origem:"Yahoo",barras:200}), atualizar_noticias:()=>ok({novos:3}), exportar_csv:()=>no("Disponível no aplicativo para Windows."),
    abrir_link:(u)=>{window.open(u,"_blank","noopener");return ok();}, abrir_pasta_dados:()=>ok(),
  };
}
