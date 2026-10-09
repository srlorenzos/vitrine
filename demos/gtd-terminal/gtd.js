/* Porte em JavaScript do gtd-terminal (Java 17): Tarefa, Gtd, Cli, Esclarecer e Revisao.
   A saida usa os mesmos codigos ANSI do original; a interface os converte em CSS. */
(function (raiz) {
  "use strict";

  const VERSAO = "1.0.0";

  // ---------------------------------------------------------------- datas
  const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
  function dataValida(s) {
    const m = RE_DATA.exec(s);
    if (!m) return false;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  function utc(s) { const m = RE_DATA.exec(s); return Date.UTC(+m[1], +m[2] - 1, +m[3]); }
  function diasEntre(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }
  function somarDias(s, n) {
    const d = new Date(utc(s) + n * 86400000);
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
  }
  function hojeLocal() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function diaSemana(s) { return (new Date(utc(s)).getUTCDay() + 6) % 7; } // 0 = segunda
  function relativa(d, hoje) {
    const dias = diasEntre(hoje, d);
    if (dias === 0) return "hoje";
    if (dias === 1) return "amanhã";
    if (dias === -1) return "ontem";
    if (dias > 0) return "em " + dias + " dias";
    return "há " + (-dias) + " dias";
  }

  // --------------------------------------------------------------- Tarefa
  function tarefa(concluida, prioridade, conclusao, criacao, texto) {
    return { concluida, prioridade, conclusao, criacao, texto: (texto || "").trim() };
  }
  function dataNoInicio(s) {
    if (s.length < 10 || (s.length > 10 && s[10] !== " ")) return null;
    const d = s.slice(0, 10);
    return dataValida(d) ? d : null;
  }
  function parse(linha) {
    let s = linha.trim();
    let concluida = false, prioridade = null, conclusao = null, criacao = null;
    if (s.startsWith("x ")) {
      concluida = true;
      s = s.slice(2).trimStart();
      const d1 = dataNoInicio(s);
      if (d1) {
        conclusao = d1; s = s.slice(10).trimStart();
        const d2 = dataNoInicio(s);
        if (d2) { criacao = d2; s = s.slice(10).trimStart(); }
      }
    } else {
      if (s.length >= 4 && s[0] === "(" && s[2] === ")" && s[3] === " " && s[1] >= "A" && s[1] <= "Z") {
        prioridade = s[1]; s = s.slice(4).trimStart();
      }
      const d = dataNoInicio(s);
      if (d) { criacao = d; s = s.slice(10).trimStart(); }
    }
    return tarefa(concluida, prioridade, conclusao, criacao, s);
  }
  function serializar(t) {
    let r = "";
    if (t.concluida) { r += "x "; if (t.conclusao) r += t.conclusao + " "; }
    else if (t.prioridade) r += "(" + t.prioridade + ") ";
    if (t.criacao) r += t.criacao + " ";
    return r + t.texto;
  }
  const tokens = (t) => t.texto.split(/\s+/).filter(Boolean);
  function comPrefixo(t, p) { return tokens(t).filter((k) => k.length > 1 && k[0] === p).map((k) => k.slice(1)); }
  const projetosDe = (t) => comPrefixo(t, "+");
  const contextosDe = (t) => comPrefixo(t, "@");
  function valorDe(token, chave) {
    const i = token.indexOf(":");
    if (i <= 0 || token.slice(0, i) !== chave) return null;
    const v = token.slice(i + 1);
    return v === "" || v.startsWith("//") ? null : v;
  }
  function chave(t, k) {
    for (const tk of tokens(t)) { const v = valorDe(tk, k); if (v !== null) return v; }
    return null;
  }
  const comTexto = (t, novo) => tarefa(t.concluida, t.prioridade, t.conclusao, t.criacao, novo);
  function comChave(t, k, valor) {
    const r = []; let achou = false;
    for (const tk of tokens(t)) {
      if (valorDe(tk, k) !== null) { if (!achou) r.push(k + ":" + valor); achou = true; }
      else r.push(tk);
    }
    if (!achou) r.push(k + ":" + valor);
    return comTexto(t, r.join(" "));
  }
  function semChave(t, k) { return comTexto(t, tokens(t).filter((tk) => valorDe(tk, k) === null).join(" ")); }
  function vencimento(t) { const v = chave(t, "due"); return v && dataValida(v) ? v : null; }
  function titulo(t) {
    return tokens(t).filter((tk) => valorDe(tk, "estado") === null && valorDe(tk, "quem") === null && valorDe(tk, "due") === null).join(" ");
  }
  const comPrioridade = (t, p) => tarefa(t.concluida, p, t.conclusao, t.criacao, t.texto);
  const comCriacao = (t, d) => tarefa(t.concluida, t.prioridade, t.conclusao, d, t.texto);
  const concluir = (t, hoje) => tarefa(true, null, hoje, t.criacao, t.texto);

  // --------------------------------------------------------------- Estado
  const ESTADOS = {
    ENTRADA: { chave: "entrada", titulo: "Entrada" },
    PROXIMA: { chave: "proxima", titulo: "Próximas ações" },
    AGUARDANDO: { chave: "aguardando", titulo: "Aguardando" },
    ALGUMDIA: { chave: "algumdia", titulo: "Algum dia" },
    REFERENCIA: { chave: "referencia", titulo: "Referência" },
    CONCLUIDA: { chave: "concluida", titulo: "Concluídas" }
  };
  function estadoDe(t) {
    if (t.concluida) return ESTADOS.CONCLUIDA;
    const v = (chave(t, "estado") || "").toLowerCase();
    for (const e of Object.values(ESTADOS)) if (e !== ESTADOS.CONCLUIDA && e.chave === v) return e;
    return ESTADOS.ENTRADA;
  }
  const comEstado = (t, e) => comChave(semChave(t, "quem"), "estado", e.chave);

  class EntradaEncerrada extends Error {}
  class ArgInvalido extends Error {}

  // ----------------------------------------------------------- Repositorio
  class Repositorio {
    constructor(linhas, concluidos, aoSalvar) {
      this.l = linhas.slice(); this.done = concluidos.slice(); this.aoSalvar = aoSalvar || (() => {});
    }
    itens() { const r = []; this.l.forEach((s, i) => { if (s.trim()) r.push({ numero: i + 1, tarefa: parse(s) }); }); return r; }
    item(n) {
      if (n < 1 || n > this.l.length || !this.l[n - 1].trim()) throw new ArgInvalido("Não existe a tarefa número " + n + ".");
      return { numero: n, tarefa: parse(this.l[n - 1]) };
    }
    salvar() { this.aoSalvar(this.l, this.done); }
    adicionar(t) {
      while (this.l.length && !this.l[this.l.length - 1].trim()) this.l.pop();
      this.l.push(serializar(t)); this.salvar();
      return { numero: this.l.length, tarefa: t };
    }
    substituir(n, t) { this.item(n); this.l[n - 1] = serializar(t); this.salvar(); }
    apagar(n) { this.item(n); this.l[n - 1] = ""; this.salvar(); }
    arquivar() {
      const manter = [], feitas = [];
      for (const s of this.l) { if (!s.trim()) continue; (parse(s).concluida ? feitas : manter).push(s); }
      if (!feitas.length) return 0;
      this.done.push(...feitas); this.l = manter; this.salvar();
      return feitas.length;
    }
  }

  // ------------------------------------------------------------------ Gtd
  const itemEstado = (i) => estadoDe(i.tarefa);
  function porUrgencia(a, b) {
    const pa = a.tarefa.prioridade ? a.tarefa.prioridade.charCodeAt(0) : 1000;
    const pb = b.tarefa.prioridade ? b.tarefa.prioridade.charCodeAt(0) : 1000;
    if (pa !== pb) return pa - pb;
    const va = vencimento(a.tarefa) || "9999-99-99", vb = vencimento(b.tarefa) || "9999-99-99";
    if (va !== vb) return va < vb ? -1 : 1;
    return a.numero - b.numero;
  }
  class Gtd {
    constructor(repo, hoje) { this.repo = repo; this._hoje = hoje; }
    hoje() { return this._hoje; }
    filtrar(p) { return this.repo.itens().filter(p).sort(porUrgencia); }
    doEstado(e) { return this.filtrar((i) => itemEstado(i) === e); }
    entrada() { return this.repo.itens().filter((i) => itemEstado(i) === ESTADOS.ENTRADA); }
    vencida(i) { const v = vencimento(i.tarefa); return !i.tarefa.concluida && !!v && v < this.hoje(); }
    proximas(ctx) {
      const c = ctx == null ? null : ctx.replace(/^@/, "");
      return this.filtrar((i) => itemEstado(i) === ESTADOS.PROXIMA && (c === null || contextosDe(i.tarefa).includes(c)));
    }
    paraHoje() {
      const h = this.hoje();
      return this.filtrar((i) => {
        const e = itemEstado(i);
        if (e === ESTADOS.CONCLUIDA || e === ESTADOS.ALGUMDIA || e === ESTADOS.REFERENCIA) return false;
        const v = vencimento(i.tarefa);
        return (v !== null && v <= h) || i.tarefa.prioridade === "A";
      });
    }
    contextosExistentes() {
      const r = new Set();
      for (const i of this.repo.itens()) contextosDe(i.tarefa).forEach((c) => r.add(c));
      return r;
    }
    projetos() {
      const mapa = new Map();
      for (const i of this.repo.itens()) {
        const e = itemEstado(i);
        if (e === ESTADOS.CONCLUIDA || e === ESTADOS.REFERENCIA) continue;
        for (const p of projetosDe(i.tarefa)) {
          const k = p.toLowerCase();
          if (!mapa.has(k)) mapa.set(k, { nome: p, acoes: 0, proximas: 0 });
          const v = mapa.get(k); v.acoes++;
          if (e === ESTADOS.PROXIMA) v.proximas++;
        }
      }
      return [...mapa.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map((x) => x[1]);
    }
    projetosSemProximaAcao() { return this.projetos().filter((p) => p.proximas === 0); }
    concluidasRecentes(dias) {
      const inicio = somarDias(this.hoje(), -(dias - 1));
      return this.repo.itens().filter((i) => i.tarefa.concluida && i.tarefa.conclusao && i.tarefa.conclusao >= inicio)
        .sort((a, b) => (a.tarefa.conclusao < b.tarefa.conclusao ? -1 : a.tarefa.conclusao > b.tarefa.conclusao ? 1 : a.numero - b.numero));
    }
    capturar(texto) {
      let t = parse(texto);
      if (!t.texto.trim()) throw new ArgInvalido("Nada para capturar.");
      if (!t.criacao) t = comCriacao(t, this.hoje());
      return this.repo.adicionar(t);
    }
    atualizar(n, nova) { this.repo.substituir(n, nova); }
    concluir(n) {
      const t = this.repo.item(n).tarefa;
      if (t.concluida) throw new ArgInvalido("A tarefa " + n + " já está concluída.");
      this.repo.substituir(n, concluir(t, this.hoje()));
    }
    editar(n, novoTexto) {
      const antiga = this.repo.item(n).tarefa;
      let nova = parse(novoTexto);
      if (!nova.texto.trim()) throw new ArgInvalido("O novo texto está vazio.");
      for (const k of ["estado", "quem"]) {
        if (chave(nova, k) === null && chave(antiga, k) !== null) nova = comChave(nova, k, chave(antiga, k));
      }
      const prio = nova.prioridade || antiga.prioridade;
      this.repo.substituir(n, tarefa(antiga.concluida, antiga.concluida ? null : prio, antiga.conclusao, antiga.criacao, nova.texto));
    }
    apagar(n) { this.repo.apagar(n); }
    mover(n, destino, quem) {
      let t = this.repo.item(n).tarefa;
      if (t.concluida) throw new ArgInvalido("A tarefa " + n + " já está concluída.");
      t = comEstado(t, destino);
      if (destino === ESTADOS.AGUARDANDO && quem && quem.trim()) t = comChave(t, "quem", quem.trim().replace(/\s+/g, "_"));
      this.repo.substituir(n, t);
    }
    arquivar() { return this.repo.arquivar(); }
  }

  // ------------------------------------------------------------- Terminal
  // io = { saida(textoAnsi), ler(pergunta) -> Promise<string> }
  const ESC = "\u001b[";
  function criarTerminal(io, cor) {
    const c = (cod, s) => (cor ? ESC + cod + "m" + s + ESC + "0m" : s);
    const t = {
      negrito: (s) => c("1", s), cinza: (s) => c("90", s), vermelho: (s) => c("31", s),
      verde: (s) => c("32", s), amarelo: (s) => c("33", s), azul: (s) => c("34", s), ciano: (s) => c("36", s),
      linha(s) { io.saida(s === undefined ? "" : s); },
      titulo(s) { io.saida(""); io.saida(t.negrito(s)); },
      ok(s) { io.saida(t.verde("✓ ") + s); },
      aviso(s) { io.saida(t.amarelo("! ") + s); },
      erro(s) { io.saida(t.vermelho("✗ " + s)); },
      vazio(s) { io.saida(t.cinza("  " + s)); },
      async ler(pergunta) {
        let r;
        try { r = await io.ler(pergunta); } catch (e) { if (e instanceof EntradaEncerrada) io.saida(""); throw e; }
        return r.trim();
      },
      async tecla(pergunta, validas) {
        for (;;) {
          const s = await t.ler(pergunta);
          if (s && validas.includes(s[0].toLowerCase())) return s[0].toLowerCase();
          t.aviso("Opção inválida. Use uma de: " + validas.split("").join("/"));
        }
      },
      async sim(pergunta) { return (await t.tecla(pergunta + " [s/n] ", "sn")) === "s"; },
      async lerData(pergunta) {
        for (;;) {
          const s = await t.ler(pergunta);
          if (!s) return null;
          if (dataValida(s)) return s;
          t.aviso("Data inválida. Use AAAA-MM-DD, por exemplo 2026-10-15.");
        }
      },
      barra(feito, total, largura) {
        const cheio = total === 0 ? 0 : Math.floor((feito * largura) / total);
        return "[" + "█".repeat(cheio) + "░".repeat(largura - cheio) + "] " + feito + "/" + total;
      },
      colorirTitulo(ti) {
        return ti.split(" ").map((p) => (p.startsWith("+") && p.length > 1 ? t.ciano(p) : p.startsWith("@") && p.length > 1 ? t.verde(p) : p)).join(" ");
      },
      tabela(itens, hoje, destacar) {
        let largura = 0;
        for (const i of itens) largura = Math.max(largura, Math.min(60, titulo(i.tarefa).length));
        for (const i of itens) {
          const tf = i.tarefa, ti = titulo(tf);
          const falta = Math.max(0, largura - ti.length);
          let prio = tf.prioridade ? "(" + tf.prioridade + ")" : "   ";
          if (tf.prioridade) prio = tf.prioridade === "A" ? t.vermelho(prio) : t.amarelo(prio);
          let sb = t.cinza(String(i.numero).padStart(4)) + "  " + prio + " ";
          sb += (tf.concluida ? t.cinza(ti) : t.colorirTitulo(ti)) + " ".repeat(falta);
          const d = vencimento(tf);
          if (d) {
            const rel = "⏰ " + relativa(d, hoje);
            const venc = d < hoje && !tf.concluida;
            sb += "  " + (venc ? t.vermelho(rel) : d === hoje ? t.amarelo(rel) : t.cinza(rel));
          }
          const q = chave(tf, "quem");
          if (q) sb += "  " + t.azul("↳ " + q.replace(/_/g, " "));
          if (tf.concluida && tf.conclusao) sb += "  " + t.cinza("✓ " + relativa(tf.conclusao, hoje));
          io.saida(sb);
        }
      }
    };
    return t;
  }

  // ------------------------------------------------------------ Esclarecer
  async function esclarecer(gtd, t) {
    const entrada = gtd.entrada();
    if (!entrada.length) { t.ok("A Entrada está vazia."); return true; }
    t.titulo("Esclarecer a Entrada (" + entrada.length + " itens)");
    t.linha(t.cinza("  Teclas de uma letra. [p] pula o item, [q] sai."));
    let n = 0;
    try {
      for (const item of entrada) {
        n++;
        t.linha();
        t.linha(t.cinza("Item " + n + " de " + entrada.length));
        t.tabela([item], gtd.hoje());
        if (!(await esclarecerItem(gtd, t, item))) {
          t.linha(t.cinza("Saindo. O que sobrou continua na Entrada."));
          return false;
        }
      }
    } catch (e) { if (e instanceof EntradaEncerrada) return false; throw e; }
    t.linha();
    t.ok("Entrada vazia.");
    return true;
  }

  async function esclarecerItem(gtd, t, item) {
    const num = item.numero;
    let tf = item.tarefa;
    const r = await t.tecla("É acionável? [s]im  [n]ão  [p]ular  [q]sair > ", "snpq");
    if (r === "q") return false;
    if (r === "p") return true;
    if (r === "n") {
      const d = await t.tecla("Então é: [l]ixo  [a]lgum dia  [r]eferência  [p]ular > ", "larp");
      if (d === "l") { gtd.apagar(num); t.ok("Jogado fora."); }
      else if (d === "a") { gtd.atualizar(num, comEstado(tf, ESTADOS.ALGUMDIA)); t.ok("Guardado em Algum dia."); }
      else if (d === "r") { gtd.atualizar(num, comEstado(tf, ESTADOS.REFERENCIA)); t.ok("Guardado como referência."); }
      return true;
    }
    if (await t.sim("Leva menos de 2 minutos?")) {
      gtd.atualizar(num, concluir(tf, gtd.hoje()));
      t.ok("Faça agora. Marcada como concluída.");
      return true;
    }
    if (await t.sim("Delegar?")) {
      let quem = await t.ler("Para quem? > ");
      if (!quem) quem = "alguém";
      quem = quem.replace(/\s+/g, "_");
      gtd.atualizar(num, comChave(comEstado(tf, ESTADOS.AGUARDANDO), "quem", quem));
      t.ok("Em Aguardando (" + quem.replace(/_/g, " ") + ").");
      return true;
    }
    if (await t.sim("É um projeto (mais de um passo)?")) {
      const projeto = (await t.ler("Nome do projeto > ")).replace(/\s+/g, "_").replace(/^\++/, "");
      if (projeto) {
        const acao = await t.ler("Qual é a próxima ação? (Enter usa o texto do item) > ");
        const base = acao || titulo(tf);
        tf = comTexto(tf, base + " +" + projeto);
      }
    }
    tf = await definirContexto(gtd, t, tf);
    const prazo = await t.lerData("Prazo AAAA-MM-DD (Enter para nenhum) > ");
    if (prazo) tf = comChave(tf, "due", prazo);
    const p = (await t.ler("Prioridade A/B/C (Enter para nenhuma) > ")).toUpperCase();
    if (p && p[0] >= "A" && p[0] <= "Z") tf = comPrioridade(tf, p[0]);
    gtd.atualizar(num, comEstado(tf, ESTADOS.PROXIMA));
    t.ok("Virou próxima ação.");
    return true;
  }

  async function definirContexto(gtd, t, tf) {
    if (contextosDe(tf).length) return tf;
    const ex = gtd.contextosExistentes();
    const sugestao = ex.size === 0 ? "@casa, @pc, @rua, @telefone" : "@" + [...ex].join(", @");
    let ctx = (await t.ler("Contexto (" + sugestao + "; Enter para nenhum) > ")).replace(/\s+/g, "_");
    if (!ctx) return tf;
    if (!ctx.startsWith("@")) ctx = "@" + ctx;
    return comTexto(tf, tf.texto + " " + ctx);
  }

  // --------------------------------------------------------------- Revisao
  async function revisao(gtd, t) {
    const PASSOS = 6;
    const passo = (n, ti) => { t.linha(); t.linha(t.negrito(t.barra(n - 1, PASSOS, 12) + "  Passo " + n + ": " + ti)); };
    t.titulo("Revisão semanal");
    try {
      passo(1, "esvaziar a Entrada");
      if (!gtd.entrada().length) t.ok("Entrada já está vazia."); else await esclarecer(gtd, t);

      passo(2, "revisar as próximas ações");
      let proximas = gtd.proximas(null);
      if (!proximas.length) t.vazio("Nenhuma próxima ação.");
      else {
        while (proximas.length) {
          t.tabela(proximas, gtd.hoje(), (i) => gtd.vencida(i));
          const n = await t.ler("Número para concluir (Enter segue em frente) > ");
          if (!n) break;
          try {
            if (!/^[+-]?\d+$/.test(n)) throw new ArgInvalido("For input string: \"" + n + "\"");
            gtd.concluir(parseInt(n, 10)); t.ok("Concluída.");
          } catch (e) { if (e instanceof ArgInvalido) t.erro(e.message); else throw e; }
          proximas = gtd.proximas(null);
        }
      }

      passo(3, "o que está aguardando");
      const aguardando = gtd.doEstado(ESTADOS.AGUARDANDO);
      if (!aguardando.length) t.vazio("Nada aguardando.");
      for (const i of aguardando) {
        t.tabela([i], gtd.hoje());
        if (await t.sim("Já chegou?")) { gtd.concluir(i.numero); t.ok("Concluída."); }
      }

      passo(4, "projetos sem próxima ação");
      const parados = gtd.projetosSemProximaAcao();
      if (!parados.length) t.ok("Todos os projetos têm próxima ação.");
      for (const p of parados) {
        t.aviso("+" + p.nome + " não tem próxima ação.");
        const acao = await t.ler("Qual é o próximo passo? (Enter pula) > ");
        if (acao) {
          const nova = parse(acao + " +" + p.nome);
          gtd.capturar(serializar(comEstado(nova, ESTADOS.PROXIMA)));
          t.ok("Próxima ação criada.");
        }
      }

      passo(5, "algum dia");
      const algum = gtd.doEstado(ESTADOS.ALGUMDIA);
      if (!algum.length) t.vazio("Nada em Algum dia.");
      for (const i of algum) {
        t.tabela([i], gtd.hoje());
        if (await t.sim("Ativar agora?")) { gtd.mover(i.numero, ESTADOS.PROXIMA, null); t.ok("Virou próxima ação."); }
      }

      passo(6, "concluídos nos últimos 7 dias");
      const feitos = gtd.concluidasRecentes(7);
      if (!feitos.length) t.vazio("Nada concluído."); else t.tabela(feitos, gtd.hoje());

      t.linha();
      t.linha(t.negrito(t.barra(PASSOS, PASSOS, 12)) + "  " + t.verde("Revisão completa."));
    } catch (e) {
      if (e instanceof EntradaEncerrada) t.linha(t.cinza("Revisão interrompida."));
      else throw e;
    }
  }

  // ------------------------------------------------------------------- Cli
  const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
  const AJUDA = (t) => [
    "gtd " + VERSAO + " - o método GTD no terminal (formato todo.txt)",
    "",
    "Uso: gtd <comando> [argumentos] [opções]",
    "",
    "Capturar e esclarecer",
    "  capturar|c \"texto\"      joga na Entrada (aceita +Projeto @contexto due:AAAA-MM-DD (A))",
    "  entrada                 lista a Entrada",
    "  esclarecer              esvazia a Entrada, item a item",
    "",
    "Listas",
    "  proximas|p [@contexto]  próximas ações por contexto",
    "  hoje                    vencidas, que vencem hoje e prioridade (A)",
    "  aguardando              delegadas, esperando resposta",
    "  algumdia                ideias para depois",
    "  projetos                projetos e alerta de projeto sem próxima ação",
    "",
    "Tarefas",
    "  feito <n>               marca como concluída",
    "  editar <n> \"texto\"      troca o texto",
    "  apagar <n>              apaga (pede confirmação)",
    "  mover <n> proxima|aguardando|algumdia [quem]",
    "  arquivar                move as concluídas para done.txt",
    "",
    "Revisão",
    "  revisao                 revisão semanal guiada",
    "  resumo                  painel com contagens e gráfico da semana",
    "",
    "Opções",
    "  --arquivo <caminho>     usa outro arquivo (ou a variável GTD_ARQUIVO)",
    "  --sem-cor               desliga as cores (ou a variável NO_COLOR)",
    "  --sim                   não pede confirmação ao apagar",
    "  --versao                mostra a versão",
    "",
    "Arquivo padrão: ~/.gtd/todo.txt"
  ];

  function numero(args) {
    if (!args.length) throw new ArgInvalido("Informe o número da tarefa.");
    if (!/^[+-]?\d+$/.test(args[0])) throw new ArgInvalido("'" + args[0] + "' não é um número de tarefa.");
    return parseInt(args[0], 10);
  }

  async function executarCli(args, gtd, t, semConfirmar) {
    if (!args.length) { AJUDA(t).forEach((l) => t.linha(l)); return 0; }
    const cmd = args[0].toLowerCase();
    const resto = args.slice(1);
    const listar = (estado, ti, vazio) => {
      const itens = estado === ESTADOS.ENTRADA ? gtd.entrada() : gtd.doEstado(estado);
      t.titulo(ti + " (" + itens.length + ")");
      if (!itens.length) t.vazio(vazio); else t.tabela(itens, gtd.hoje(), (i) => gtd.vencida(i));
    };
    try {
      switch (cmd) {
        case "capturar": case "c": {
          const i = gtd.capturar(resto.join(" "));
          t.ok("Na Entrada como " + t.negrito("#" + i.numero) + ": " + titulo(i.tarefa));
          break;
        }
        case "entrada": listar(ESTADOS.ENTRADA, "Entrada", "A Entrada está vazia."); break;
        case "esclarecer": await esclarecer(gtd, t); break;
        case "proximas": case "p": {
          const ctx = resto.length ? resto[0] : null;
          const itens = gtd.proximas(ctx);
          t.titulo("Próximas ações" + (ctx === null ? "" : " em " + (ctx.startsWith("@") ? ctx : "@" + ctx)) + " (" + itens.length + ")");
          if (!itens.length) { t.vazio("Nenhuma próxima ação."); break; }
          const grupos = new Map();
          for (const i of itens) {
            const cs = contextosDe(i.tarefa); const k = cs.length ? cs[0] : "";
            if (!grupos.has(k)) grupos.set(k, []);
            grupos.get(k).push(i);
          }
          const chaves = [...grupos.keys()].sort((a, b) => {
            if (a === "") return b === "" ? 0 : 1;
            if (b === "") return -1;
            const x = a.toLowerCase(), y = b.toLowerCase();
            return x < y ? -1 : x > y ? 1 : 0;
          });
          for (const k of chaves) {
            t.linha();
            t.linha(t.azul("▸ " + (k === "" ? "sem contexto" : "@" + k)));
            t.tabela(grupos.get(k), gtd.hoje(), (i) => gtd.vencida(i));
          }
          break;
        }
        case "hoje": {
          const itens = gtd.paraHoje();
          t.titulo("Hoje (" + itens.length + ")");
          if (!itens.length) t.vazio("Nada urgente para hoje."); else t.tabela(itens, gtd.hoje(), (i) => gtd.vencida(i));
          break;
        }
        case "aguardando": listar(ESTADOS.AGUARDANDO, "Aguardando", "Nada aguardando."); break;
        case "algumdia": listar(ESTADOS.ALGUMDIA, "Algum dia", "Nada em Algum dia."); break;
        case "projetos": {
          const ps = gtd.projetos();
          t.titulo("Projetos (" + ps.length + ")");
          if (!ps.length) { t.vazio("Nenhum projeto. Use +Nome nas tarefas."); break; }
          const largura = Math.max(...ps.map((p) => p.nome.length));
          for (const p of ps) {
            const nome = p.nome.padEnd(largura);
            const acoes = p.acoes + (p.acoes === 1 ? " ação " : " ações");
            const estado = p.proximas === 0 ? t.vermelho("⚠ sem próxima ação")
              : t.cinza(p.proximas + " próxima" + (p.proximas === 1 ? "" : "s"));
            t.linha("  ◆ " + t.ciano("+" + nome) + "  " + acoes.padEnd(8) + "  " + estado);
          }
          break;
        }
        case "feito": { const n = numero(resto); gtd.concluir(n); t.ok("Tarefa " + n + " concluída."); break; }
        case "editar": {
          const n = numero(resto);
          if (resto.length < 2) throw new ArgInvalido("Uso: gtd editar <n> \"novo texto\"");
          gtd.editar(n, resto.slice(1).join(" ")); t.ok("Tarefa " + n + " atualizada.");
          break;
        }
        case "apagar": {
          const n = numero(resto);
          const item = gtd.repo.item(n);
          t.tabela([item], gtd.hoje());
          if (!semConfirmar && !(await t.sim("Apagar mesmo?"))) { t.linha(t.cinza("Nada foi apagado.")); break; }
          gtd.apagar(n); t.ok("Tarefa " + n + " apagada.");
          break;
        }
        case "mover": {
          const n = numero(resto);
          if (resto.length < 2) throw new ArgInvalido("Uso: gtd mover <n> proxima|aguardando|algumdia");
          const d = resto[1].toLowerCase();
          const destino = d === "proxima" || d === "proximas" ? ESTADOS.PROXIMA : d === "aguardando" ? ESTADOS.AGUARDANDO
            : d === "algumdia" ? ESTADOS.ALGUMDIA : null;
          if (!destino) throw new ArgInvalido("Destino inválido: use proxima, aguardando ou algumdia.");
          gtd.mover(n, destino, resto.length > 2 ? resto.slice(2).join(" ") : null);
          t.ok("Tarefa " + n + " movida para " + destino.titulo + ".");
          break;
        }
        case "revisao": await revisao(gtd, t); break;
        case "resumo": resumo(gtd, t); break;
        case "arquivar": {
          const n = gtd.arquivar();
          t.ok(n === 0 ? "Nada para arquivar." : n + " tarefas movidas para ~/.gtd/done.txt");
          break;
        }
        case "ajuda": case "-h": case "--ajuda": case "help": AJUDA(t).forEach((l) => t.linha(l)); break;
        default:
          t.erro("Comando desconhecido: " + cmd + ". Use 'gtd ajuda'.");
          return 1;
      }
      return 0;
    } catch (e) {
      if (e instanceof ArgInvalido) { t.erro(e.message); return 1; }
      if (e instanceof EntradaEncerrada) return 0;
      throw e;
    }
  }

  function resumo(gtd, t) {
    const hoje = gtd.hoje();
    t.titulo("Resumo");
    t.linha("  Entrada       " + gtd.doEstado(ESTADOS.ENTRADA).length);
    t.linha("  Próximas      " + gtd.doEstado(ESTADOS.PROXIMA).length);
    t.linha("  Aguardando    " + gtd.doEstado(ESTADOS.AGUARDANDO).length);
    t.linha("  Algum dia     " + gtd.doEstado(ESTADOS.ALGUMDIA).length);
    t.linha("  Referência    " + gtd.doEstado(ESTADOS.REFERENCIA).length);
    t.linha("  Projetos      " + gtd.projetos().length);

    const feitos = gtd.concluidasRecentes(7);
    t.titulo("Concluídas nos últimos 7 dias (" + feitos.length + ")");
    const porDia = [0, 0, 0, 0, 0, 0, 0];
    for (const i of feitos) {
      const idx = 6 - diasEntre(i.tarefa.conclusao, hoje);
      if (idx >= 0 && idx < 7) porDia[idx]++;
    }
    const max = Math.max(1, ...porDia);
    for (let k = 0; k < 7; k++) {
      const d = somarDias(hoje, -(6 - k));
      const barra = "█".repeat(Math.floor((porDia[k] * 20) / max));
      t.linha("  " + DIAS[diaSemana(d)] + " " + d.slice(8) + "  " + t.verde(barra) + (porDia[k] > 0 ? " " + porDia[k] : t.cinza("·")));
    }

    const parados = gtd.projetosSemProximaAcao();
    t.titulo("Projetos parados (" + parados.length + ")");
    if (!parados.length) t.vazio("Todos os projetos têm próxima ação.");
    for (const p of parados) t.linha("  " + t.vermelho("⚠ ") + t.ciano("+" + p.nome));
  }

  // Entrada de linha de comando: opcoes globais (como Main.java) + subcomando
  async function executarLinha(argv, gtd, io, corPadrao) {
    const resto = []; let cor = corPadrao, sim = false;
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--sem-cor") cor = false;
      else if (a === "--sim") sim = true;
      else if (a === "--versao" || a === "-v") { io.saida("gtd " + VERSAO); return 0; }
      else if (a === "--arquivo") {
        if (i + 1 >= argv.length) { io.saida("--arquivo precisa de um caminho."); return 1; }
        i++;
      } else resto.push(a);
    }
    return executarCli(resto, gtd, criarTerminal(io, cor), sim);
  }

  // todo.txt de exemplo, com datas relativas a hoje
  function exemplo(hoje) {
    const d = (n) => somarDias(hoje, n);
    return [
      "(A) " + d(-3) + " Enviar a proposta ao cliente +SiteNovo @pc due:" + d(1) + " estado:proxima",
      "(B) " + d(-5) + " Marcar consulta com o dentista +Saude @telefone due:" + d(3) + " estado:proxima",
      d(-6) + " Comprar lâmpadas para a sala @rua estado:proxima",
      d(-4) + " Revisar o contrato do aluguel @pc due:" + d(-1) + " estado:proxima",
      d(-2) + " Escrever o rascunho do post do blog @pc estado:proxima",
      d(-7) + " Esperar o orçamento do pintor +Reforma estado:aguardando quem:Joao",
      d(-3) + " Aguardar o reembolso do convênio estado:aguardando quem:Convênio",
      d(-30) + " Aprender violão estado:algumdia",
      d(-20) + " Viajar para a Patagônia estado:algumdia",
      d(-1) + " Ligar para o contador sobre o imposto",
      d(0) + " Ideia: automatizar o relatório mensal",
      "x " + d(-1) + " " + d(-5) + " Pagar o boleto do condomínio @pc estado:proxima",
      "x " + d(-2) + " " + d(-6) + " Enviar a nota fiscal +SiteNovo @pc estado:proxima",
      "x " + d(-4) + " " + d(-8) + " Lavar o carro @rua estado:proxima"
    ];
  }

  const API = { VERSAO, Repositorio, Gtd, ESTADOS, EntradaEncerrada, executarLinha, exemplo, hojeLocal, somarDias,
    parse, serializar, titulo, projetosDe, contextosDe };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.GtdJs = API;
})(typeof window !== "undefined" ? window : globalThis);
