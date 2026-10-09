// Servidor simulado do Farol RMM: responde, em memória, às mesmas rotas do servidor real
// (servidor/src/rotas/*) e emite as mesmas mensagens de WebSocket ({ tipo, dados, ts }).
// Módulo puro (sem DOM): é usado por js/api.js e js/estado.js e pode ser testado em Node.
import { criarAgentes, leituraAtual, gerarMetricas, hash32, MIN, HORA, DIA } from './demo-dados.js';
import { simularExecucao } from './demo-saidas.js';
import { REGRAS_PADRAO, SCRIPTS_EXEMPLO } from './demo-sementes.js';

export const CODIGO_2FA = '123456';
export const SERVIDOR_FICTICIO = 'https://farol.empresa.exemplo';
const SHELLS = ['powershell', 'cmd', 'bash', 'python'];
const MINUTOS_ELEVADO = 10;
const IP_DEMO = '203.0.113.42';
const UUID = /^[0-9a-f-]{36}$/;

class Resposta extends Error {
  constructor(status, dados) { super(dados?.erro || String(status)); this.status = status; this.dados = dados; }
}
const erro = (status, msg, extra = {}) => new Resposta(status, { erro: msg, ...extra });
const invalido = (detalhe) => erro(400, 'Dados inválidos', { detalhes: detalhe });

export function comandosInstalacao(url, token) {
  return {
    windows: `Invoke-WebRequest -UseBasicParsing "${url}/download/farol_agente.py" -OutFile farol_agente.py; `
      + `python -m pip install psutil; python farol_agente.py instalar --servidor "${url}" --token "${token}"`,
    linux: `curl -fsSLO "${url}/download/farol_agente.py" && `
      + `sudo python3 farol_agente.py instalar --servidor "${url}" --token "${token}"`,
  };
}

export function criarServidor({ agora = () => Date.now(), intervaloMs = 3000, atrasoJob = [900, 2600] } = {}) {
  const t0 = agora();
  const ouvintes = new Set();
  const timers = new Set();
  let intervalo = null;
  let seq = { job: 0, alerta: 0, audit: 0, script: 0, token: 0 };

  const sessao = { ativa: true, usuario: 'demo', totpAtivo: true, elevadoAte: 0 };
  const conta = { usuario: 'demo', senha: 'demo' };
  const agentes = criarAgentes(t0);
  const scripts = SCRIPTS_EXEMPLO.map((s) => ({ id: ++seq.script, descricao: '', ...s, criado_em: t0 - 45 * DIA, atualizado_em: t0 - 45 * DIA }));
  const jobs = [];
  const alertas = [];
  const auditoria = [];
  const tokens = [];
  let config = { regras: structuredClone(REGRAS_PADRAO), webhook_url: '' };

  const porHost = (h) => agentes.find((a) => a.hostname === h);
  const porId = (id) => agentes.find((a) => a.id === id);

  // ---------- Tempo real ----------
  function emitir(tipo, dados) {
    const msg = JSON.stringify({ tipo, dados, ts: agora() });
    for (const fn of [...ouvintes]) { try { fn(msg); } catch { /* ouvinte com erro não derruba o servidor */ } }
  }
  function aoMensagem(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }
  function agendar(fn, ms) {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    id.unref?.();
    timers.add(id);
    return id;
  }

  // ---------- Auditoria / alertas ----------
  function auditar({ usuario = sessao.usuario, acao, alvo = null, detalhes = null, ip = IP_DEMO, ts = agora() }) {
    auditoria.push({ id: ++seq.audit, ts, usuario, acao, alvo: alvo == null ? null : String(alvo),
      detalhes: detalhes == null ? null : (typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes)), ip });
  }

  function abrirAlerta(ag, tipo, mensagem, valor, aberto_em = agora(), emitirEvento = true) {
    const existente = alertas.find((a) => a.agente_id === ag.id && a.tipo === tipo && a.status === 'aberto');
    if (existente) { existente.mensagem = mensagem; existente.valor = valor; return null; }
    const al = { id: ++seq.alerta, agente_id: ag.id, tipo, mensagem, valor, status: 'aberto', aberto_em, resolvido_em: null };
    alertas.push(al);
    if (emitirEvento) emitir('alerta', { ...al, hostname: ag.hostname });
    return al;
  }
  function resolverAlertas(ag, tipo) {
    for (const al of alertas.filter((a) => a.agente_id === ag.id && a.tipo === tipo && a.status === 'aberto')) {
      al.status = 'resolvido'; al.resolvido_em = agora();
      emitir('alerta', { id: al.id, agente_id: ag.id, hostname: ag.hostname, tipo, status: 'resolvido', resolvido_em: al.resolvido_em });
    }
  }
  const abertos = () => alertas.filter((a) => a.status === 'aberto').length;
  const alertasAbertosDe = (ag) => alertas.filter((a) => a.agente_id === ag.id && a.status === 'aberto').length;

  // ---------- Visões ----------
  function vista(ag) {
    return {
      id: ag.id, hostname: ag.hostname, so: ag.so, so_versao: ag.so_versao, arquitetura: ag.arquitetura, versao_agente: ag.versao_agente,
      ip_local: ag.ip_local, usuario_logado: ag.usuario_logado, cpu_pct: ag.cpu_pct, ram_usada: ag.ram_usada, ram_total: ag.ram_total,
      disco_max_pct: ag.disco_max_pct, uptime: ag.uptime, status: ag.status, ultimo_checkin: ag.ultimo_checkin, registrado_em: ag.registrado_em,
      alertas_abertos: alertasAbertosDe(ag),
    };
  }
  const resumoJob = (j) => ({ id: j.id, nome: j.nome, shell: j.shell, status: j.status, criado_por: j.criado_por, criado_em: j.criado_em,
    enviado_em: j.enviado_em, concluido_em: j.concluido_em, codigo_saida: j.codigo_saida, duracao_ms: j.duracao_ms });
  const comHost = (j) => ({ ...resumoJob(j), hostname: porId(j.agente_id)?.hostname, agente_id: j.agente_id });

  // ---------- Execução simulada de jobs ----------
  function concluirJob(j) {
    const ag = porId(j.agente_id);
    if (!ag || ag.revogado || j.status !== 'enviado') return;
    const r = simularExecucao(ag, j.shell, j.conteudo);
    j.stdout = r.stdout; j.stderr = r.stderr; j.codigo_saida = r.codigo; j.duracao_ms = r.duracao_ms;
    j.status = r.codigo === 0 ? 'sucesso' : 'falha';
    j.concluido_em = agora();
    emitir('job', { id: j.id, agente_id: j.agente_id, hostname: ag.hostname, nome: j.nome, status: j.status, codigo_saida: j.codigo_saida, concluido_em: j.concluido_em });
  }
  function despachar(j) {
    const ag = porId(j.agente_id);
    if (!ag || ag.status !== 'online') return; // agente offline: o job fica na fila
    const [min, max] = atrasoJob;
    agendar(() => {
      if (j.status !== 'pendente') return;
      j.status = 'enviado'; j.enviado_em = agora();
      emitir('job', { id: j.id, agente_id: j.agente_id, status: 'enviado' });
      agendar(() => concluirJob(j), min + hash32(j.id, 'dur') * (max - min));
    }, 500 + hash32(j.id, 'env') * (min));
  }

  // ---------- Dados iniciais ----------
  function semear() {
    const ago = (ms) => t0 - ms;
    const fixo = (ag, tipo, mensagem, valor, abertoHa, resolvidoApos = null) => {
      const al = abrirAlerta(ag, tipo, mensagem, valor, ago(abertoHa), false);
      if (resolvidoApos != null) { al.status = 'resolvido'; al.resolvido_em = al.aberto_em + resolvidoApos; }
    };
    const web = porHost('SRV-WEB-01'); const dir = porHost('NB-DIRETORIA'); const pdv = porHost('PDV-LOJA-02');
    const rec = porHost('DESKTOP-RECEPCAO'); const sup = porHost('NB-SUPORTE-01'); const bak = porHost('SRV-BACKUP');
    const fin = porHost('NB-FINANCEIRO-03'); const rh = porHost('DESKTOP-RH-02');
    fixo(web, 'cpu', 'CPU em 96% (limite 90%) por 4 check-ins seguidos', 96, 31 * HORA, 18 * MIN);
    fixo(rec, 'offline', 'Sem check-in há 7 min (limite 5 min)', 7, 52 * HORA, 2 * HORA + 4 * MIN);
    fixo(dir, 'ram', 'Memória em 92% (limite 90%) por 5 check-ins seguidos', 92, 27 * HORA, 41 * MIN);
    fixo(pdv, 'disco', 'Disco C:\\ em 91% (limite 90%)', 91, 70 * HORA, 9 * HORA);
    fixo(sup, 'cpu', 'CPU em 93% (limite 90%) por 4 check-ins seguidos', 93, 44 * HORA, 7 * MIN);
    fixo(bak, 'disco', 'Disco /mnt/backup em 93% (limite 90%)', 93.4, 2 * DIA + 3 * HORA);
    const minPdv = Math.floor((t0 - pdv.offlineDesde) / MIN);
    fixo(pdv, 'offline', `Sem check-in há ${minPdv} min (limite 5 min)`, minPdv, t0 - pdv.offlineDesde - 5 * MIN);
    fixo(fin, 'ram', 'Memória em 93% (limite 90%) por 4 check-ins seguidos', 93, 64 * MIN);
    fixo(rh, 'offline', 'Sem check-in há 22 min (limite 5 min)', 22, 22 * MIN);

    // Execuções passadas
    const exec = (minAtras, host, nome, shell, conteudo, scriptId, opcoes = {}) => {
      const ag = porHost(host);
      const criado = ago(minAtras * MIN);
      const j = { id: ++seq.job, agente_id: ag.id, script_id: scriptId ?? null, nome, shell, conteudo, timeout: 60, status: 'pendente', criado_por: 'demo', criado_em: criado, enviado_em: criado + 11_000 };
      const r = simularExecucao(ag, shell, conteudo);
      Object.assign(j, { stdout: r.stdout, stderr: r.stderr, codigo_saida: r.codigo, duracao_ms: r.duracao_ms, status: r.codigo === 0 ? 'sucesso' : 'falha', concluido_em: criado + 11_000 + r.duracao_ms + 4000 }, opcoes);
      jobs.push(j);
      return j;
    };
    const sc = (nome) => scripts.find((s) => s.nome === nome);
    const porScript = (min, host, nome) => { const s = sc(nome); return exec(min, host, s.nome, s.shell, s.conteudo, s.id); };
    const dias = (n, h = 0) => (n * 24 + h) * 60;
    const aud = [];
    const j1 = porScript(dias(2, 6), 'SRV-ARQUIVOS', 'Espaço em disco (Windows)');
    const j2 = porScript(dias(2, 5.9), 'NB-FINANCEIRO-03', 'Serviços automáticos parados');
    const j3 = porScript(dias(2, 3), 'SRV-BACKUP', 'Espaço em disco (Linux)');
    const j4 = porScript(dias(1, 20), 'SRV-WEB-01', 'Informações de rede (Linux)');
    const j5 = porScript(dias(1, 20), 'DESKTOP-RECEPCAO', 'Limpar arquivos temporários');
    const j6 = exec(dias(1, 9), 'SRV-WEB-01', 'Comando: systemctl status nginx', 'bash', 'systemctl status nginx', null);
    const j7 = exec(dias(1, 2), 'NB-DIRETORIA', 'Comando: ipconfig', 'cmd', 'ipconfig', null);
    const j8 = exec(dias(0, 15), 'PDV-LOJA-02', 'Comando: Get-Service | Where-Object Status -eq Stopped', 'powershell', 'Get-Service | Where-Object Status -eq Stopped', null);
    const j9 = porScript(dias(0, 8), 'DESKTOP-RH-02', 'Reiniciar spooler de impressão');
    const j10 = exec(dias(0, 5), 'SRV-BACKUP', 'Comando: free -h', 'bash', 'free -h', null);
    const j11 = porScript(dias(0, 4), 'NB-SUPORTE-01', 'Processos que mais usam CPU');
    const j12 = porScript(dias(0, 3.5), 'NB-FINANCEIRO-03', 'Informações de rede');
    const j13 = exec(dias(0, 2.2), 'SRV-ARQUIVOS', 'Comando: Get-ChildItem D:\\Compartilhado', 'powershell', 'Get-ChildItem D:\\Compartilhado', null);
    Object.assign(j13, { status: 'timeout', codigo_saida: null, stdout: '', stderr: '[agente] Tempo limite de 120 s excedido', duracao_ms: 120_000, concluido_em: j13.enviado_em + 120_000 });
    const j14 = porScript(dias(0, 1.4), 'NB-DIRETORIA', 'Espaço em disco (Windows)');
    const j15 = exec(dias(0, 0.6), 'SRV-WEB-01', 'Comando: uptime', 'bash', 'uptime', null);
    const j16 = exec(dias(0, 0.25), 'NB-FINANCEIRO-03', 'Comando: whoami', 'cmd', 'whoami', null);
    void [j1, j2, j3, j4, j5, j6, j7, j8, j9, j10, j11, j12, j13, j14, j15, j16];

    // Auditoria passada
    const a = (minAtras, acao, alvo, detalhes, usuario = 'demo', ip = IP_DEMO) => aud.push({ ts: ago(minAtras * MIN), usuario, acao, alvo, detalhes, ip });
    a(dias(3, 2), 'admin_criado', 'demo', null);
    a(dias(3, 1.9), 'login', null, null);
    a(dias(3, 1.8), '2fa_ativado', null, null);
    a(dias(3, 1.5), 'token_criado', 'token #1', 'Servidor web', 'demo');
    a(dias(3, 1.4), 'agente_registrado', 'SRV-WEB-01', null, null, '192.168.10.12');
    a(dias(3, 1.2), 'agente_registrado', 'SRV-BACKUP', null, null, '192.168.10.20');
    a(dias(2, 8), 'login', null, null);
    a(dias(2, 7.9), 'login_falha', 'demo', null, 'demo', '198.51.100.77');
    a(dias(2, 6.2), 'modo_elevado', null, null);
    for (const [j, acao] of [[j1, 'script_executado'], [j2, 'script_executado'], [j3, 'script_executado'], [j4, 'script_executado'], [j5, 'script_executado'], [j9, 'script_executado'], [j11, 'script_executado'], [j12, 'script_executado'], [j14, 'script_executado']]) {
      auditoria.push({ id: 0, ts: j.criado_em, usuario: 'demo', acao, alvo: porId(j.agente_id).hostname, detalhes: JSON.stringify({ nome: j.nome, shell: j.shell, jobs: [j.id] }), ip: IP_DEMO });
    }
    for (const j of [j6, j7, j8, j10, j13, j15, j16]) {
      auditoria.push({ id: 0, ts: j.criado_em, usuario: 'demo', acao: 'comando_executado', alvo: porId(j.agente_id).hostname, detalhes: JSON.stringify({ nome: j.nome, shell: j.shell, jobs: [j.id], comando: j.conteudo }), ip: IP_DEMO });
    }
    a(dias(1, 21), 'regras_alteradas', 'alertas', JSON.stringify({ antes: {}, depois: {} }));
    a(dias(1, 12), 'alerta_resolvido', 'alerta #2', null);
    a(dias(1, 1.9), 'login', null, null);
    a(dias(1, 1.8), 'modo_elevado', null, null);
    a(dias(0, 14), 'token_criado', 'token #2', 'Notebook novo - Suporte');
    a(dias(0, 14), 'token_revogado', 'token #2', null);
    a(dias(0, 9), 'login', null, null);
    a(dias(0, 8.1), 'modo_elevado', null, null);
    a(dias(0, 3), 'agente_registro_negado', 'token expirado', null, null, '192.168.30.77');
    a(dias(0, 1.5), 'script_criado', 'Inventário rápido de softwares', null);
    a(dias(0, 0.7), 'login', null, null);
    a(dias(0, 0.3), 'modo_elevado', null, null);
    aud.sort((x, y) => x.ts - y.ts);
    const todos = [...auditoria.splice(0), ...aud].sort((x, y) => x.ts - y.ts);
    for (const e of todos) { e.id = ++seq.audit; auditoria.push(e); }
    jobs.sort((x, y) => x.criado_em - y.criado_em).forEach((j, i) => { j.id = i + 1; });
    // Reajusta os ids dos jobs citados na auditoria
    for (const e of auditoria) {
      if (e.acao !== 'script_executado' && e.acao !== 'comando_executado') continue;
      const d = JSON.parse(e.detalhes);
      const j = jobs.find((x) => x.criado_em === e.ts && porId(x.agente_id).hostname === e.alvo);
      if (j) { d.jobs = [j.id]; e.detalhes = JSON.stringify(d); }
    }
    seq.job = jobs.length;
    // Alertas: reordena ids por data de abertura
    alertas.sort((x, y) => x.aberto_em - y.aberto_em).forEach((al, i) => { al.id = i + 1; });
    seq.alerta = alertas.length;
    tokens.push(
      { id: ++seq.token, token: 'demo', descricao: 'Servidor web', criado_por: 'demo', criado_em: ago(3 * DIA + 1.5 * HORA), expira_em: ago(3 * DIA + 1.5 * HORA) + DIA, usado_em: ago(3 * DIA + 1.4 * HORA), agente_id: web.id },
      { id: ++seq.token, token: 'demo', descricao: 'Notebook novo - Suporte', criado_por: 'demo', criado_em: ago(14 * HORA), expira_em: ago(14 * HORA) + DIA, usado_em: null, agente_id: null },
    );
    // Script extra criado na auditoria
    scripts.push({ id: ++seq.script, nome: 'Inventário rápido de softwares', descricao: 'Lista programas instalados com versão (Windows).', shell: 'powershell', timeout: 60,
      conteudo: 'Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* |\n  Select-Object DisplayName, DisplayVersion |\n  Where-Object DisplayName | Sort-Object DisplayName |\n  Format-Table -AutoSize | Out-String -Width 200',
      criado_em: ago(90 * MIN), atualizado_em: ago(90 * MIN) });
  }
  semear();

  // ---------- Ciclo ao vivo ----------
  function pulso() {
    const agoraMs = agora();
    agentes.forEach((ag, i) => {
      if (ag.revogado || ag.status !== 'online') return;
      agendar(() => {
        if (ag.revogado || ag.status !== 'online') return;
        const t = agora();
        const l = leituraAtual(ag, t);
        if (ag.picoAte && t < ag.picoAte) l.cpu_pct = Math.round((92 + hash32(ag.hostname, Math.floor(t / 3000)) * 6) * 10) / 10;
        Object.assign(ag, l);
        ag.uptime += intervaloMs / 1000;
        ag.ultimo_checkin = t;
        emitir('checkin', {
          id: ag.id, hostname: ag.hostname, status: 'online', cpu_pct: ag.cpu_pct, ram_usada: ag.ram_usada, ram_total: ag.ram_total,
          disco_max_pct: ag.disco_max_pct, uptime: ag.uptime, ip_local: ag.ip_local, usuario_logado: ag.usuario_logado, ultimo_checkin: t,
        });
      }, (i * intervaloMs) / agentes.length);
    });
    void agoraMs;
  }

  function iniciar() {
    if (intervalo) return;
    pulso();
    intervalo = setInterval(pulso, intervaloMs);
    intervalo.unref?.();
    // Um pico de CPU no servidor web, para mostrar um alerta chegando ao vivo e se resolvendo.
    agendar(() => {
      const web = porHost('SRV-WEB-01');
      if (!web || web.revogado || web.status !== 'online') return;
      web.picoAte = agora() + 24_000;
      abrirAlerta(web, 'cpu', 'CPU em 95% (limite 90%) por 4 check-ins seguidos', 95);
      agendar(() => resolverAlertas(web, 'cpu'), 30_000);
    }, 70_000);
  }
  function parar() {
    if (intervalo) clearInterval(intervalo);
    intervalo = null;
    for (const t of timers) clearTimeout(t);
    timers.clear();
  }

  // ---------- Rotas ----------
  const exigirLogin = () => { if (!sessao.ativa) throw erro(401, 'Sessão inválida ou expirada'); };
  const exigirElevado = () => {
    if (!sessao.totpAtivo) throw erro(403, 'Ative o 2FA em Configurações para executar scripts', { precisa2fa: true });
    if (sessao.elevadoAte <= agora()) throw erro(403, 'Confirme o código 2FA para continuar', { precisaElevar: true });
  };
  const corpoObj = (c) => { if (c == null || typeof c !== 'object' || Array.isArray(c)) throw invalido('body must be object'); return c; };
  const semExtras = (c, permitidos) => { for (const k of Object.keys(c)) if (!permitidos.includes(k)) throw invalido(`body must NOT have additional properties: ${k}`); };
  const texto = (v, nome, min, max) => {
    if (typeof v !== 'string') throw invalido(`body/${nome} must be string`);
    if (v.length < min) throw invalido(`body/${nome} must NOT have fewer than ${min} characters`);
    if (v.length > max) throw invalido(`body/${nome} must NOT have more than ${max} characters`);
    return v;
  };
  const inteiro = (v, nome, min, max) => {
    if (!Number.isInteger(v)) throw invalido(`body/${nome} must be integer`);
    if (v < min) throw invalido(`body/${nome} must be >= ${min}`);
    if (v > max) throw invalido(`body/${nome} must be <= ${max}`);
    return v;
  };
  const senhaFraca = (s) => {
    if (s.length < 10) return 'A senha deve ter pelo menos 10 caracteres';
    const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(s)).length;
    return tipos < 3 ? 'Use pelo menos 3 tipos de caracteres: minúsculas, maiúsculas, números e símbolos' : null;
  };

  function validarScript(b) {
    corpoObj(b);
    semExtras(b, ['nome', 'descricao', 'shell', 'conteudo', 'timeout']);
    for (const k of ['nome', 'shell', 'conteudo']) if (!(k in b)) throw invalido(`body must have required property '${k}'`);
    texto(b.nome, 'nome', 1, 120);
    if (b.descricao !== undefined) texto(b.descricao, 'descricao', 0, 500);
    if (!SHELLS.includes(b.shell)) throw invalido('body/shell must be equal to one of the allowed values');
    texto(b.conteudo, 'conteudo', 1, 100_000);
    if (b.timeout !== undefined) inteiro(b.timeout, 'timeout', 5, 3600);
    return b;
  }

  const rotas = [];
  const rota = (metodo, padrao, fn, publica = false) => rotas.push({ metodo, padrao: new RegExp(`^${padrao}$`), fn, publica });

  // Autenticação
  rota('GET', '/api/estado', () => ({ precisaSetup: false, autenticado: sessao.ativa, usuario: sessao.ativa ? sessao.usuario : null,
    totpAtivo: sessao.ativa && sessao.totpAtivo, elevadoAte: sessao.ativa ? sessao.elevadoAte : 0, agora: agora() }), true);
  rota('POST', '/api/setup', () => { throw erro(409, 'O administrador já foi criado'); }, true);
  rota('POST', '/api/login', ({ corpo }) => {
    corpoObj(corpo);
    if (corpo.usuario !== conta.usuario || corpo.senha !== conta.senha) {
      auditar({ usuario: corpo.usuario ?? null, acao: 'login_falha', alvo: corpo.usuario ?? null });
      throw erro(401, 'Usuário ou senha inválidos');
    }
    if (sessao.totpAtivo) {
      if (!corpo.codigo) throw erro(401, 'Informe o código do autenticador', { precisa2fa: true });
      if (corpo.codigo !== CODIGO_2FA) { auditar({ acao: 'login_falha', alvo: conta.usuario, detalhes: '2fa' }); throw erro(401, 'Código 2FA inválido', { precisa2fa: true }); }
    }
    sessao.ativa = true; sessao.elevadoAte = 0;
    auditar({ acao: 'login' });
    return { ok: true, usuario: conta.usuario, totpAtivo: sessao.totpAtivo };
  }, true);
  rota('POST', '/api/logout', () => { if (sessao.ativa) auditar({ acao: 'logout' }); sessao.ativa = false; sessao.elevadoAte = 0; return { ok: true }; }, true);
  rota('POST', '/api/senha', ({ corpo }) => {
    corpoObj(corpo);
    if (corpo.atual !== conta.senha) throw erro(400, 'Senha atual incorreta');
    texto(corpo.nova ?? '', 'nova', 10, 256);
    const fraca = senhaFraca(corpo.nova);
    if (fraca) throw erro(400, fraca);
    conta.senha = corpo.nova;
    auditar({ acao: 'senha_alterada' });
    return { ok: true };
  });
  rota('POST', '/api/2fa/iniciar', () => { throw erro(409, '2FA já está ativo'); });
  rota('POST', '/api/2fa/ativar', () => { throw erro(400, 'Inicie a configuração do 2FA primeiro'); });
  rota('POST', '/api/elevar', ({ corpo }) => {
    corpoObj(corpo);
    if (!sessao.totpAtivo) throw erro(403, 'Ative o 2FA em Configurações primeiro', { precisa2fa: true });
    if (!/^\d{6}$/.test(String(corpo.codigo ?? ''))) throw invalido('body/codigo must match pattern "^\\d{6}$"');
    if (corpo.codigo !== CODIGO_2FA) { auditar({ acao: 'elevacao_falha' }); throw erro(401, 'Código 2FA inválido'); }
    sessao.elevadoAte = agora() + MINUTOS_ELEVADO * MIN;
    auditar({ acao: 'modo_elevado' });
    return { ok: true, elevadoAte: sessao.elevadoAte };
  });

  // Visão geral e agentes
  rota('GET', '/api/resumo', () => {
    const ativos = agentes.filter((a) => !a.revogado);
    const pior = (a) => Math.max(a.cpu_pct ?? 0, a.ram_total ? (a.ram_usada * 100) / a.ram_total : 0, a.disco_max_pct ?? 0);
    return {
      total: ativos.length, online: ativos.filter((a) => a.status === 'online').length, offline: ativos.filter((a) => a.status !== 'online').length,
      alertasAbertos: abertos(),
      piores: ativos.filter((a) => a.status === 'online').sort((x, y) => pior(y) - pior(x)).slice(0, 5).map(vista),
      execucoes: [...jobs].sort((x, y) => y.id - x.id).slice(0, 8).map((j) => ({ id: j.id, nome: j.nome, status: j.status, criado_em: j.criado_em, concluido_em: j.concluido_em,
        criado_por: j.criado_por, codigo_saida: j.codigo_saida, hostname: porId(j.agente_id)?.hostname, agente_id: j.agente_id })),
    };
  });
  rota('GET', '/api/agentes', () => agentes.filter((a) => !a.revogado).sort((x, y) => x.hostname.localeCompare(y.hostname, 'en', { sensitivity: 'base' })).map(vista));
  rota('GET', '/api/agentes/([0-9a-f-]{36})', ({ p }) => {
    const a = porId(p[0]);
    if (!a) throw erro(404, 'Agente não encontrado');
    return { ...vista(a), revogado: a.revogado, discos: structuredClone(a.discos), inventario: structuredClone(a.inventario), inventario_em: a.inventario_em };
  });
  rota('GET', '/api/agentes/([0-9a-f-]{36})/metricas', ({ p, query }) => {
    const a = porId(p[0]);
    const horas = query.has('horas') ? Number(query.get('horas')) : 24;
    if (!Number.isInteger(horas) || horas < 1 || horas > 168) throw invalido('querystring/horas must be integer between 1 and 168');
    if (!a) return { horas, baldeMs: 300_000, desde: agora() - horas * HORA, pontos: [] };
    return gerarMetricas(a, horas, agora());
  });
  rota('GET', '/api/agentes/([0-9a-f-]{36})/jobs', ({ p }) => jobs.filter((j) => j.agente_id === p[0]).sort((x, y) => y.id - x.id).slice(0, 50).map(resumoJob));
  rota('POST', '/api/agentes/([0-9a-f-]{36})/revogar', ({ p }) => {
    const a = porId(p[0]);
    if (!a) throw erro(404, 'Agente não encontrado');
    if (a.revogado) throw erro(409, 'Agente já revogado');
    a.revogado = 1; a.status = 'revogado';
    for (const j of jobs) if (j.agente_id === a.id && ['pendente', 'enviado'].includes(j.status)) j.status = 'cancelado';
    for (const al of alertas) if (al.agente_id === a.id && al.status === 'aberto') { al.status = 'resolvido'; al.resolvido_em = agora(); }
    auditar({ acao: 'agente_revogado', alvo: `${a.hostname} (${a.id})` });
    emitir('agente', { id: a.id, hostname: a.hostname, status: 'revogado' });
    return { ok: true };
  });

  // Tokens de instalação
  rota('GET', '/api/tokens-instalacao', () => [...tokens].reverse().slice(0, 50).map((t) => ({ id: t.id, descricao: t.descricao, criado_por: t.criado_por, criado_em: t.criado_em,
    expira_em: t.expira_em, usado_em: t.usado_em, agente_id: t.agente_id, hostname: t.agente_id ? porId(t.agente_id)?.hostname ?? null : null })));
  rota('POST', '/api/tokens-instalacao', ({ corpo }) => {
    const b = corpo ?? {};
    corpoObj(b);
    semExtras(b, ['descricao']);
    if (b.descricao !== undefined) texto(b.descricao, 'descricao', 0, 120);
    const token = `demo_${Array.from({ length: 38 }, (_, i) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789_-'[Math.floor(hash32(seq.token, agora(), i) * 54)]).join('')}`;
    const t = { id: ++seq.token, token: 'ficticio', descricao: b.descricao || null, criado_por: sessao.usuario, criado_em: agora(), expira_em: agora() + DIA, usado_em: null, agente_id: null };
    tokens.push(t);
    auditar({ acao: 'token_criado', alvo: `token #${t.id}`, detalhes: b.descricao || null });
    return { id: t.id, token, expira_em: t.expira_em, servidor: SERVIDOR_FICTICIO, comandos: comandosInstalacao(SERVIDOR_FICTICIO, token) };
  });
  rota('DELETE', '/api/tokens-instalacao/(\\d+)', ({ p }) => {
    const i = tokens.findIndex((t) => t.id === Number(p[0]) && !t.usado_em);
    if (i < 0) throw erro(404, 'Token não encontrado ou já usado');
    tokens.splice(i, 1);
    auditar({ acao: 'token_revogado', alvo: `token #${p[0]}` });
    return { ok: true };
  });

  // Scripts
  rota('GET', '/api/scripts', () => [...scripts].sort((x, y) => x.nome.localeCompare(y.nome, 'en', { sensitivity: 'base' })));
  rota('GET', '/api/scripts/(\\d+)', ({ p }) => scripts.find((s) => s.id === Number(p[0])) ?? (() => { throw erro(404, 'Script não encontrado'); })());
  rota('POST', '/api/scripts', ({ corpo }) => {
    const b = validarScript(corpo);
    const s = { id: ++seq.script, nome: b.nome, descricao: b.descricao ?? '', shell: b.shell, conteudo: b.conteudo, timeout: b.timeout ?? 60, criado_em: agora(), atualizado_em: agora() };
    scripts.push(s);
    auditar({ acao: 'script_criado', alvo: b.nome });
    return { ...s };
  });
  rota('PUT', '/api/scripts/(\\d+)', ({ p, corpo }) => {
    const b = validarScript(corpo);
    const s = scripts.find((x) => x.id === Number(p[0]));
    if (!s) throw erro(404, 'Script não encontrado');
    Object.assign(s, { nome: b.nome, descricao: b.descricao ?? '', shell: b.shell, conteudo: b.conteudo, timeout: b.timeout ?? 60, atualizado_em: agora() });
    auditar({ acao: 'script_alterado', alvo: b.nome });
    return { ...s };
  });
  rota('DELETE', '/api/scripts/(\\d+)', ({ p }) => {
    const i = scripts.findIndex((x) => x.id === Number(p[0]));
    if (i < 0) throw erro(404, 'Script não encontrado');
    const [s] = scripts.splice(i, 1);
    auditar({ acao: 'script_excluido', alvo: s.nome });
    return { ok: true };
  });

  // Execução
  rota('POST', '/api/executar', ({ corpo }) => {
    exigirElevado();
    const b = corpoObj(corpo);
    semExtras(b, ['agentes', 'script_id', 'comando', 'shell', 'timeout']);
    if (!Array.isArray(b.agentes)) throw invalido("body must have required property 'agentes'");
    if (b.agentes.length < 1) throw invalido('body/agentes must NOT have fewer than 1 items');
    if (b.agentes.length > 500) throw invalido('body/agentes must NOT have more than 500 items');
    if (new Set(b.agentes).size !== b.agentes.length) throw invalido('body/agentes must NOT have duplicate items');
    if (!b.agentes.every((id) => typeof id === 'string' && UUID.test(id))) throw invalido('body/agentes/0 must match pattern "^[0-9a-f-]{36}$"');
    if (b.shell !== undefined && !SHELLS.includes(b.shell)) throw invalido('body/shell must be equal to one of the allowed values');
    if (b.comando !== undefined) texto(b.comando, 'comando', 1, 20_000);
    if (b.timeout !== undefined) inteiro(b.timeout, 'timeout', 5, 3600);
    let nome; let shell; let conteudo; let timeout;
    if (b.script_id) {
      inteiro(b.script_id, 'script_id', 1, Number.MAX_SAFE_INTEGER);
      const s = scripts.find((x) => x.id === b.script_id);
      if (!s) throw erro(404, 'Script não encontrado');
      ({ nome, shell, conteudo } = s);
      timeout = b.timeout ?? s.timeout;
    } else if (b.comando && b.shell) {
      nome = `Comando: ${b.comando.split('\n')[0].slice(0, 60)}`;
      shell = b.shell; conteudo = b.comando; timeout = b.timeout ?? 60;
    } else {
      throw erro(400, 'Informe script_id ou comando + shell');
    }
    const alvos = b.agentes.map((id) => porId(id)).filter((a) => a && !a.revogado);
    if (alvos.length !== b.agentes.length) throw erro(400, 'Agente inexistente ou revogado na seleção');
    const criado = agora();
    const novos = alvos.map((a) => {
      const j = { id: ++seq.job, agente_id: a.id, script_id: b.script_id ?? null, nome, shell, conteudo, timeout, status: 'pendente', criado_por: sessao.usuario, criado_em: criado,
        enviado_em: null, concluido_em: null, codigo_saida: null, stdout: null, stderr: null, duracao_ms: null };
      jobs.push(j);
      return j;
    });
    auditar({ acao: b.script_id ? 'script_executado' : 'comando_executado', alvo: alvos.map((a) => a.hostname).join(', '),
      detalhes: { nome, shell, jobs: novos.map((j) => j.id), ...(b.script_id ? {} : { comando: conteudo.slice(0, 500) }) } });
    const saida = novos.map((j) => ({ id: j.id, agente_id: j.agente_id, hostname: porId(j.agente_id).hostname }));
    for (const j of novos) {
      emitir('job', { id: j.id, agente_id: j.agente_id, hostname: porId(j.agente_id).hostname, nome, status: 'pendente', criado_em: criado, criado_por: sessao.usuario });
      despachar(j);
    }
    return { jobs: saida };
  });
  rota('GET', '/api/jobs', ({ query }) => {
    const limite = query.has('limite') ? Number(query.get('limite')) : 50;
    if (!Number.isInteger(limite) || limite < 1 || limite > 200) throw invalido('querystring/limite must be integer between 1 and 200');
    return [...jobs].sort((x, y) => y.id - x.id).slice(0, limite).map(comHost);
  });
  rota('GET', '/api/jobs/(\\d+)', ({ p }) => {
    const j = jobs.find((x) => x.id === Number(p[0]));
    if (!j) throw erro(404, 'Job não encontrado');
    return { ...j, hostname: porId(j.agente_id)?.hostname };
  });

  // Alertas
  rota('GET', '/api/alertas', ({ query }) => {
    const status = query.get('status') ?? 'todos';
    if (!['aberto', 'resolvido', 'todos'].includes(status)) throw invalido('querystring/status must be equal to one of the allowed values');
    return alertas.filter((a) => status === 'todos' || a.status === status).sort((x, y) => (y.status === 'aberto') - (x.status === 'aberto') || y.id - x.id)
      .slice(0, 300).map((a) => ({ ...a, hostname: porId(a.agente_id)?.hostname }));
  });
  rota('POST', '/api/alertas/(\\d+)/resolver', ({ p }) => {
    const al = alertas.find((a) => a.id === Number(p[0]) && a.status === 'aberto');
    if (!al) throw erro(404, 'Alerta não encontrado ou já resolvido');
    al.status = 'resolvido'; al.resolvido_em = agora();
    auditar({ acao: 'alerta_resolvido', alvo: `alerta #${al.id}` });
    emitir('alerta', { id: al.id, status: 'resolvido' });
    return { ok: true };
  });

  // Configurações
  rota('GET', '/api/config', () => structuredClone(config));
  rota('PUT', '/api/config', ({ corpo }) => {
    const b = corpoObj(corpo);
    semExtras(b, ['regras', 'webhook_url']);
    const r = b.regras;
    if (!r || typeof r !== 'object') throw invalido("body must have required property 'regras'");
    for (const k of ['cpu', 'ram', 'disco', 'offline']) if (!r[k] || typeof r[k] !== 'object') throw invalido(`body/regras must have required property '${k}'`);
    for (const k of ['cpu', 'ram', 'disco']) {
      if (typeof r[k].ativo !== 'boolean') throw invalido(`body/regras/${k}/ativo must be boolean`);
      if (typeof r[k].limite !== 'number' || r[k].limite < 1 || r[k].limite > 100) throw invalido(`body/regras/${k}/limite must be between 1 and 100`);
      if (k !== 'disco' && (!Number.isInteger(r[k].ciclos) || r[k].ciclos < 1 || r[k].ciclos > 100)) throw invalido(`body/regras/${k}/ciclos must be integer between 1 and 100`);
    }
    if (typeof r.offline.ativo !== 'boolean') throw invalido('body/regras/offline/ativo must be boolean');
    if (!Number.isInteger(r.offline.minutos) || r.offline.minutos < 1 || r.offline.minutos > 10_080) throw invalido('body/regras/offline/minutos must be integer between 1 and 10080');
    if (b.webhook_url !== undefined) {
      texto(b.webhook_url, 'webhook_url', 0, 500);
      if (!/^(https?:\/\/\S+)?$/.test(b.webhook_url)) throw invalido('body/webhook_url must match pattern "^(https?://\\S+)?$"');
    }
    const antes = structuredClone(config);
    config = { regras: structuredClone(r), webhook_url: b.webhook_url !== undefined ? b.webhook_url : config.webhook_url };
    auditar({ acao: 'regras_alteradas', alvo: 'alertas', detalhes: { antes, depois: b } });
    return structuredClone(config);
  });
  rota('POST', '/api/config/webhook-teste', () => {
    if (!config.webhook_url) throw erro(400, 'Nenhum webhook configurado');
    auditar({ acao: 'webhook_testado', detalhes: 'ok (simulado)' });
    return { ok: true };
  });

  // Auditoria
  rota('GET', '/api/auditoria', ({ query }) => {
    const limite = query.has('limite') ? Number(query.get('limite')) : 200;
    if (!Number.isInteger(limite) || limite < 1 || limite > 1000) throw invalido('querystring/limite must be integer between 1 and 1000');
    const acao = query.get('acao'); const usuario = query.get('usuario'); const q = (query.get('q') ?? '').toLowerCase();
    const linhas = auditoria.filter((e) => (!acao || e.acao === acao) && (!usuario || e.usuario === usuario)
      && (!q || [e.alvo, e.detalhes, e.ip].some((v) => (v ?? '').toLowerCase().includes(q)))).sort((x, y) => y.id - x.id).slice(0, limite);
    return {
      linhas: linhas.map((e) => ({ ...e })),
      acoes: [...new Set(auditoria.map((e) => e.acao))].sort(),
      usuarios: [...new Set(auditoria.map((e) => e.usuario).filter(Boolean))].sort(),
    };
  });

  /** Equivalente a fetch(): devolve { status, dados }. Nunca lança. */
  async function requisitar(metodo, caminho, corpo) {
    const url = new URL(caminho, 'http://farol.demo');
    const path = url.pathname;
    for (const r of rotas) {
      if (r.metodo !== metodo) continue;
      const m = r.padrao.exec(path);
      if (!m) continue;
      try {
        if (!r.publica) exigirLogin();
        const dados = r.fn({ p: m.slice(1), query: url.searchParams, corpo });
        return { status: 200, dados: JSON.parse(JSON.stringify(dados)) };
      } catch (e) {
        if (e instanceof Resposta) return { status: e.status, dados: e.dados };
        console.error(e);
        return { status: 500, dados: { erro: 'Erro interno' } };
      }
    }
    const existe = rotas.some((r) => r.padrao.test(path));
    return existe ? { status: 405, dados: { erro: 'Método não permitido' } } : { status: 404, dados: { erro: 'Rota não encontrada' } };
  }

  return { requisitar, aoMensagem, iniciar, parar, emitir, _estado: { agentes, jobs, alertas, auditoria, scripts, sessao } };
}
