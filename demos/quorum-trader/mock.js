"use strict";
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
