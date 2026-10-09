// Simulador de saídas de scripts e comandos rápidos (nada é executado de verdade).
// Módulo puro (sem DOM). Entrada: o agente fictício, o interpretador e o texto do script.
import { hash32, DIA, HORA, MIN } from './demo-dados.js';

const GB = 1024 ** 3;
const fmtG = (b) => `${Math.round(b / GB)}G`;
const ptNum = (n, c = 1) => n.toFixed(c).replace('.', ',');
const pad = (s, n) => String(s).padEnd(n);
const padE = (s, n) => String(s).padStart(n);

function tabela(colunas, linhas) {
  const larg = colunas.map((c, i) => Math.max(c.length, ...linhas.map((l) => String(l[i]).length)));
  const fmt = (l) => l.map((v, i) => pad(v, larg[i])).join(' ').trimEnd();
  return [fmt(colunas), fmt(larg.map((n) => '-'.repeat(n))), ...linhas.map(fmt)].join('\n');
}

const SERVICOS_PARADOS = [
  ['edgeupdate', 'Serviço do Microsoft Edge Update (edgeupdate)'], ['gupdate', 'Serviço do Google Update (gupdate)'],
  ['MapsBroker', 'Gerenciador de Mapas Baixados'], ['sppsvc', 'Proteção de Software'], ['WbioSrvc', 'Serviço de Biometria do Windows'],
  ['GoogleChromeElevationService', 'Google Chrome Elevation Service (GoogleChromeElevationService)'], ['RemoteRegistry', 'Registro Remoto'],
  ['TrustedInstaller', 'Instalador de Módulos do Windows'], ['wuauserv', 'Windows Update'], ['ClickToRunSvc', 'Microsoft Office Click-to-Run Service'],
];
const SERVICOS_WIN = [
  ['Running', 'Appinfo', 'Informações do Aplicativo'], ['Running', 'BFE', 'Mecanismo de Filtragem Base'], ['Running', 'BITS', 'Serviço de Transferência Inteligente em Segundo Plano'],
  ['Running', 'Dhcp', 'Cliente DHCP'], ['Running', 'Dnscache', 'Cliente DNS'], ['Running', 'EventLog', 'Log de Eventos do Windows'],
  ['Running', 'FarolAgente', 'Farol Agente'], ['Running', 'LanmanServer', 'Servidor'], ['Running', 'LanmanWorkstation', 'Estação de Trabalho'],
  ['Running', 'mpssvc', 'Firewall do Windows Defender'], ['Running', 'nsi', 'Serviço de Interface de Rede'], ['Running', 'Spooler', 'Spooler de Impressão'],
  ['Running', 'W32Time', 'Hora do Windows'], ['Running', 'WinRM', 'Gerenciamento Remoto do Windows (WS-Management)'], ['Stopped', 'RemoteRegistry', 'Registro Remoto'],
  ['Stopped', 'MapsBroker', 'Gerenciador de Mapas Baixados'], ['Stopped', 'wuauserv', 'Windows Update'],
];
const PROCESSOS_WIN = [
  ['System', 4, 0.8, 0.1], ['svchost', 1184, 1.4, 0.4], ['MsMpEng', 3420, 2.1, 1.6], ['explorer', 6012, 0.9, 1.2], ['chrome', 9344, 4.8, 3.6], ['msedge', 7788, 2.3, 2.4],
  ['Teams', 8216, 3.1, 2.8], ['OUTLOOK', 10224, 0.7, 1.5], ['EXCEL', 11500, 1.8, 1.9], ['FarolAgente', 2216, 0.3, 0.2], ['bdservicehost', 2872, 1.1, 0.9], ['SearchIndexer', 5176, 0.4, 0.5],
];
const PROCESSOS_LINUX = [
  ['systemd', 1, 0.1, 0.2], ['nginx', 1422, 2.4, 0.8], ['dockerd', 988, 1.6, 2.1], ['postgres', 2310, 3.2, 4.4], ['node', 3891, 4.9, 3.1], ['python3', 721, 0.3, 0.2],
  ['sshd', 702, 0.0, 0.1], ['cron', 611, 0.0, 0.0], ['fail2ban-server', 744, 0.6, 0.5], ['containerd', 901, 0.5, 0.7], ['rsyslogd', 655, 0.1, 0.1], ['borg', 8123, 6.7, 1.9],
];

const ehWin = (ag) => ag.so === 'Windows';
const sistemaDisco = (ag) => ag.discos ?? [];
const mac = (ag, i = 0) => ag.inventario.rede[i]?.mac ?? '00:00:00:00:00:00';
const ifaceAtiva = (ag) => ag.inventario.rede.find((n) => n.ativa && n.ipv4.some((ip) => !ip.startsWith('127.') && ip !== '172.17.0.1')) ?? ag.inventario.rede[0];
const gateway = (ag) => ag.ip_local.replace(/\.\d+$/, '.1');
const prefixo = (ag) => (ag.ip_local.startsWith('192.168.10.') ? 24 : 24);

function saidaIpconfig(ag, completo) {
  const n = ifaceAtiva(ag);
  const nomeIf = /^Wi-Fi/.test(n.nome) ? 'Adaptador de Rede sem Fio Wi-Fi' : 'Adaptador Ethernet Ethernet';
  const base = [
    'Configuração de IP do Windows', '',
    ...(completo ? [`   Nome do Host. . . . . . . . . . . . : ${ag.hostname}`, '   Sufixo DNS Primário . . . . . . . : empresa.local', '   Tipo de Nó. . . . . . . . . . . . : Híbrido',
      '   Roteamento de IP Habilitado . . . : Não', '   Proxy WINS Habilitado . . . . . . : Não', '   Lista de Pesquisa de Sufixo DNS . : empresa.local', ''] : []),
    `${nomeIf}:`, '',
    '   Sufixo DNS específico de conexão. : empresa.local',
    ...(completo ? [`   Descrição . . . . . . . . . . . . : ${/Wi-Fi/.test(n.nome) ? 'Intel(R) Wi-Fi 6E AX211 160MHz' : 'Intel(R) Ethernet Connection (14) I219-LM'}`,
      `   Endereço Físico . . . . . . . . . : ${mac(ag).replaceAll(':', '-')}`, '   DHCP Habilitado . . . . . . . . . : Sim', '   Configuração Automática Habilitada: Sim'] : []),
    `   Endereço IPv6 de Link Local . . . : ${n.ipv6[0] ?? 'fe80::1'}%12(Preferencial)`,
    `   Endereço IPv4. . . . . . . . . . . . : ${n.ipv4[0]}(Preferencial)`,
    '   Máscara de Sub-rede . . . . . . . : 255.255.255.0',
    ...(completo ? [`   Concessão Obtida. . . . . . . . . : ${dataAgora(new Date(Date.now() - 20 * HORA)).longa}`, `   Concessão Expira. . . . . . . . . : ${dataAgora(new Date(Date.now() + 4 * DIA)).longa}`] : []),
    `   Gateway Padrão. . . . . . . . . . : ${gateway(ag)}`,
    ...(completo ? [`   Servidor DHCP . . . . . . . . . . : ${gateway(ag)}`] : []),
    `   Servidores DNS. . . . . . . . . . : ${ag.ip_local.startsWith('192.168.10.') ? '192.168.10.5' : '192.168.10.5'}`,
    '                                       1.1.1.1',
  ];
  return base.join('\n');
}

function saidaIpAddr(ag, breve) {
  const nics = ag.inventario.rede;
  if (breve) {
    return nics.map((n) => `${pad(n.nome, 16)}${pad(n.nome === 'lo' ? 'UNKNOWN' : n.ativa ? 'UP' : 'DOWN', 15)}${n.ipv4.map((ip) => `${ip}/${n.nome === 'lo' ? 8 : n.nome === 'docker0' ? 16 : 24}`).concat(n.ipv6.map((ip) => `${ip}/${n.nome === 'lo' ? 128 : 64}`)).join(' ')}`.trimEnd()).join('\n');
  }
  return nics.map((n, i) => {
    const l = [`${i + 1}: ${n.nome}: <${n.nome === 'lo' ? 'LOOPBACK,UP,LOWER_UP' : n.ativa ? 'BROADCAST,MULTICAST,UP,LOWER_UP' : 'NO-CARRIER,BROADCAST,MULTICAST,UP'}> mtu ${n.nome === 'lo' ? 65536 : 1500} qdisc ${n.nome === 'lo' ? 'noqueue' : 'fq_codel'} state ${n.nome === 'lo' ? 'UNKNOWN' : n.ativa ? 'UP' : 'DOWN'} group default qlen 1000`];
    l.push(n.nome === 'lo' ? '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00' : `    link/ether ${(n.mac ?? '').toLowerCase()} brd ff:ff:ff:ff:ff:ff`);
    for (const ip of n.ipv4) l.push(`    inet ${ip}/${n.nome === 'lo' ? 8 : n.nome === 'docker0' ? 16 : 24} ${n.nome === 'lo' ? 'scope host lo' : `brd ${ip.replace(/\.\d+$/, '.255')} scope global ${n.nome}`}`, '       valid_lft forever preferred_lft forever');
    for (const ip of n.ipv6) l.push(`    inet6 ${ip}/${n.nome === 'lo' ? 128 : 64} scope ${n.nome === 'lo' ? 'host' : 'link'}`, '       valid_lft forever preferred_lft forever');
    return l.join('\n');
  }).join('\n');
}

function saidaIpRoute(ag) {
  const n = ifaceAtiva(ag).nome;
  const l = [`default via ${gateway(ag)} dev ${n} proto dhcp src ${ag.ip_local} metric 100`, `${ag.ip_local.replace(/\.\d+$/, '.0')}/24 dev ${n} proto kernel scope link src ${ag.ip_local} metric 100`];
  if (ag.inventario.rede.some((x) => x.nome === 'docker0')) l.push('172.17.0.0/16 dev docker0 proto kernel scope link src 172.17.0.1 linkdown');
  return l.join('\n');
}

const RESOLV = (ag) => `nameserver ${ag.ip_local.startsWith('192.168.10.') ? '127.0.0.53' : '127.0.0.53'}\noptions edns0 trust-ad\nsearch empresa.local`;

function saidaDfLinux(ag) {
  const linhas = sistemaDisco(ag).map((d, i) => {
    const disp = d.total - d.usado;
    const dev = d.ponto === '/' ? '/dev/sda2' : d.ponto === '/boot/efi' ? '/dev/sda1' : d.ponto === '/var' ? '/dev/mapper/vg0-var' : '/dev/sdb1';
    return [dev, fmtG(d.total), fmtG(d.usado), fmtG(disp), `${Math.round(d.pct)}%`, d.ponto, i];
  });
  const w = Math.max(10, ...linhas.map((l) => l[0].length)) + 2;
  return [`${pad('Filesystem', w)}Size  Used Avail Use% Mounted on`,
    ...linhas.map((l) => `${pad(l[0], w)}${padE(l[1], 4)}  ${padE(l[2], 4)} ${padE(l[3], 5)} ${padE(l[4], 4)} ${l[5]}`)].join('\n');
}

function saidaDiscosWin(ag) {
  const linhas = sistemaDisco(ag).map((d) => [d.ponto.replace(/\\$/, ''), ptNum(d.total / GB), ptNum((d.total - d.usado) / GB), ptNum(d.pct)]);
  const cols = ['DeviceID', 'Tamanho (GB)', 'Livre (GB)', 'Uso %'];
  const larg = cols.map((c, i) => Math.max(c.length, ...linhas.map((l) => l[i].length)));
  const fmt = (l) => l.map((v, i) => (i === 0 ? pad(v, larg[i]) : padE(v, larg[i]))).join(' ');
  return ['', fmt(cols), larg.map((n) => '-'.repeat(n)).join(' '), ...linhas.map(fmt), ''].join('\n');
}

function saidaFree(ag) {
  const tot = ag.ram_total / GB;
  const usada = (ag.ram_usada ?? ag.ram_total * 0.5) / GB;
  const f = (n) => `${n.toFixed(1)}Gi`;
  return `               total        used        free      shared  buff/cache   available\nMem:      ${padE(f(tot), 10)}  ${padE(f(usada * 0.8), 10)}  ${padE(f(Math.max(0.2, tot - usada)), 10)}  ${padE('0.1Gi', 10)}  ${padE(f(usada * 0.2), 10)}  ${padE(f(Math.max(0.4, tot - usada * 0.8)), 10)}\nSwap:     ${padE('2.0Gi', 10)}  ${padE('0.0Gi', 10)}  ${padE('2.0Gi', 10)}`;
}

function saidaProcessosPsutil(ag) {
  const base = ehWin(ag) ? PROCESSOS_WIN : PROCESSOS_LINUX;
  const t = Math.floor(Date.now() / 5000);
  return base.map(([n, pid, cpu]) => [cpu * (0.6 + hash32(ag.hostname, n, t) * 0.9), pid, ehWin(ag) ? `${n}.exe` : n]).sort((a, b) => b[0] - a[0]).slice(0, 10)
    .map(([c, pid, n]) => `${padE(c.toFixed(1), 6)}%  ${padE(pid, 7)}  ${n}`).join('\n');
}

function uptimeTexto(ag) {
  const s = ag.uptime ?? 3600;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return { d, h, m };
}

function dataAgora(d = new Date()) {
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const p2 = (n) => String(n).padStart(2, '0');
  return { d, longa: `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`, hora: `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}` };
}

function listagem(ag, caminho, longo) {
  if (ehWin(ag)) {
    const dt = new Date(Date.now() - 2 * DIA); const p2 = (n) => String(n).padStart(2, '0'); const dataDir = `${p2(dt.getDate())}/${p2(dt.getMonth() + 1)}/${dt.getFullYear()}  08:12`;
    const itens = [['d----', 'PerfLogs'], ['d-r--', 'Program Files'], ['d-r--', 'Program Files (x86)'], ['d----', 'Windows'], ['d-r--', 'Users'], ['d----', 'Farol'], ['-a---', 'pagefile.sys', 4294967296]];
    return `\n    Diretório: C:\\\n\nMode                 LastWriteTime         Length Name\n----                 -------------         ------ ----\n${itens.map(([m, n, t]) => `${pad(m, 8)} ${pad(dataDir, 22)}${padE(t ?? '', 14)} ${n}`.replace(/\s+$/, '')).join('\n')}\n`;
  }
  const nomes = ag.perfil.hostname === 'SRV-WEB-01' ? ['app', 'backups', 'docker-compose.yml', 'logs', 'nginx.conf'] : ag.perfil.hostname === 'SRV-BACKUP' ? ['jobs', 'logs', 'restic-repo', 'scripts'] : ['Documentos', 'Downloads', 'Imagens', 'projetos', 'scripts'];
  return longo ? `total ${nomes.length * 4 + 8}\ndrwxr-xr-x  6 ${ag.usuario_logado} ${ag.usuario_logado} 4096 out  7 08:12 .\ndrwxr-xr-x  4 root root 4096 ago 14 10:03 ..\n${nomes.map((n) => `${n.includes('.') ? '-rw-r--r--' : 'drwxr-xr-x'}  ${n.includes('.') ? 1 : 3} ${ag.usuario_logado} ${ag.usuario_logado} ${padE(n.includes('.') ? 1840 : 4096, 5)} out  ${padE(1 + Math.floor(hash32(n) * 8), 2)} 09:${String(10 + Math.floor(hash32(n, 1) * 49))} ${n}`).join('\n')}` : nomes.join('  ');
}

function saidaGetService(ag, filtroParado) {
  const linhas = SERVICOS_WIN.filter((s) => (filtroParado === null ? true : filtroParado ? s[0] === 'Stopped' : s[0] === 'Running')).map((s) => [s[0], s[1], s[2]]);
  return `\n${tabela(['Status', 'Name', 'DisplayName'], linhas)}\n`;
}

function ping(alvo) {
  const ip = /^\d+\.\d+\.\d+\.\d+$/.test(alvo) ? alvo : '142.250.219.14';
  const t = (i) => 11 + Math.floor(hash32(alvo, i) * 9);
  return [`Disparando ${alvo} [${ip}] com 32 bytes de dados:`, ...[0, 1, 2, 3].map((i) => `Resposta de ${ip}: bytes=32 tempo=${t(i)}ms TTL=117`), '',
    `Estatísticas do Ping para ${ip}:`, '    Pacotes: Enviados = 4, Recebidos = 4, Perdidos = 0 (0% de perda),', 'Aproximar um número redondo de vezes em milissegundos:', `    Mínimo = ${t(0)}ms, Máximo = ${t(1) + 3}ms, Média = ${t(2)}ms`].join('\n');
}

function erroDesconhecido(ag, shell, cmd) {
  const nome = cmd.split(/\s+/)[0];
  if (shell === 'cmd') return `'${nome}' não é reconhecido como um comando interno\nou externo, um programa operável ou um arquivo em lotes.`;
  if (shell === 'powershell') return `${nome} : O termo '${nome}' não é reconhecido como nome de cmdlet, função, arquivo de script ou programa operável. Verifique a grafia do nome ou, se um caminho tiver sido incluído, veja se o caminho está correto e tente novamente.\nNo linha:1 caractere:1\n+ ${nome}\n+ ~~~~\n    + CategoryInfo          : ObjectNotFound: (${nome}:String) [], CommandNotFoundException\n    + FullyQualifiedErrorId : CommandNotFoundException`;
  if (shell === 'python') return `Traceback (most recent call last):\n  File "<string>", line 1, in <module>\nNameError: name '${nome}' is not defined`;
  return `bash: line 1: ${nome}: command not found`;
}

const aspas = (s) => s.trim().replace(/^(["'])([\s\S]*)\1$/, '$2');

/** Interpreta uma linha. Retorna { out, err, codigo }. */
function interpretar(ag, shell, linha) {
  const win = ehWin(ag);
  const cru = linha.trim();
  const cmd = cru.replace(/^@/, '');
  const [primeiroBruto, ...resto] = cmd.split(/\s+/);
  const nome = primeiroBruto.toLowerCase();
  const args = resto.join(' ');
  const semPipe = cmd.split('|')[0].trim();
  const nomeSemPipe = semPipe.split(/\s+/)[0].toLowerCase();
  const argsSemPipe = semPipe.split(/\s+/).slice(1).join(' ');
  const ok = (out = '') => ({ out, err: '', codigo: 0 });

  if (shell === 'python') {
    const m = cmd.match(/^print\((.*)\)$/s);
    if (m) {
      const v = aspas(m[1].replace(/^f/, ''));
      return ok(v.replace(/\{platform\.node\(\)\}|\{socket\.gethostname\(\)\}/g, ag.hostname));
    }
    if (/^(import|from)\s|^#/.test(cmd)) return ok();
    if (/^[a-z_][\w.]*\(.*\)$/i.test(cmd) || /^[\w.]+\s*=/.test(cmd)) return ok();
    return { out: '', err: erroDesconhecido(ag, 'python', cmd), codigo: 1 };
  }

  if (/^(echo|write-output|write-host)\b/i.test(cmd) || cmd === 'echo.') {
    if (/^echo\s+(on|off)$/i.test(cmd)) return ok();
    if (/^echo\.?$/i.test(cmd)) return { out: '', err: '', codigo: 0, vazia: true };
    const t = cmd.replace(/^(echo|write-output|write-host)\.?\s*/i, '');
    return ok(aspas(t.replace(/^-\w+\s+\w+\s+/, '')).replace(/\$env:COMPUTERNAME|%COMPUTERNAME%|\$\(hostname\)|\$HOSTNAME/gi, ag.hostname).replace(/%USERNAME%|\$env:USERNAME|\$USER\b/gi, win ? 'SYSTEM' : 'root'));
  }
  if (['hostname', 'hostnamectl'].includes(nomeSemPipe) || /^\[environment\]::machinename$/i.test(cmd) || /^\$env:computername$/i.test(cmd)) {
    if (nomeSemPipe === 'hostname' && /^-[iI]/.test(argsSemPipe)) return ok(ag.ip_local);
    return ok(ag.hostname);
  }
  if (nomeSemPipe === 'whoami') return ok(win ? 'nt authority\\system' : 'root');
  if (nomeSemPipe === 'id') return ok('uid=0(root) gid=0(root) grupos=0(root)');
  if (nomeSemPipe === 'ipconfig') return ok(saidaIpconfig(ag, /\/all/i.test(argsSemPipe)));
  if (['ifconfig'].includes(nomeSemPipe)) return ok(saidaIpAddr(ag, false));
  if (nomeSemPipe === 'ip') {
    if (/^(-br\w*|-brief)\s+(a|addr|address)\b|^(a|addr|address)\s+-br/.test(argsSemPipe) || /-br/.test(argsSemPipe)) return ok(saidaIpAddr(ag, true));
    if (/^(a|addr|address)\b/.test(argsSemPipe)) return ok(saidaIpAddr(ag, false));
    if (/^(r|route)\b/.test(argsSemPipe)) return ok(saidaIpRoute(ag));
    if (/^(l|link)\b/.test(argsSemPipe)) return ok(saidaIpAddr(ag, true));
    return { out: '', err: `Object "${argsSemPipe.split(' ')[0]}" is unknown, try "ip help".`, codigo: 1 };
  }
  if (/^cat\s+\/etc\/resolv\.conf/.test(cmd)) return ok(RESOLV(ag));
  if (/^cat\s+\/etc\/os-release/.test(cmd)) return ok(`PRETTY_NAME="${ag.so_versao}"\nNAME="${ag.so_versao.split(' ')[0]}"\nID=${ag.so_versao.split(' ')[0].toLowerCase()}`);
  if (nomeSemPipe === 'echo') return ok();
  if (['dir', 'ls', 'get-childitem', 'gci', 'll'].includes(nomeSemPipe)) return ok(listagem(ag, null, /-\w*l/.test(argsSemPipe) || nomeSemPipe === 'll'));
  if (['pwd', 'get-location', 'cd'].includes(nomeSemPipe)) return ok(nomeSemPipe === 'cd' && argsSemPipe ? '' : win ? (nomeSemPipe === 'get-location' ? '\nPath\n----\nC:\\Windows\\system32\n' : 'C:\\Windows\\system32') : '/root');
  if (nomeSemPipe === 'get-service' || nomeSemPipe === 'sc' || nomeSemPipe === 'net') {
    if (nomeSemPipe === 'get-service' && /^[A-Za-z]/.test(argsSemPipe) && !argsSemPipe.startsWith('-')) {
      const n = argsSemPipe.split(/\s+/)[0].toLowerCase();
      const s = SERVICOS_WIN.find((x) => x[1].toLowerCase() === n);
      return s ? ok(`\n${tabela(['Status', 'Name', 'DisplayName'], [s])}\n`) : { out: '', err: `Get-Service : Não é possível localizar nenhum serviço com o nome '${argsSemPipe}'.`, codigo: 1 };
    }
    const filtroParado = /stopped|parado/i.test(cmd) ? true : /running|executando/i.test(cmd) ? false : null;
    return ok(saidaGetService(ag, filtroParado));
  }
  if (nomeSemPipe === 'systemctl') {
    if (/^is-active\s+(\S+)/.test(argsSemPipe)) return ok('active');
    if (/^status\s+(\S+)/.test(argsSemPipe)) {
      const sv = argsSemPipe.split(/\s+/)[1];
      return ok(`● ${sv}.service - ${sv}\n     Loaded: loaded (/lib/systemd/system/${sv}.service; enabled; preset: enabled)\n     Active: active (running) since Mon 2024-10-07 07:41:55 -03; 2 days ago\n   Main PID: 1422 (${sv})\n      Tasks: 5 (limit: 18902)\n     Memory: 48.2M`);
    }
    return ok('  UNIT                     LOAD   ACTIVE SUB     DESCRIPTION\n  cron.service             loaded active running Regular background program processing daemon\n  farol-agente.service     loaded active running Farol RMM Agent\n  ssh.service              loaded active running OpenBSD Secure Shell server\n  systemd-journald.service loaded active running Journal Service\n\n4 loaded units listed.');
  }
  if (['get-process', 'tasklist', 'ps', 'top'].includes(nomeSemPipe)) {
    const base = win ? PROCESSOS_WIN : PROCESSOS_LINUX;
    if (nomeSemPipe === 'get-process') {
      return ok(`\n${tabela(['Handles', 'NPM(K)', 'PM(K)', 'WS(K)', 'CPU(s)', 'Id', 'ProcessName'], base.slice(0, 8).map(([n, pid, c, m]) => [Math.round(200 + hash32(n) * 900), Math.round(10 + hash32(n, 1) * 40), Math.round(m * 30000), Math.round(m * 42000), ptNum(c * 120), pid, n]))}\n`);
    }
    if (nomeSemPipe === 'tasklist') return ok(tabela(['Nome da imagem', 'PID', 'Nome da sessão', 'Uso de memória'], base.slice(0, 8).map(([n, pid, , m]) => [`${n}.exe`, pid, pid < 5000 ? 'Services' : 'Console', `${Math.round(m * 52000).toLocaleString('pt-BR')} K`])));
    return ok(['USER         PID %CPU %MEM COMMAND', ...base.slice(0, 8).map(([n, pid, c, m]) => `${pad('root', 10)} ${padE(pid, 5)} ${padE(c.toFixed(1), 4)} ${padE(m.toFixed(1), 4)} ${n}`)].join('\n'));
  }
  if (nomeSemPipe === 'uptime') {
    const u = uptimeTexto(ag);
    return ok(win ? `Tempo de atividade: ${u.d} dias, ${u.h} horas, ${u.m} minutos` : ` ${dataAgora().hora} up ${u.d} days, ${u.h}:${String(u.m).padStart(2, '0')},  1 user,  load average: 0.31, 0.27, 0.22`);
  }
  if (['get-date', 'date'].includes(nomeSemPipe)) return ok(win ? `\n${dataAgora().longa}\n` : dataAgora().longa.replace(/^[^,]+, /, '').replace(/ de /g, ' '));
  if (nomeSemPipe === 'time' || nomeSemPipe === 'ver') return ok(win ? '\nMicrosoft Windows [versão 10.0.22631.4169]' : '');
  if (nomeSemPipe === 'uname') return ok(/-r/.test(argsSemPipe) ? '6.8.0-45-generic' : /-a/.test(argsSemPipe) ? `Linux ${ag.hostname} 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux` : 'Linux');
  if (nomeSemPipe === 'df') return ok(saidaDfLinux(ag));
  if (nomeSemPipe === 'free') return ok(saidaFree(ag));
  if (nomeSemPipe === 'get-volume' || nomeSemPipe === 'get-psdrive' || nomeSemPipe === 'wmic') return ok(saidaDiscosWin(ag));
  if (nomeSemPipe === 'ping') return ok(ping(argsSemPipe.replace(/-\w+\s*\d*\s*/g, '').trim() || 'localhost'));
  if (['start-sleep', 'sleep', 'timeout', 'clear', 'cls', 'set-location', 'set', 'export', 'true', 'set-executionpolicy'].includes(nomeSemPipe)) return ok();
  if (nomeSemPipe === 'exit') return { out: '', err: '', codigo: Number(argsSemPipe) || 0, fim: true };
  if (nomeSemPipe === 'get-computerinfo') return ok(`\nCsName         : ${ag.hostname}\nOsName         : ${ag.so_versao}\nCsManufacturer : ${ag.inventario.hardware.fabricante}\nCsModel        : ${ag.inventario.hardware.modelo}\n`);
  if (nomeSemPipe === 'lsblk') return ok('NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS\nsda      8:0    0   100G  0 disk\n├─sda1   8:1    0   512M  0 part /boot/efi\n└─sda2   8:2    0  99.5G  0 part /');
  return { out: '', err: erroDesconhecido(ag, shell, cmd), codigo: 1 };
}

/**
 * Simula a execução. Retorna { stdout, stderr, codigo, duracao_ms }.
 * `nome` é o nome do script (usado só para escolher saídas das sementes).
 */
export function simularExecucao(ag, shell, conteudo) {
  const win = ehWin(ag);
  const dur = (base) => Math.round(base + hash32(ag.hostname, conteudo.length, Date.now() % 997) * base * 0.8);
  if ((shell === 'powershell' || shell === 'cmd') && !win) {
    return { stdout: '', stderr: `[agente] Interpretador "${shell === 'cmd' ? 'cmd.exe' : 'powershell'}" não encontrado neste sistema.`, codigo: 1, duracao_ms: dur(35) };
  }
  if (shell === 'bash' && win) {
    return { stdout: '', stderr: '[agente] Interpretador "bash" não encontrado neste sistema.', codigo: 1, duracao_ms: dur(35) };
  }
  const texto = conteudo;
  // Scripts completos das sementes (e variações) reconhecidos pelo conteúdo.
  if (shell === 'powershell') {
    if (/Win32_Service/i.test(texto)) {
      const n = 2 + Math.floor(hash32(ag.hostname, 'svc') * 3);
      const dados = SERVICOS_PARADOS.map((s) => ({ s, k: hash32(ag.hostname, s[0]) })).sort((a, b) => a.k - b.k).slice(0, n).map((x) => [x.s[0], x.s[1], 'Stopped']).sort((a, b) => a[0].localeCompare(b[0]));
      return { stdout: `\n${tabela(['Name', 'DisplayName', 'State'], dados)}\n`, stderr: '', codigo: 0, duracao_ms: dur(950) };
    }
    if (/Uninstall/i.test(texto) && /DisplayName/.test(texto)) {
      const sw = ag.inventario.softwares.map((x) => [x.nome, x.versao]);
      return { stdout: `
${tabela(['DisplayName', 'DisplayVersion'], sw)}
`, stderr: '', codigo: 0, duracao_ms: dur(1800) };
    }
    if (/Win32_LogicalDisk/i.test(texto)) return { stdout: saidaDiscosWin(ag), stderr: '', codigo: 0, duracao_ms: dur(620) };
    if (/PSIsContainer|AddDays\(-7\)/.test(texto)) {
      const mb = 180 + hash32(ag.hostname, 'tmp') * 1400;
      return { stdout: `Liberados: ${ptNum(mb)} MB`, stderr: '', codigo: 0, duracao_ms: dur(5200) };
    }
    if (/Stop-Service[\s\S]*Spooler/i.test(texto)) {
      return { stdout: '\n\nName    : Spooler\nStatus  : Running\n\n', stderr: '', codigo: 0, duracao_ms: dur(3400) };
    }
  }
  if (shell === 'python' && /psutil/.test(texto)) {
    return { stdout: saidaProcessosPsutil(ag), stderr: '', codigo: 0, duracao_ms: dur(1250) };
  }
  // Linha a linha (&& e ; também separam comandos)
  const linhas = texto.split(/\r?\n/).flatMap((l) => l.split(/\s*(?:&&|;)\s*/)).map((l) => l.trim()).filter((l) => l && !/^(#|rem\b)/i.test(l));
  const saidas = [];
  const erros = [];
  let codigo = 0;
  for (const l of linhas) {
    const r = interpretar(ag, shell, l.replace(/\s+2>\/dev\/null.*$/, ''));
    if (r.out !== '' || r.vazia) saidas.push(r.out);
    if (r.err) erros.push(r.err);
    if (r.codigo) codigo = r.codigo;
    if (r.codigo || r.fim) break;
  }
  return { stdout: saidas.join('\n'), stderr: erros.join('\n'), codigo, duracao_ms: dur(120 + linhas.length * 60) };
}
