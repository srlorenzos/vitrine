(function () {
  "use strict";
  const G = window.GtdJs;
  const $ = (id) => document.getElementById(id);
  const saida = $("saida"), entrada = $("entrada"), prompt = $("prompt"), tela = $("tela");
  const CHAVE = "gtd-demo-v1";
  const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COMANDOS = ["capturar", "entrada", "esclarecer", "proximas", "hoje", "aguardando", "algumdia", "projetos",
    "feito", "editar", "apagar", "mover", "revisao", "resumo", "arquivar", "ajuda"];
  const RAIZ = ["gtd", "cat", "reset", "clear", "ajuda"];
  const ESC = "\u001b[";
  const ansi = (cod, s) => ESC + cod + "m" + s + ESC + "0m";

  // ------------------------------------------------------------ estado
  let hoje = G.hojeLocal();
  let linhas, concluidos, modificado = false, semente = hoje;
  function carregar() {
    try {
      const d = JSON.parse(localStorage.getItem(CHAVE));
      if (d && Array.isArray(d.linhas) && d.linhas.every((x) => typeof x === "string")) {
        modificado = !!d.modificado; semente = d.semente || hoje;
        if (modificado || semente === hoje) { linhas = d.linhas; concluidos = Array.isArray(d.concluidos) ? d.concluidos : []; return; }
      }
    } catch (e) { /* sem localStorage: segue com o exemplo */ }
    linhas = G.exemplo(hoje); concluidos = []; modificado = false; semente = hoje;
  }
  function persistir() {
    try { localStorage.setItem(CHAVE, JSON.stringify({ linhas, concluidos, modificado, semente })); } catch (e) { /* ignora */ }
  }
  carregar();
  let repo, gtd;
  function montar() {
    repo = new G.Repositorio(linhas, concluidos, (l, d) => { linhas = l.slice(); concluidos = d.slice(); modificado = true; persistir(); });
    gtd = new G.Gtd(repo, hoje);
  }
  montar();

  // ------------------------------------------------------------ saida
  const CLASSES = { "1": "n", "90": "c-cinza", "31": "c-vermelho", "32": "c-verde", "33": "c-amarelo", "34": "c-azul", "36": "c-ciano" };
  function ansiParaHtml(s) {
    const frag = document.createDocumentFragment();
    let cls = [];
    const re = /\u001b\[(\d+)m/g;
    let ultimo = 0, m;
    const emitir = (txt) => {
      if (!txt) return;
      if (!cls.length) { frag.appendChild(document.createTextNode(txt)); return; }
      const sp = document.createElement("span"); sp.className = cls.join(" "); sp.textContent = txt; frag.appendChild(sp);
    };
    while ((m = re.exec(s))) {
      emitir(s.slice(ultimo, m.index)); ultimo = re.lastIndex;
      if (m[1] === "0") cls = []; else if (CLASSES[m[1]]) cls.push(CLASSES[m[1]]);
    }
    emitir(s.slice(ultimo));
    return frag;
  }
  function linhaSaida(s, extra) {
    const d = document.createElement("div"); d.className = "l" + (extra ? " " + extra : "");
    d.appendChild(ansiParaHtml(s)); saida.appendChild(d); rolar(); return d;
  }
  function rolar() { tela.scrollTop = tela.scrollHeight; }

  function promptNormal() {
    prompt.className = "prompt"; prompt.textContent = "";
    const u = document.createElement("span"); u.textContent = "visitante@gtd";
    const dir = document.createElement("span"); dir.className = "dir"; dir.textContent = ":~";
    prompt.append(u, dir, document.createTextNode("$ "));
  }
  function textoPrompt() { return "visitante@gtd:~$ "; }
  function ecoComando(texto) {
    const d = document.createElement("div"); d.className = "l eco";
    const p = document.createElement("span"); p.className = "prompt";
    const u = document.createElement("span"); u.textContent = "visitante@gtd";
    const dir = document.createElement("span"); dir.className = "dir"; dir.textContent = ":~";
    p.append(u, dir, document.createTextNode("$ "));
    d.append(p, document.createTextNode(texto)); saida.appendChild(d); rolar();
  }

  // ------------------------------------------------------------ entrada de linha
  let pendente = null, ocupado = false, digitando = false;
  const historico = []; let posHist = 0, rascunho = "";

  const io = {
    saida: (s) => linhaSaida(s),
    ler: (pergunta) => new Promise((resolve, reject) => {
      prompt.className = "prompt pergunta"; prompt.textContent = pergunta;
      entrada.value = ""; entrada.focus();
      pendente = { pergunta, resolve, reject };
      rolar();
    })
  };

  function responder(valor) {
    const p = pendente; pendente = null;
    const e = document.createElement("div"); e.className = "l";
    e.textContent = p.pergunta + valor; saida.appendChild(e);
    entrada.value = ""; promptNormal(); p.resolve(valor);
  }
  function cancelarPergunta(texto) {
    const p = pendente; pendente = null;
    const e = document.createElement("div"); e.className = "l";
    e.textContent = p.pergunta + (texto || ""); saida.appendChild(e);
    entrada.value = ""; promptNormal(); p.reject(new G.EntradaEncerrada());
  }

  // tokenizacao estilo shell (aspas simples/duplas)
  function tokenizar(linha) {
    const r = []; let atual = "", aspas = null, tem = false;
    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];
      if (aspas) { if (ch === aspas) aspas = null; else atual += ch; }
      else if (ch === '"' || ch === "'") { aspas = ch; tem = true; }
      else if (/\s/.test(ch)) { if (atual || tem) { r.push(atual); atual = ""; tem = false; } }
      else atual += ch;
    }
    if (atual || tem) r.push(atual);
    return r;
  }

  function limpar() { saida.textContent = ""; }

  function catTodo() {
    linhaSaida(ansi("90", "# ~/.gtd/todo.txt"));
    if (!linhas.length) { return; }
    for (const l of linhas) {
      if (!l.trim()) { linhaSaida(""); continue; }
      if (l.startsWith("x ")) { linhaSaida(ansi("90", l)); continue; }
      const partes = l.split(" ").map((p) => {
        if (p.startsWith("+") && p.length > 1) return ansi("36", p);
        if (p.startsWith("@") && p.length > 1) return ansi("32", p);
        if (/^(estado|quem):/.test(p)) return ansi("90", p);
        if (p.startsWith("due:")) return ansi("33", p);
        if (/^\([A-Z]\)$/.test(p)) return p === "(A)" ? ansi("31", p) : ansi("33", p);
        return p;
      });
      linhaSaida(partes.join(" "));
    }
  }

  function resetar() {
    hoje = G.hojeLocal(); linhas = G.exemplo(hoje); concluidos = []; modificado = false; semente = hoje;
    persistir(); montar();
    linhaSaida(ansi("32", "✓ ") + "Exemplo restaurado. Experimente " + ansi("1", "gtd proximas") + ".");
  }

  async function executar(linha, ecoar) {
    const txt = linha.trim();
    if (ecoar !== false) ecoComando(linha);
    if (!txt) return;
    ocupado = true;
    try {
      const args = tokenizar(txt);
      const cmd = args[0];
      if (cmd === "clear" || cmd === "cls") limpar();
      else if (cmd === "reset") resetar();
      else if (cmd === "cat") {
        if (args[1] === "todo.txt" || args[1] === "~/.gtd/todo.txt") catTodo();
        else linhaSaida(ansi("31", "cat: " + (args[1] || "") + ": arquivo não encontrado. Tente: cat todo.txt"));
      } else if (cmd === "ajuda" || cmd === "help") await G.executarLinha(["ajuda"], gtd, io, true);
      else if (cmd === "gtd") await G.executarLinha(args.slice(1), gtd, io, true);
      else linhaSaida(ansi("31", cmd + ": comando não encontrado. Tente: gtd ajuda"));
    } catch (e) {
      linhaSaida(ansi("31", "✗ " + (e && e.message ? e.message : e)));
    } finally {
      ocupado = false; promptNormal(); rolar();
    }
  }

  async function enviar(valor) {
    if (digitando) return;
    if (pendente) { responder(valor); return; }
    if (ocupado) return;
    const v = valor;
    if (v.trim() && historico[historico.length - 1] !== v) historico.push(v);
    posHist = historico.length; rascunho = "";
    entrada.value = "";
    await executar(v);
    entrada.focus();
  }

  // ------------------------------------------------------------ Tab
  function completar() {
    const v = entrada.value, pos = entrada.selectionStart;
    const antes = v.slice(0, pos), resto = v.slice(pos);
    const partes = antes.split(/\s+/);
    const atual = partes[partes.length - 1];
    let opcoes = [];
    if (partes.length === 1) opcoes = RAIZ;
    else if (partes[0] === "gtd" && partes.length === 2) opcoes = COMANDOS;
    else if (partes[0] === "cat" && partes.length === 2) opcoes = ["todo.txt"];
    else if (partes[0] === "gtd" && (partes[1] === "proximas" || partes[1] === "p") && atual.startsWith("@")) {
      opcoes = [...gtd.contextosExistentes()].map((c) => "@" + c);
    } else if (partes[0] === "gtd" && partes[1] === "mover" && partes.length === 4) opcoes = ["proxima", "aguardando", "algumdia"];
    const cand = opcoes.filter((o) => o.startsWith(atual));
    if (!cand.length) return;
    let comum = cand[0];
    for (const c of cand) while (!c.startsWith(comum)) comum = comum.slice(0, -1);
    if (cand.length === 1) comum += " ";
    if (cand.length > 1 && comum === atual) {
      ecoComando(v); linhaSaida(cand.join("   "));
      return;
    }
    const novoAntes = antes.slice(0, antes.length - atual.length) + comum;
    entrada.value = novoAntes + resto;
    entrada.setSelectionRange(novoAntes.length, novoAntes.length);
  }

  entrada.addEventListener("keydown", (e) => {
    if (digitando) { e.preventDefault(); return; }
    if (e.key === "Enter") { e.preventDefault(); enviar(entrada.value); return; }
    if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); limpar(); return; }
    if (e.ctrlKey && e.key.toLowerCase() === "c") {
      if (window.getSelection().toString()) return;
      e.preventDefault();
      if (pendente) cancelarPergunta(entrada.value + "^C");
      else if (!ocupado) { ecoComando(entrada.value + "^C"); entrada.value = ""; }
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      if (pendente) cancelarPergunta("");
      return;
    }
    if (pendente) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!historico.length) return;
      if (posHist === historico.length) rascunho = entrada.value;
      posHist = Math.max(0, posHist - 1); entrada.value = historico[posHist];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (posHist >= historico.length) return;
      posHist++; entrada.value = posHist === historico.length ? rascunho : historico[posHist];
    } else if (e.key === "Tab") {
      e.preventDefault(); completar();
    }
  });

  tela.addEventListener("click", () => { if (!window.getSelection().toString()) entrada.focus(); });

  // ------------------------------------------------------------ chips
  const CHIPS = ["gtd ajuda", "gtd proximas", "gtd hoje", "gtd projetos", "gtd resumo", "gtd entrada", "gtd esclarecer",
    'gtd c "Comprar café @rua"', "gtd feito 3", "cat todo.txt", "reset"];
  function montarChips() {
    const c = $("chips");
    for (const t of CHIPS) {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = t;
      b.addEventListener("click", async () => {
        if (pendente || ocupado || digitando) { entrada.focus(); return; }
        entrada.value = t; entrada.focus();
        await enviar(t);
        tela.scrollIntoView({ block: "nearest" });
      });
      c.appendChild(b);
    }
  }

  // ------------------------------------------------------------ boas-vindas
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  async function digitar(texto) {
    entrada.readOnly = true;
    for (const ch of texto) { entrada.value += ch; await espera(reduzido ? 0 : 55 + Math.random() * 40); }
    await espera(reduzido ? 0 : 350);
    entrada.readOnly = false;
  }
  async function boasVindas() {
    digitando = true; promptNormal(); entrada.value = "";
    await espera(reduzido ? 0 : 500);
    await digitar("gtd ajuda");
    const cmd = entrada.value; entrada.value = "";
    digitando = false;
    await executar(cmd);
    linhaSaida("");
    linhaSaida(ansi("33", "Dica: ") + "experimente " + ansi("1", "gtd proximas") + ansi("90", "  (ou clique nos comandos abaixo)"));
    entrada.value = "";
    if (!matchMedia("(pointer: coarse)").matches) entrada.focus({ preventScroll: true });
  }

  promptNormal(); montarChips(); boasVindas();
})();
