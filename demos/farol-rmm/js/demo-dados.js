// Dados fictícios da demo: agentes, inventário e o modelo determinístico das métricas.
// Módulo puro (sem DOM), usado pelo servidor simulado e pelos testes em Node.

export const MIN = 60_000;
export const HORA = 3_600_000;
export const DIA = 86_400_000;
const GB = 1024 ** 3;

// ---------- Números pseudoaleatórios determinísticos ----------
export function hash32(...partes) {
  let h = 2166136261;
  for (const p of partes) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= 0x9e3779b9; h = Math.imul(h, 2246822519);
  }
  h ^= h >>> 15; h = Math.imul(h, 2654435761); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function ruidoSuave(x, semente) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash32(semente, i) * (1 - u) + hash32(semente, i + 1) * u;
}

const limitar = (v, a = 0, b = 100) => Math.min(b, Math.max(a, v));
const degrau = (x, a, b) => { const t = limitar((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- Perfis dos agentes ----------
// tipo: servidor | estacao | pdv. cpu/ram: [base, amplitude do horário comercial] em %.
const PERFIS = [
  {
    hostname: 'SRV-ARQUIVOS', so: 'Windows', so_versao: 'Windows Server 2022 Standard 21H2 (10.0.20348)', arq: 'AMD64', ip: '192.168.10.5',
    usuario: 'Administrador', tipo: 'servidor', cpu: [7, 16], ram: [58, 6], ramGB: 32, uptimeDias: 41,
    discos: [['C:\\', 'NTFS', 120, 48.3], ['D:\\', 'NTFS', 2000, 71.6]],
    hw: { fabricante: 'Dell Inc.', modelo: 'PowerEdge T350', serial: '7K3M9Q3', cpu_modelo: 'Intel(R) Xeon(R) E-2334 CPU @ 3.40GHz', fisicos: 4, logicos: 8 },
    nics: [['Ethernet 1', true, 1000], ['Ethernet 2', false, 0]], extras: 'arquivos',
  },
  {
    hostname: 'SRV-WEB-01', so: 'Linux', so_versao: 'Ubuntu 24.04.1 LTS', arq: 'x86_64', ip: '192.168.10.12',
    usuario: 'deploy', tipo: 'servidor', cpu: [11, 24], ram: [46, 5], ramGB: 16, uptimeDias: 63,
    discos: [['/', 'ext4', 80, 54.2], ['/var', 'ext4', 200, 63.8]],
    hw: { fabricante: 'QEMU', modelo: 'Standard PC (Q35 + ICH9, 2009)', serial: 'vm-web-01', cpu_modelo: 'AMD EPYC 7302 16-Core Processor', fisicos: 4, logicos: 4 },
    nics: [['ens18', true, 10000], ['docker0', true, 10000]], extras: 'web', picos: [[10.5, 13], [15, 16.5]],
  },
  {
    hostname: 'NB-FINANCEIRO-03', so: 'Windows', so_versao: 'Windows 11 Pro 23H2 (10.0.22631)', arq: 'AMD64', ip: '192.168.20.34',
    usuario: 'marina.souza', tipo: 'estacao', cpu: [9, 34], ram: [87, 5], ramGB: 16, uptimeDias: 6,
    discos: [['C:\\', 'NTFS', 512, 78.4]],
    hw: { fabricante: 'LENOVO', modelo: 'ThinkPad E14 Gen 5 (21JK)', serial: 'PF4K2MQ7', cpu_modelo: '13th Gen Intel(R) Core(TM) i5-1335U', fisicos: 10, logicos: 12 },
    nics: [['Wi-Fi', true, 866], ['Ethernet', false, 0]], extras: 'financeiro', vendor: 'lenovo',
  },
  {
    hostname: 'DESKTOP-RECEPCAO', so: 'Windows', so_versao: 'Windows 10 Pro 22H2 (10.0.19045)', arq: 'AMD64', ip: '192.168.20.11',
    usuario: 'recepcao', tipo: 'estacao', cpu: [6, 22], ram: [52, 14], ramGB: 8, uptimeDias: 12,
    discos: [['C:\\', 'NTFS', 256, 61.2]],
    hw: { fabricante: 'HP', modelo: 'ProDesk 400 G7 SFF', serial: 'MXL1042K9R', cpu_modelo: 'Intel(R) Core(TM) i3-10100 CPU @ 3.60GHz', fisicos: 4, logicos: 8 },
    nics: [['Ethernet', true, 1000]], extras: 'basico', vendor: 'hp',
  },
  {
    hostname: 'NB-DIRETORIA', so: 'Windows', so_versao: 'Windows 11 Pro 23H2 (10.0.22631)', arq: 'AMD64', ip: '192.168.20.2',
    usuario: 'carlos.menezes', tipo: 'estacao', cpu: [5, 26], ram: [41, 12], ramGB: 32, uptimeDias: 3,
    discos: [['C:\\', 'NTFS', 1000, 44.7]],
    hw: { fabricante: 'Dell Inc.', modelo: 'Latitude 7440', serial: '9H2R7N3', cpu_modelo: '13th Gen Intel(R) Core(TM) i7-1365U', fisicos: 10, logicos: 12 },
    nics: [['Wi-Fi', true, 1200], ['Ethernet', false, 0]], extras: 'diretoria', vendor: 'dell',
  },
  {
    hostname: 'SRV-BACKUP', so: 'Linux', so_versao: 'Debian GNU/Linux 12 (bookworm)', arq: 'x86_64', ip: '192.168.10.20',
    usuario: 'backup', tipo: 'servidor', cpu: [4, 6], ram: [38, 3], ramGB: 16, uptimeDias: 118,
    discos: [['/', 'ext4', 50, 38.1], ['/mnt/backup', 'xfs', 8000, 93.4]],
    hw: { fabricante: 'Supermicro', modelo: 'X11SCL-F', serial: 'S2A41B8X0912', cpu_modelo: 'Intel(R) Xeon(R) E-2236 CPU @ 3.40GHz', fisicos: 6, logicos: 12 },
    nics: [['eno1', true, 1000], ['eno2', false, 0]], extras: 'backup', noite: [1.5, 4.5],
  },
  {
    hostname: 'PDV-LOJA-02', so: 'Windows', so_versao: 'Windows 10 Pro 22H2 (10.0.19045)', arq: 'AMD64', ip: '192.168.30.22',
    usuario: 'caixa02', tipo: 'pdv', cpu: [10, 24], ram: [64, 10], ramGB: 4, uptimeDias: 2,
    discos: [['C:\\', 'NTFS', 120, 82.6]],
    hw: { fabricante: 'Positivo Tecnologia S.A.', modelo: 'Master D3400', serial: 'PS20230417A', cpu_modelo: 'Intel(R) Celeron(R) G5905 CPU @ 3.50GHz', fisicos: 2, logicos: 2 },
    nics: [['Ethernet', true, 100]], extras: 'pdv', offlineHa: 3 * HORA + 12 * MIN,
  },
  {
    hostname: 'NB-SUPORTE-01', so: 'Linux', so_versao: 'Ubuntu 22.04.5 LTS', arq: 'x86_64', ip: '192.168.20.41',
    usuario: 'rafael.lima', tipo: 'estacao', cpu: [8, 30], ram: [49, 10], ramGB: 16, uptimeDias: 9,
    discos: [['/', 'ext4', 476, 52.9], ['/boot/efi', 'vfat', 1, 6.1]],
    hw: { fabricante: 'LENOVO', modelo: 'ThinkPad T14 Gen 3 AMD (21CF)', serial: 'PF3VX2T9', cpu_modelo: 'AMD Ryzen 5 PRO 6650U with Radeon Graphics', fisicos: 6, logicos: 12 },
    nics: [['wlp2s0', true, 866], ['enp3s0f0', false, 0]], extras: 'suporte',
  },
  {
    hostname: 'DESKTOP-RH-02', so: 'Windows', so_versao: 'Windows 11 Pro 22H2 (10.0.22621)', arq: 'AMD64', ip: '192.168.20.18',
    usuario: 'juliana.alves', tipo: 'estacao', cpu: [6, 25], ram: [55, 10], ramGB: 16, uptimeDias: 5,
    discos: [['C:\\', 'NTFS', 476, 57.9]],
    hw: { fabricante: 'HP', modelo: 'EliteDesk 800 G6 SFF', serial: 'MXL1130LT2', cpu_modelo: 'Intel(R) Core(TM) i5-10500 CPU @ 3.10GHz', fisicos: 6, logicos: 12 },
    nics: [['Ethernet', true, 1000]], extras: 'rh', vendor: 'hp', offlineHa: 27 * MIN,
  },
];

// ---------- Softwares ----------
const MS = 'Microsoft Corporation';
// [nome, versão, fabricante, núcleo (sempre) | opcional, só estações]
const WIN_BASE = [
  ['Microsoft Edge', '129.0.2792.65', MS, 1], ['Microsoft Edge WebView2 Runtime', '129.0.2792.65', MS, 1],
  ['Microsoft Edge Update', '1.3.195.43', MS, 1],
  ['Microsoft Visual C++ 2015-2022 Redistributable (x64) - 14.40.33810', '14.40.33810.0', MS, 1],
  ['Microsoft Visual C++ 2015-2022 Redistributable (x86) - 14.40.33810', '14.40.33810.0', MS, 1],
  ['Microsoft Visual C++ 2013 Redistributable (x64) - 12.0.40664', '12.0.40664.0', MS, 1],
  ['Microsoft Visual C++ 2012 Redistributable (x86) - 11.0.61030', '11.0.61030.0', MS, 0],
  ['Microsoft .NET Runtime - 6.0.33 (x64)', '48.132.33621', MS, 1], ['Microsoft Windows Desktop Runtime - 8.0.8 (x64)', '64.96.33729', MS, 1],
  ['PowerShell 7-x64', '7.4.5.0', MS, 1], ['Farol Agente', '1.0.3', 'Farol RMM', 1],
  ['Python 3.12.6 (64-bit)', '3.12.6150.0', 'Python Software Foundation', 1], ['Python Launcher', '3.12.6150.0', 'Python Software Foundation', 1],
  ['Bitdefender Endpoint Security Tools', '7.9.11.384', 'Bitdefender', 1], ['7-Zip 24.08 (x64)', '24.08', 'Igor Pavlov', 1],
  ['Microsoft Update Health Tools', '5.72.0.0', MS, 0], ['Intel(R) Management Engine Components', '2406.8.4.0', 'Intel Corporation', 0],
  ['Adobe Acrobat Reader (64-bit)', '24.003.20112', 'Adobe', 1, 1], ['Google Chrome', '129.0.6668.90', 'Google LLC', 1, 1],
  ['Mozilla Firefox (x64 pt-BR)', '131.0', 'Mozilla', 0, 1], ['Microsoft OneDrive', '24.186.0915.0002', MS, 1, 1],
  ['Microsoft 365 Apps for enterprise - pt-br', '16.0.18025.20160', MS, 1, 1], ['Microsoft Teams', '24243.1309.3142.4137', MS, 1, 1],
  ['Teams Machine-Wide Installer', '1.7.0.13456', MS, 0, 1], ['Zoom Workplace (64-bit)', '6.2.0 (40538)', 'Zoom Video Communications, Inc.', 0, 1],
  ['VLC media player', '3.0.21', 'VideoLAN', 0, 1], ['Notepad++ (64-bit x64)', '8.7.1', 'Notepad++ Team', 0, 1],
  ['WinRAR 7.01 (64-bit)', '7.01.0', 'win.rar GmbH', 0, 1], ['AnyDesk', '8.0.14', 'philandro Software GmbH', 0, 1],
  ['Java 8 Update 421 (64-bit)', '8.0.4210.9', 'Oracle Corporation', 0, 1], ['Cisco Secure Client - AnyConnect VPN', '5.1.4.74', 'Cisco Systems, Inc.', 0, 1],
  ['LibreOffice 24.8.1.2', '24.8.1.2', 'The Document Foundation', 0, 1], ['Realtek High Definition Audio Driver', '6.0.9549.1', 'Realtek Semiconductor Corp.', 0, 1],
  ['Intel(R) Chipset Device Software', '10.1.19444.8378', 'Intel Corporation', 0, 1], ['Intel(R) Wireless Bluetooth(R)', '23.60.0.2', 'Intel Corporation', 0, 1],
  ['Git', '2.46.2', 'The Git Development Community', 0, 1], ['Microsoft Visual Studio Code', '1.93.1', MS, 0, 1],
];
const WIN_EXTRAS = {
  arquivos: [['Veeam Agent for Microsoft Windows', '6.2.0.169', 'Veeam Software Group GmbH'], ['Microsoft ASP.NET Core 8.0.8 - Shared Framework', '8.0.8.24415', MS],
    ['Dell OpenManage Systems Management Software (64-Bit)', '11.0.1.0', 'Dell Inc.'], ['Dell iDRAC Service Module', '5.3.0.0', 'Dell Inc.'], ['WinSCP 6.3.5', '6.3.5', 'Martin Prikryl'], ['Microsoft Visual C++ 2010 x64 Redistributable - 10.0.40219', '10.0.40219', MS],
    ['Microsoft ODBC Driver 17 for SQL Server', '17.10.6.1', MS], ['Microsoft OLE DB Driver for SQL Server', '18.6.7.0', MS], ['Windows Admin Center', '2311.2', MS],
    ['Dell EMC OpenManage Server Administrator', '11.0.1.0', 'Dell Inc.'], ['Microsoft Azure Connected Machine Agent', '1.45.02831.2112', MS], ['Notepad++ (64-bit x64)', '8.7.1', 'Notepad++ Team'],
    ['Microsoft Windows Admin Tools - RSAT', '10.0.20348.1', MS], ['Intel(R) Network Connections', '28.3.0.0', 'Intel Corporation']],
  financeiro: [['TOTVS Smart Client', '24.3.1.2', 'TOTVS S.A.'], ['Conectividade Social ICP v2', '2.4.0', 'Caixa Econômica Federal'], ['Sicoob Token Driver', '3.1.4', 'Sicoob'],
    ['Warsaw (Proteção Bancária)', '2.18.0.78', 'GAS Tecnologia'], ['SafeSign Standard 3.7.0.0', '3.7.0.0', 'A.E.T. Europe B.V.'], ['Lenovo Vantage', '10.2409.12.0', 'Lenovo Group Ltd.'], ['Lenovo System Update', '5.08.02.25', 'Lenovo']],
  basico: [['HP Support Assistant', '9.44.30.0', 'HP Inc.'], ['HP Wolf Security', '4.3.1.1253', 'HP Inc.'], ['Foxit PDF Reader', '2024.3.0.26795', 'Foxit Software Inc.']],
  diretoria: [['Dell Command | Update', '5.4.0', 'Dell Inc.'], ['Dell Optimizer', '4.1.1.0', 'Dell Inc.'], ['Slack', '4.40.128', 'Slack Technologies Inc.'], ['Microsoft Power BI Desktop (x64)', '2.133.1054.0', MS], ['Dropbox', '211.4.5183', 'Dropbox, Inc.']],
  pdv: [['SAT Fiscal - Driver Tanca', '2.1.3', 'Tanca'], ['Bematech MP-4200 TH Driver', '5.2.0.1', 'Bematech'], ['PDV Frente de Loja', '8.14.2', 'Linx Sistemas'], ['Elgin Spooler Térmico', '1.9.4', 'Elgin S.A.']],
  rh: [['Sênior Sistemas HCM', '6.8.2', 'Senior Sistemas S.A.'], ['Ponto Secullum 4', '4.0.1.172', 'Secullum Software'], ['HP Support Assistant', '9.44.30.0', 'HP Inc.'], ['Foxit PDF Reader', '2024.3.0.26795', 'Foxit Software Inc.']],
};

const UBU = (n, v) => [n, v, 'Ubuntu'];
const DEB = (n, v) => [n, v, 'Debian'];
const LINUX_UBUNTU24 = [
  ['base-files', '13ubuntu10.1'], ['bash', '5.2.21-2ubuntu4'], ['coreutils', '9.4-3ubuntu6'], ['curl', '8.5.0-2ubuntu10.4'], ['git', '1:2.43.0-1ubuntu7.1'],
  ['openssh-server', '1:9.6p1-3ubuntu13.5'], ['openssl', '3.0.13-0ubuntu3.4'], ['python3', '3.12.3-0ubuntu2'], ['python3-psutil', '5.9.8-2build2'],
  ['systemd', '255.4-1ubuntu8.4'], ['ufw', '0.36.2-6'], ['vim', '2:9.1.0016-1ubuntu7.3'], ['htop', '3.3.0-4build1'], ['rsync', '3.2.7-1ubuntu1.1'],
  ['tmux', '3.4-1build1'], ['wget', '1.21.4-1ubuntu4.1'], ['sudo', '1.9.15p5-3ubuntu5'], ['ca-certificates', '20240203'], ['cron', '3.0pl1-184ubuntu2'],
  ['logrotate', '3.21.0-2build1'], ['net-tools', '2.10-0.1ubuntu4'], ['iproute2', '6.1.0-1ubuntu6'], ['unattended-upgrades', '2.9.1+nmu4ubuntu1'], ['gnupg', '2.4.4-2ubuntu17'],
  ['nano', '7.2-2build1'], ['jq', '1.7.1-3build1'], ['lsof', '4.95.0-1build3'], ['libc6', '2.39-0ubuntu8.3'], ['apt', '2.7.14build2'], ['tzdata', '2024a-3ubuntu1.1'],
];
const LINUX_DEBIAN12 = [
  ['base-files', '12.4+deb12u6'], ['bash', '5.2.15-2+b7'], ['coreutils', '9.1-1'], ['curl', '7.88.1-10+deb12u7'], ['git', '1:2.39.5-0+deb12u1'],
  ['openssh-server', '1:9.2p1-2+deb12u3'], ['openssl', '3.0.15-1~deb12u1'], ['python3', '3.11.2-1+b1'], ['python3-psutil', '5.9.4-1+b1'],
  ['systemd', '252.30-1~deb12u2'], ['vim', '2:9.0.1378-2'], ['htop', '3.2.2-2'], ['rsync', '3.2.7-1'], ['tmux', '3.3a-3'], ['wget', '1.21.3-1+b2'],
  ['sudo', '1.9.13p3-1+deb12u1'], ['ca-certificates', '20230311'], ['cron', '3.0pl1-162'], ['logrotate', '3.21.0-1'], ['iproute2', '6.1.0-3'],
  ['unattended-upgrades', '2.9.1+nmu3'], ['gnupg', '2.2.40-1.1'], ['nano', '7.2-1'], ['lsof', '4.95.0-1'], ['libc6', '2.36-9+deb12u8'], ['apt', '2.6.1'], ['tzdata', '2024b-0+deb12u1'],
];
const LINUX_UBUNTU22 = [
  ['base-files', '12ubuntu4.7'], ['bash', '5.1-6ubuntu1.1'], ['coreutils', '8.32-4.1ubuntu1.2'], ['curl', '7.81.0-1ubuntu1.18'], ['git', '1:2.34.1-1ubuntu1.11'],
  ['openssh-client', '1:8.9p1-3ubuntu0.10'], ['openssl', '3.0.2-0ubuntu1.18'], ['python3', '3.10.12-1~22.04.5'], ['python3-psutil', '5.9.0-1build1'],
  ['systemd', '249.11-0ubuntu3.12'], ['vim', '2:8.2.3995-1ubuntu2.20'], ['htop', '3.0.5-7build2'], ['tmux', '3.2a-4ubuntu0.2'], ['wget', '1.21.2-2ubuntu1.1'],
  ['network-manager', '1.36.6-0ubuntu2'], ['gnome-shell', '42.9-0ubuntu2.3'], ['libreoffice-core', '1:7.3.7-0ubuntu0.22.04.7'], ['firefox', '131.0+build1-0ubuntu0.22.04.1'],
  ['wireshark', '3.6.2-2'], ['nmap', '7.80+dfsg1-2build1'], ['remmina', '1.4.25+dfsg-1ubuntu1'], ['vlc', '3.0.16-1build7'], ['cups', '2.4.1op1-1ubuntu4.11'],
  ['ansible', '2.10.8+merged+base+2.10.8+dfsg-1'], ['nodejs', '18.19.1-1nodesource1'], ['code', '1.93.1-1726079302'], ['slack-desktop', '4.40.128'],
  ['libc6', '2.35-0ubuntu3.8'], ['apt', '2.4.13'], ['sudo', '1.9.9-1ubuntu2.4'],
];
const LINUX_EXTRAS = {
  web: [['nginx', '1.24.0-2ubuntu7.1'], ['docker-ce', '5:27.3.1-1~ubuntu.24.04~noble'], ['docker-compose-plugin', '2.29.7-1~ubuntu.24.04~noble'], ['containerd.io', '1.7.22-1'],
    ['postgresql-16', '16.4-0ubuntu0.24.04.2'], ['certbot', '2.9.0-1'], ['nodejs', '20.17.0-1nodesource1'], ['fail2ban', '1.0.2-3ubuntu0.1'], ['redis-server', '5:7.0.15-1build2'],
    ['prometheus-node-exporter', '1.7.0-1build1'], ['logwatch', '7.10+git20240206-1']],
  backup: [['borgbackup', '1.2.4-1'], ['restic', '0.14.0-3+b4'], ['rclone', '1.60.1+dfsg-2+b4'], ['smartmontools', '7.3-1+b1'], ['mdadm', '4.2-5'], ['xfsprogs', '6.1.0-1'],
    ['lvm2', '2.03.16-2'], ['nfs-kernel-server', '1:2.6.2-4'], ['msmtp', '1.8.23-1'], ['prometheus-node-exporter', '1.5.0-1+b5']],
  suporte: [],
};

function montarSoftwaresWindows(p, semente) {
  const servidor = p.tipo === 'servidor';
  const itens = [];
  WIN_BASE.forEach(([nome, versao, fab, nucleo, soEstacao], i) => {
    if (servidor && soEstacao) return;
    if (!nucleo && hash32(semente, 'sw', i) > 0.62) return;
    itens.push({ nome, versao, fabricante: fab });
  });
  for (const [nome, versao, fab] of WIN_EXTRAS[p.extras] ?? []) itens.push({ nome, versao, fabricante: fab });
  if (p.vendor === 'dell') itens.push({ nome: 'Dell SupportAssist', versao: '4.5.1.17', fabricante: 'Dell Inc.' });
  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  return itens;
}

function montarSoftwaresLinux(p, semente) {
  const base = /Debian/.test(p.so_versao) ? LINUX_DEBIAN12 : /24\.04/.test(p.so_versao) ? LINUX_UBUNTU24 : LINUX_UBUNTU22;
  const fab = /Debian/.test(p.so_versao) ? 'Debian' : 'Ubuntu';
  const mapa = new Map();
  base.forEach(([n, v], i) => { if (i < 20 || hash32(semente, 'sw', i) < 0.8) mapa.set(n, v); });
  for (const [n, v] of LINUX_EXTRAS[p.extras] ?? []) mapa.set(n, v);
  return [...mapa].map(([nome, versao]) => ({ nome, versao, fabricante: fab })).sort((a, b) => a.nome.localeCompare(b.nome));
}

// ---------- Rede ----------
function mac(semente, i) {
  const b = [0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e].map((x, k) => (k < 3 ? x : Math.floor(hash32(semente, 'mac', i, k) * 256)));
  return b.map((x) => x.toString(16).padStart(2, '0')).join(':').toUpperCase();
}

function montarRede(p, semente) {
  const win = p.so === 'Windows';
  const rede = p.nics.map(([nome, ativa, vel], i) => ({
    nome: win && nome === 'Ethernet' ? 'Ethernet' : nome,
    ativa,
    mac: mac(semente, i),
    ipv4: ativa ? (i === 0 ? [p.ip] : ['172.17.0.1']) : [],
    ipv6: ativa ? [`fe80::${Math.floor(hash32(semente, 'v6', i, 1) * 65535).toString(16)}:${Math.floor(hash32(semente, 'v6', i, 2) * 65535).toString(16)}:${Math.floor(hash32(semente, 'v6', i, 3) * 65535).toString(16)}:${Math.floor(hash32(semente, 'v6', i, 4) * 65535).toString(16)}`] : [],
    velocidade_mbps: vel || null,
  }));
  rede.push({ nome: win ? 'Loopback Pseudo-Interface 1' : 'lo', ativa: true, mac: null, ipv4: ['127.0.0.1'], ipv6: ['::1'], velocidade_mbps: null });
  if (win) rede.push({ nome: 'Conexão de Rede Bluetooth', ativa: false, mac: mac(semente, 9), ipv4: [], ipv6: [], velocidade_mbps: 3 });
  return rede;
}

// ---------- Construção dos agentes ----------
function uuid(semente) {
  const hex = (n) => Array.from({ length: n }, (_, i) => Math.floor(hash32(semente, 'uuid', n, i) * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

/** Cria a lista de agentes fictícios em relação ao instante `agora`. */
export function criarAgentes(agora) {
  return PERFIS.map((p, idx) => {
    const id = uuid(p.hostname);
    const offline = p.offlineHa != null;
    const ramTotal = p.ramGB * GB;
    const discos = p.discos.map(([ponto, fs, gb, pct]) => ({ ponto, fs, total: Math.round(gb * GB), usado: Math.round(gb * GB * pct / 100), pct }));
    const boot = Math.floor((agora - p.uptimeDias * DIA - hash32(p.hostname, 'boot') * 6 * HORA) / 1000);
    const win = p.so === 'Windows';
    const inventario = {
      sistema: { versao: p.so_versao, hostname: p.hostname, arquitetura: p.arq, boot, python: win ? '3.12.6' : (/Debian/.test(p.so_versao) ? '3.11.2' : /24\.04/.test(p.so_versao) ? '3.12.3' : '3.10.12') },
      hardware: {
        fabricante: p.hw.fabricante, modelo: p.hw.modelo, serial: p.hw.serial, cpu_modelo: p.hw.cpu_modelo,
        nucleos_fisicos: p.hw.fisicos, nucleos_logicos: p.hw.logicos, ram_total: ramTotal,
      },
      rede: montarRede(p, p.hostname),
      discos,
      softwares: win ? montarSoftwaresWindows(p, p.hostname) : montarSoftwaresLinux(p, p.hostname),
    };
    const ag = {
      id, hostname: p.hostname, so: p.so, so_versao: p.so_versao, arquitetura: p.arq, versao_agente: '1.0.3',
      ip_local: p.ip, usuario_logado: p.usuario, cpu_pct: null, ram_usada: null, ram_total: ramTotal, disco_max_pct: Math.max(...discos.map((d) => d.pct)),
      uptime: p.uptimeDias * DIA / 1000, status: offline ? 'offline' : 'online', ultimo_checkin: offline ? agora - p.offlineHa : agora,
      registrado_em: agora - (45 + idx * 7) * DIA, discos, inventario, inventario_em: agora - (offline ? p.offlineHa + 20 * MIN : 25 * MIN),
      revogado: 0, perfil: p, offlineDesde: offline ? agora - p.offlineHa : null,
    };
    if (!offline) Object.assign(ag, leituraAtual(ag, agora));
    else {
      const ult = leituraAtual(ag, ag.ultimo_checkin);
      Object.assign(ag, { cpu_pct: ult.cpu_pct, ram_usada: ult.ram_usada });
    }
    return ag;
  });
}

// ---------- Modelo das métricas ----------
function curvaComercial(ts) {
  const d = new Date(ts);
  const h = d.getHours() + d.getMinutes() / 60;
  const fds = d.getDay() === 0 || d.getDay() === 6;
  let c = degrau(h, 7.5, 9.5) - degrau(h, 17.5, 19.5);
  c *= 1 - 0.3 * Math.exp(-(((h - 12.7) / 0.6) ** 2));
  return fds ? c * 0.15 : c;
}

/** CPU % (modelo contínuo, sem jitter) de um agente em `ts`. */
export function cpuModelo(ag, ts) {
  const p = ag.perfil;
  const c = curvaComercial(ts);
  let v = p.cpu[0] + p.cpu[1] * c + (ruidoSuave(ts / (9 * MIN), p.hostname + 'c') - 0.5) * (p.tipo === 'servidor' ? 8 : 14);
  v += (ruidoSuave(ts / (70_000), p.hostname + 'f') - 0.5) * 6;
  const h = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
  for (const [a, b] of p.picos ?? []) if (h >= a && h < b) v += 26 * degrau(h, a, a + 0.3) * (1 - degrau(h, b - 0.4, b)) * (0.5 + ruidoSuave(ts / (4 * MIN), p.hostname + 'p'));
  if (p.noite && h >= p.noite[0] && h < p.noite[1]) v += 46 * degrau(h, p.noite[0], p.noite[0] + 0.25) * (1 - degrau(h, p.noite[1] - 0.4, p.noite[1])) * (0.7 + 0.5 * ruidoSuave(ts / (6 * MIN), 'bk'));
  return limitar(v, 0.5, 99);
}

export function ramModelo(ag, ts) {
  const p = ag.perfil;
  const v = p.ram[0] + p.ram[1] * curvaComercial(ts) + (ruidoSuave(ts / (35 * MIN), p.hostname + 'r') - 0.5) * 4 + (ruidoSuave(ts / 90_000, p.hostname + 'rf') - 0.5) * 0.8;
  return limitar(v, 5, 99);
}

/** Leitura "ao vivo" (com jitter por janela de 3 s), no formato das colunas do agente. */
export function leituraAtual(ag, ts) {
  const jitter = (hash32(ag.hostname, 'j', Math.floor(ts / 3000)) - 0.5) * 5;
  const cpu = round1(limitar(cpuModelo(ag, ts) + jitter, 0.5, 99));
  const ramPct = ramModelo(ag, ts);
  return { cpu_pct: cpu, ram_usada: Math.round(ag.ram_total * ramPct / 100) };
}

/** Série de métricas no formato de GET /api/agentes/:id/metricas. */
export function gerarMetricas(ag, horas, agora) {
  const balde = horas <= 1 ? 60_000 : horas <= 24 ? 300_000 : 1_800_000;
  const desde = agora - horas * HORA;
  const fim = ag.offlineDesde ?? agora;
  const pontos = [];
  for (let t = Math.floor(desde / balde) * balde; t <= agora; t += balde) {
    const meio = t + balde / 2;
    if (meio < desde - balde || meio > fim) continue;
    const disco = ag.perfil.discos.reduce((m, d) => Math.max(m, d[3]), 0);
    pontos.push({
      t,
      cpu: round1(limitar(cpuModelo(ag, meio) + (hash32(ag.hostname, 'b', t) - 0.5) * 3, 0.5, 99)),
      ram: round1(ramModelo(ag, meio)),
      disco: round1(disco + (hash32(ag.hostname, 'd', Math.floor(t / DIA)) - 0.5) * 0.2),
    });
  }
  return { horas, baldeMs: balde, desde, pontos };
}

const round1 = (v) => Math.round(v * 10) / 10;
