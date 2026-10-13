'use strict';
// Rumo — dados de exemplo (fictícios) para a demonstração e para conhecer o app.

R.loadSample = () => {
  const S = R.defaults(), T = R.today(), d = n => R.addDays(T, n);
  let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  S.settings.demo = true;
  S.lists = [{ id: 'pessoal', name: 'Pessoal', color: '#0e9f8c' }, { id: 'trabalho', name: 'Trabalho', color: '#3b82c4' }, { id: 'estudos', name: 'Estudos', color: '#8a63d2' }];
  const P = { reforma: R.uid(), produto: R.uid(), viagem: R.uid(), saude: R.uid() };
  S.projects = [
    { id: P.reforma, name: 'Reformar o escritório em casa', outcome: 'Escritório pronto, com mesa, iluminação e cabos organizados.', status: 'active', created: Date.now() },
    { id: P.produto, name: 'Lançar a versão 2 do produto', outcome: 'Versão 2 publicada com comunicado aos clientes.', status: 'active', created: Date.now() },
    { id: P.viagem, name: 'Viagem de férias em janeiro', outcome: 'Passagens, hospedagem e roteiro fechados.', status: 'active', created: Date.now() },
    { id: P.saude, name: 'Retomar a rotina de saúde', outcome: 'Check-up feito e treino 3x por semana.', status: 'someday', created: Date.now() },
  ];
  const t = (title, o = {}) => S.tasks.push(R.newTask(Object.assign({ title, status: 'next', created: Date.now() - S.tasks.length * 1000 }, o)));
  t('Responder e-mail da Marina sobre a proposta', { status: 'inbox' }); t('Ideia: automatizar o relatório semanal', { status: 'inbox' }); t('Pesquisar plano de saúde melhor', { status: 'inbox' }); t('Comprar presente de aniversário', { status: 'inbox' });
  t('Enviar relatório mensal ao gestor', { due: d(-1), prio: 1, list: 'trabalho', contexts: ['pc'], dur: 45 }); t('Pagar fatura do cartão', { due: d(0), prio: 1, contexts: ['online'], dur: 10 });
  t('Reunião de planejamento do trimestre', { due: d(0), time: '10:00', dur: 60, list: 'trabalho', tags: ['reunião'] }); t('Estudar 30 min de inglês', { due: d(0), repeat: 'daily', list: 'estudos', dur: 30, contexts: ['casa'] });
  t('Treino de costas', { due: d(0), time: '18:30', dur: 60, contexts: ['rua'], prio: 2 }); t('Ligar para o contador', { due: d(1), contexts: ['telefone'], dur: 15 }); t('Revisar contrato do fornecedor', { due: d(2), prio: 2, list: 'trabalho', contexts: ['pc'], dur: 40 });
  t('Renovar seguro do carro', { due: d(4), prio: 2, contexts: ['online'] }); t('Marcar dentista', { due: d(6), contexts: ['telefone'] });
  t('Orçar mesa em L e iluminação', { project: P.reforma, contexts: ['online'], prio: 2 }); t('Medir o espaço do escritório', { project: P.reforma, contexts: ['casa'], dur: 20 }); t('Comprar organizador de cabos', { project: P.reforma, status: 'someday' });
  t('Escrever o changelog da v2', { project: P.produto, list: 'trabalho', contexts: ['pc'], dur: 60, due: d(3) }); t('Gravar vídeo de demonstração', { project: P.produto, list: 'trabalho', contexts: ['pc'], dur: 90 }); t('Aprovação do design final', { project: P.produto, status: 'waiting', waitingFor: 'Time de design', due: d(2) });
  t('Pesquisar passagens para janeiro', { project: P.viagem, contexts: ['online'], dur: 30, due: d(5) }); t('Esperar confirmação da hospedagem', { status: 'waiting', waitingFor: 'Anfitrião', project: P.viagem, due: d(7) });
  t('Aprender violão', { status: 'someday' }); t('Fazer um curso de fotografia', { status: 'someday' }); t('Visitar a exposição no museu', { status: 'someday' });
  t('Manual da impressora', { status: 'reference', notes: 'Modelo e senha do Wi-Fi guardados no cofre de senhas.' });
  t('Pagar internet', { status: 'done', doneAt: d(-2) }); t('Atualizar currículo', { status: 'done', doneAt: d(-3) }); t('Marcar check-up', { status: 'done', doneAt: d(-5) });
  /* finanças */
  const F = S.fin; F.accounts = [{ id: 'cc', name: 'Conta corrente', type: 'checking', initial: 1200, color: '#0e9f8c' }, { id: 'cart', name: 'Cartão Platinum', type: 'card', initial: 0, closing: 25, dueDay: 5, limit: 8000, color: '#8a63d2' }, { id: 'rv', name: 'Reserva (poupança)', type: 'savings', initial: 6500, color: '#3b82c4' }, { id: 'din', name: 'Carteira', type: 'cash', initial: 150, color: '#f2a33a' }];
  F.rules = [{ match: 'mercado', cat: 'mercado' }, { match: 'posto', cat: 'transporte' }, { match: 'uber', cat: 'transporte' }, { match: 'netflix', cat: 'assinaturas' }, { match: 'spotify', cat: 'assinaturas' }, { match: 'farmácia', cat: 'saude' }, { match: 'ifood', cat: 'alimentacao' }];
  const add = (date, amount, kind, desc, acc, cat, paid = true) => F.txs.push({ id: R.uid(), date, amount, kind, desc, acc, cat, paid, tags: [], notes: '', inst: '' });
  for (let mo = -5; mo <= 0; mo++) {
    const m0 = R.addMonths(T.slice(0, 8) + '01', mo);
    add(R.addDays(m0, 4), 5200, 'in', 'Salário', 'cc', 'salario'); if (rnd() < .7) add(R.addDays(m0, 14), +(300 + rnd() * 700).toFixed(2), 'in', 'Projeto freelance', 'cc', 'freela');
    add(R.addDays(m0, 5), 1650, 'out', 'Aluguel', 'cc', 'moradia'); add(R.addDays(m0, 9), 129.9, 'out', 'Internet fibra', 'cc', 'moradia'); add(R.addDays(m0, 12), 39.9, 'out', 'Netflix', 'cart', 'assinaturas'); add(R.addDays(m0, 12), 21.9, 'out', 'Spotify', 'cart', 'assinaturas'); add(R.addDays(m0, 7), 119, 'out', 'Academia', 'cc', 'saude');
    for (let i = 0; i < 16; i++) { const s = [['Supermercado Boa Compra', 80, 280, 'mercado'], ['Padaria', 12, 40, 'alimentacao'], ['Posto Estrela', 70, 190, 'transporte'], ['iFood', 30, 90, 'alimentacao'], ['Farmácia', 25, 110, 'saude'], ['Cinema', 30, 70, 'lazer'], ['Uber', 14, 55, 'transporte'], ['Loja de roupas', 90, 260, 'compras']][Math.floor(rnd() * 8)]; add(R.addDays(m0, Math.floor(rnd() * 27)), +(s[1] + rnd() * (s[2] - s[1])).toFixed(2), 'out', s[0], rnd() < .6 ? 'cart' : 'cc', s[3]); }
  }
  F.txs = F.txs.filter(x => x.date <= d(15)); add(d(3), 480, 'out', 'IPVA (parcela)', 'cc', 'transporte', false); add(d(6), 129.9, 'out', 'Internet fibra', 'cc', 'moradia', false);
  F.recurring = [{ id: R.uid(), desc: 'Aluguel', amount: 1650, kind: 'out', next: R.addMonths(T.slice(0, 8) + '05', T.slice(8) > '05' ? 1 : 0), acc: 'cc', cat: 'moradia' }];
  F.budgets = { default: { mercado: 900, alimentacao: 400, transporte: 450, lazer: 250, assinaturas: 120, saude: 300, compras: 350 } };
  F.goals = [{ id: R.uid(), name: 'Reserva de emergência (6 meses)', target: 30000, saved: 6500, deadline: R.addMonths(T, 14) }, { id: R.uid(), name: 'Viagem de férias', target: 8000, saved: 2400, deadline: R.addMonths(T, 4) }];
  /* hábitos e foco */
  S.habits = [{ id: R.uid(), name: 'Beber 2 L de água', log: [] }, { id: R.uid(), name: 'Treinar', log: [] }, { id: R.uid(), name: 'Ler 20 minutos', log: [] }];
  S.habits.forEach((h, i) => { for (let k = 0; k < 60; k++) if (rnd() < [.85, .55, .7][i]) h.log.push(d(-k)); });
  for (let k = 0; k < 14; k++) S.focus[d(-k)] = Math.floor(rnd() * 5) * 25; S.lastReview = d(-9);
  R.S = S; R.save(); R.tokens.demo = true; R.saveTokens(); R.demoEvents(); R.save();
};
