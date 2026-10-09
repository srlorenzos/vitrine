"use strict";
/* ---------- v2: estende o mock com etapas, pensamentos, preços ao vivo, estratégias, gráfico e copiloto */
const _MockV1 = MockAPI;
MockAPI = function(){
  const api=_MockV1(), now=()=>Date.now()/1000, rnd=(a,b)=>a+Math.random()*(b-a);
  const etapas=[["noticias","Lendo notícias de 6 fontes RSS…"],["coletando","Baixando cotações e gráficos de 3 ativos…"],["ia","IA (Claude) analisando manchetes e indicadores…"],["votando","Agentes votando em 3 ativos e conferindo o risco…"],["aguardando","Análise concluída. Acompanhando preços em tempo real até a próxima."]];
  let ie=0, tEtapa=now();
  const ticks={}, extra={alertas:[],telegram:{token:"",chat_id:""},agentes_direcional_ativo:true,meta_lucro_dia_pct:0,ia_ativa:true,ia_intervalo_min:60};
  const PENS={"BTC/USDT":["posicionado","Comprado (+0,28%)","Entrei às 10:42 a 96.210. Stop em 95.342 protege a perda; alvo em 97.930. Saio antes se o consenso virar para venda acima de 50.","Fluxo de ETFs positivo e rompimento de máxima recente sustentam viés de alta moderado."],
    "EUR/USD":["aguardando","Aguardando sinal mais forte (+32 de ±50)","Consenso para comprar: 32 de 50 necessários. A favor: Tendência, MACD. Contra: Reversão. Notícias recentes: tom positivo.","Dados fortes da zona do euro favorecem o euro, mas o Fed ainda pesa: viés leve de compra."],
    "Mini Índice (WIN)":["filtro","Filtro de tendência segurou","Os agentes querem comprar (+54), mas o preço está abaixo da média de 100 barras — não opero contra a maré.","Cautela antes do Copom; manchetes mistas sobre fluxo estrangeiro."]};
  const C=(k,r,t,a,b,p,h)=>[k,r,t,a??null,b??null,p??null,h||""];
  const est={
    arbitragem:{nome:"Arbitragem entre corretoras",icone:"swap",resumo:"Compra onde está mais barato e vende onde está mais caro, ao mesmo tempo.",
      passos:["Consulta o preço da mesma moeda em 5 corretoras a cada poucos segundos.","Calcula a diferença entre a mais barata e a mais cara.","Desconta as taxas das duas corretoras.","Se sobrar lucro acima do mínimo, executa compra e venda simultâneas."],
      risco:"Na prática as diferenças são pequenas e somem em segundos. Para executar de verdade é preciso ter saldo nas duas corretoras ao mesmo tempo. Aqui roda em simulação com preços reais.",
      params:{lucro_minimo_pct:0.05,valor_por_operacao:1000,moedas:"BTC,ETH,SOL,XRP,DOGE,ADA"},
      campos:[C("lucro_minimo_pct","Lucro mínimo após taxas (%)","num",0,2,0.01,"Só opera se sobrar pelo menos isso."),C("valor_por_operacao","Valor por operação (USDT)","num",50,100000,50),C("moedas","Moedas monitoradas","txt",0,0,0,"Separadas por vírgula")],ativa:true},
    triangular:{nome:"Arbitragem triangular",icone:"triangle",resumo:"Dá a volta em três moedas dentro da mesma corretora e termina com mais USDT do que começou.",
      passos:["Lê os preços de dezenas de pares na Binance.","Testa caminhos como USDT → SOL → BTC → USDT.","Desconta 3 taxas.","Se o ciclo terminar com lucro, executa as três conversões."],
      risco:"Ciclos lucrativos existem por milissegundos. Simulação com preços reais da Binance.",params:{lucro_minimo_pct:0.02,taxa_pct:0.075},
      campos:[C("lucro_minimo_pct","Lucro mínimo do ciclo (%)","num",0,1,0.01),C("taxa_pct","Taxa por conversão (%)","num",0,0.3,0.005)],ativa:false},
    funding:{nome:"Funding e swap (renda passiva)",icone:"percent",resumo:"Recebe a taxa de financiamento dos contratos perpétuos sem apostar na direção do preço.",
      passos:["Lê a taxa de funding de todos os perpétuos da Binance.","Escolhe as moedas que mais pagam.","Compra no à vista e vende o mesmo valor no perpétuo: posição neutra.","A cada 8h recebe o funding; sai se a taxa ficar negativa."],
      risco:"Funding muda e pode ficar negativo. Simulação com taxas reais; no MT5 mostra o swap real da sua corretora.",params:{minimo_anual_pct:12,max_posicoes:3,so_principais:true},
      campos:[C("minimo_anual_pct","Funding mínimo (% ao ano)","num",1,200,1),C("max_posicoes","Máximo de posições","num",1,10,1),C("so_principais","Só moedas grandes (mais seguro)","bool")],ativa:true},
    grid:{nome:"Grid (lucro na oscilação)",icone:"grid",resumo:"Espalha ordens em degraus; lucra cada vez que o preço sobe e desce dentro da faixa.",
      passos:["Define uma faixa em volta do preço atual.","Quando cai um degrau, compra um pedaço.","Quando sobe um degrau, vende com lucro.","Funciona melhor com o preço andando de lado."],
      risco:"Se o preço cair muito e não voltar, você fica com moedas no prejuízo. Real na Binance Spot.",real_suportado:true,params:{simbolo:"BTCUSDT",faixa_pct:4,niveis:10,executar_real:false},
      campos:[C("simbolo","Par (Binance)","txt"),C("faixa_pct","Largura da faixa (± %)","num",0.5,30,0.5),C("niveis","Número de degraus","num",4,40,1),C("executar_real","Executar de verdade na Binance (modo real)","bool")],ativa:true},
    dca:{nome:"DCA inteligente",icone:"calendar",resumo:"Compra um valor fixo de tempos em tempos, reforça nas quedas e realiza lucro quando sobe.",
      passos:["Compra um valor fixo a cada intervalo.","Se cair X% abaixo do médio, compra extra.","Subiu Y% acima do médio? Vende tudo com lucro.","Recomeça."],
      risco:"Em quedas longas o lucro demora. Real na Binance Spot.",real_suportado:true,params:{valor_compra:50,intervalo_horas:24,reforco_queda_pct:5,realizar_lucro_pct:8},
      campos:[C("valor_compra","Valor de cada compra (USDT)","num",10,100000,10),C("intervalo_horas","Comprar a cada (horas)","num",1,720,1),C("reforco_queda_pct","Reforço se cair (%)","num",1,50,0.5),C("realizar_lucro_pct","Realizar lucro em (%)","num",1,200,0.5)],ativa:false},
    pares:{nome:"Pares (arbitragem estatística)",icone:"scale",resumo:"Aposta que duas moedas que andam juntas voltam ao normal quando se afastam demais.",
      passos:["Acompanha a relação entre ETH e BTC.","Mede o quanto está fora do normal (z-score).","Esticou demais? Compra a barata e vende a cara.","Fecha quando a relação volta ao normal."],
      risco:"Às vezes a relação muda de vez. Simulação com preços reais.",params:{moeda_a:"ETH",moeda_b:"BTC",z_entrada:2,z_saida:0.3},
      campos:[C("z_entrada","Entrar com z acima de","num",1,4,0.1),C("z_saida","Sair com z abaixo de","num",0,1.5,0.1)],ativa:false},
  };
  Object.entries(est).forEach(([id,x])=>Object.assign(x,{id,capital:10000,pnl:0,trades:[],eventos:[],ultimo:now()}));
  const add=(x,msg,pnl)=>{ x.pnl+=pnl; x.trades.unshift({ts:now(),descricao:msg,pnl}); x.eventos.unshift({ts:now(),msg:`${msg} · resultado ${pnl>=0?"+":""}${pnl.toFixed(2)}`,nivel:pnl>0?"ganho":pnl<0?"perda":"compra"}); };
  add(est.grid,"Vendeu 0.006043 BTC a 96.540 (degrau)",3.42); add(est.funding,"APT: recebeu funding de +0,22 (1× 0,0110%)",0.22); add(est.arbitragem,"XRP: comprou na KuCoin e vendeu na OKX (+0,061%)",0.61);
  let rodando=true;
  function status(x){
    if(!x.ativa) return ["parada","Desligada. Ligue para começar a procurar oportunidades."];
    if(!rodando) return ["parada","Robô pausado — clique em Iniciar para continuar."];
    return {arbitragem:["aguardando",`Vigiando. Melhor diferença agora: SOL Bybit→OKX = ${rnd(-.12,.02).toFixed(3)}% após taxas (precisa ≥ 0,05%). Aguardando.`],
      triangular:["aguardando",`Testou 32 caminhos. Melhor: USDT → SOL → BTC → USDT = ${rnd(-.25,-.15).toFixed(3)}% após 3 taxas. Aguardando uma brecha.`],
      funding:["aguardando","Recebendo funding em 2 posições neutras. Próximo pagamento em 3,4h."],
      grid:["aguardando",`BTCUSDT a ${nf2.format(96500+rnd(-80,80))}. 2 degraus comprados. Próxima compra se cair a 95.880; próxima venda se subir a 96.770.`],
      dca:["aguardando","Carteira: 0,002071 BTC, preço médio 95.410 (+1,1% agora). Realiza lucro em 103.040. Próxima compra em 13,2h."],
      pares:["aguardando",`Relação ETH/BTC com z = ${rnd(-1.6,-1.2).toFixed(2)}. Entra quando |z| ≥ 2 (dentro do normal).`]}[x.id];
  }
  const OPS={
    arbitragem:()=>["BTC","ETH","SOL","XRP","DOGE","ADA"].map((m,i)=>({moeda:m,compra_em:["KuCoin","Bybit","Binance","OKX","Gate","KuCoin"][i],vende_em:["OKX","Binance","OKX","Bybit","Binance","Bybit"][i],preco_compra:[96480,3420,182.3,2.41,.162,.71][i],preco_venda:[96510,3421.1,182.4,2.412,.1621,.7102][i],bruto_pct:rnd(0,.09),liquido_pct:rnd(-.2,-.02)})).sort((a,b)=>b.liquido_pct-a.liquido_pct),
    triangular:()=>["SOL","XRP","ADA","LINK","DOGE"].flatMap(m=>[{caminho:`USDT → ${m} → BTC → USDT`,lucro_pct:rnd(-.3,-.15)},{caminho:`USDT → ETH → ${m} → USDT`,lucro_pct:rnd(-.3,-.15)}]).sort((a,b)=>b.lucro_pct-a.lucro_pct),
    funding:()=>[["SUI",.0182],["APT",.011],["OP",.0105],["BTC",.01],["ETH",.0094]].map(([m,r])=>({simbolo:m+"USDT",taxa_8h_pct:r,anual_pct:r*3*365})),
  };
  const niveis=Array.from({length:11},(_,i)=>92640+i*772);
  const EXTRA={funding:{posicoes:[{simbolo:"SUIUSDT",valor:2000,acumulado:1.42,anual_agora:19.9},{simbolo:"APTUSDT",valor:2000,acumulado:0.22,anual_agora:12}],swaps_mt5:{conectado:false,lista:[]}},
    grid:{preco:96500,niveis,comprados:[niveis[4],niveis[3]],passo:772},dca:{qtd:.002071,medio:95410,investido:197.6,preco:96500},
    pares:{z:-1.42,historico_z:Array.from({length:120},(_,i)=>Math.sin(i/9)*1.6+rnd(-.3,.3))}};
  const resumo=x=>{ const [etapa,st]=status(x), t=x.trades;
    return {...x,etapa,status:st,erro:"",saldo:x.capital+x.pnl,patrimonio:x.capital+x.pnl,n_trades:t.length,acerto:t.length?t.filter(z=>z.pnl>0).length/t.length*100:null,
      real_suportado:!!x.real_suportado,proxima:x.ativa?8-(now()-x.ultimo)%8:null,curva:[],real_agora:false,oportunidades:OPS[x.id]?OPS[x.id]():[],extra:EXTRA[x.id]||{}}; };
  const base=api.estado;
  api.estado=async d=>{ const e=await base(d); rodando=e.rodando;
    if(e.rodando && now()-tEtapa>(ie===4?16:2.2)){ ie=(ie+1)%5; tEtapa=now(); }
    e.etapa=e.rodando?{id:etapas[ie][0],texto:etapas[ie][1],ts:tEtapa}:{id:"parado",texto:"Robô parado.",ts:now()};
    e.proximo_ciclo=e.rodando?(ie===4?Math.max(0,16-(now()-tEtapa)):18):null; e.intervalo=120;
    e.ativos.forEach(a=>{ const t=ticks[a.nome]||(ticks[a.nome]=[]); const ult=t.length?t[t.length-1]:a.preco; t.push(ult*(1+rnd(-.0007,.0007))); if(t.length>90) t.shift();
      a.preco=t[t.length-1]; a.ticks=t.slice(); const p=PENS[a.nome]; a.pensamento=e.rodando&&p?{estado:p[0],titulo:p[1],texto:p[2],ia:p[3]}:null; });
    e.estrategias=Object.values(est).map(x=>{ const r=resumo(x); return {id:r.id,nome:r.nome,icone:r.icone,ativa:r.ativa,status:r.status,etapa:r.etapa,pnl:r.pnl,n_trades:r.n_trades,erro:""}; });
    e.ia={disponivel:true,na_licenca:true,status:"Última análise há 10 min (3 ativos).",ultimo:now()-600,ate:null};
    e.telegram_ok=false; return e; };
  const baseCfg=api.config;
  api.config=async()=>{ const c=await baseCfg(); Object.assign(c.config,structuredClone(extra)); c.config.agentes_ativos=[...c.config.agentes_ativos,"ia"];
    c.agentes.push({id:"ia",nome:"IA Claude",icone:"spark",desc:"Inteligência artificial (Claude, da Anthropic) lê as manchetes e os indicadores de cada ativo e dá um voto com justificativa. Roda no servidor do Quorum: nada para configurar.",liberado:false,ligado:true,addon:"ia"}); return c; };
  const baseSalvar=api.salvar_config;
  api.salvar_config=async d=>{ for(const k of Object.keys(extra)) if(k in d) extra[k]=d[k]; return baseSalvar(d); };
  api.estrategias=async()=>Object.values(est).map(resumo);
  api.estrategia_ligar=async(id,v)=>{ est[id].ativa=!!v; return {ok:true}; };
  api.estrategia_params=async(id,p)=>{ Object.assign(est[id].params,p); return {ok:true}; };
  api.estrategia_resetar=async id=>{ Object.assign(est[id],{pnl:0,trades:[],eventos:[]}); return {ok:true}; };
  const bars={};
  api.grafico=async n=>{ const t=ticks[n]||[]; const p0=t.length?t[t.length-1]:100;
    if(!bars[n]){ let p=p0*0.97; bars[n]=Array.from({length:90},(_,i)=>{ const o=p; p=p*(1+rnd(-.006,.0065)); return [Math.floor(now()-(90-i)*3600),o,Math.max(o,p)*(1+rnd(0,.003)),Math.min(o,p)*(1-rnd(0,.003)),p]; }); }
    const B=bars[n]; if(!B._ok){ const f=p0/B[B.length-1][4]; B.forEach(b=>{for(let k=1;k<5;k++) b[k]*=f;}); B._ok=1; } B[B.length-1][4]=p0; B[B.length-1][2]=Math.max(B[B.length-1][2],p0); B[B.length-1][3]=Math.min(B[B.length-1][3],p0);
    const pos=n==="BTC/USDT"?{lado:1,entrada:B[85][4],stop:B[85][4]*0.988,alvo:B[85][4]*1.02}:null;
    return {ok:true,barras:B,ticks:t.map((v,i)=>[now()-(t.length-i)*3,v]),posicao:pos,trades:[{quando:new Date((now()-20*3600)*1000).toISOString(),saida:B[70][4],pnl:12}],
      pensamento:PENS[n]&&rodando?{estado:PENS[n][0],titulo:PENS[n][1],texto:PENS[n][2],ia:PENS[n][3]}:null,preco:p0,score:n==="BTC/USDT"?.58:.32,
      votos:{tendencia:.62,reversao:-.31,rompimento:1,macd:.44,ia:.35}}; };
  const RESP=[[/fazendo|agora|status/i,"Agora o robô está ligado no modo simulado. Ele acabou de analisar 3 ativos: está comprado em BTC (+0,28%), esperando um sinal mais forte em EUR/USD (consenso 32 de 50) e não entrou no mini índice porque o preço está abaixo da média de 100 barras. Em paralelo, o Grid e o Funding estão ligados e vigiando."],
    [/não compr|nao compr|por que|porque/i,"No EUR/USD o consenso dos agentes está em +32, e o robô só compra a partir de +50. Tendência e MACD estão a favor, mas a Reversão (RSI) está contra, então ele espera confirmação. Se quiser que entre mais cedo, reduza o “Consenso mínimo” em Configurações — mas ele vai errar mais vezes."],
    [/arbitragem/i,"Arbitragem é comprar a mesma moeda onde está mais barata e vender onde está mais cara, ao mesmo tempo. Ex.: BTC a 96.480 na KuCoin e 96.510 na OKX. Parece lucro, mas as duas taxas (0,1% cada) são maiores que a diferença — por isso o robô quase sempre só observa e só executa quando sobra lucro depois das taxas."],
    [/conservador|seguro|menos risco/i,"Três ajustes deixam o robô mais conservador: 1) Configurações → perfil Conservador (arrisca 0,5% por operação e para no dia ao perder 2%); 2) aumente o Consenso mínimo para 60; 3) deixe o Filtro de tendência ligado. Você opera menos, mas com mais seletividade."],
    [/melhor|estrat/i,"Hoje a que mais rendeu na simulação foi o Grid (+3,42 numa venda de degrau), seguido da Arbitragem (+0,61) e do Funding (+0,22). Poucas operações não dizem muito: olhe depois de algumas semanas e compare no Backtest."]];
  api.copiloto=async q=>{ await new Promise(r=>setTimeout(r,900)); const m=RESP.find(([re])=>re.test(q));
    return {ok:true,resposta:m?m[1]:"Na demonstração eu respondo as perguntas de exemplo. No aplicativo, a IA (Claude) responde qualquer dúvida olhando o estado real do seu robô.",restante:59}; };
  api.ia_agora=async()=>({ok:true,status:"Análise concluída"});
  api.salvar_alertas=async L=>{ extra.alertas=L; return {ok:true}; };
  api.salvar_telegram=async()=>({ok:false,erro:"Disponível no aplicativo para Windows."});
  api.remover_telegram=async()=>({ok:true});
  api.relatorio=async()=>({ok:false,erro:"Disponível no aplicativo para Windows."});
  setInterval(()=>{ if(!rodando) return; Object.values(est).forEach(x=>{ if(x.ativa) x.ultimo=x.ultimo||now(); });
    if(est.grid.ativa&&Math.random()<.2) add(est.grid,`Comprou 0.006 BTC no degrau ${nf2.format(95880)}`,0); },8000);
  return api;
};
