(function () {
  "use strict";
  const N = window.Nucleo;
  const { TAMANHO, MAX_TENTATIVAS, VENCEU, PERDEU } = N;
  const ELOGIOS = ["Genial!", "Magnífico!", "Impressionante!", "Muito bem!", "Boa!", "Ufa!"];
  const LINHAS_TECLADO = ["QWERTYUIOP", "ASDFGHJKL", "#ZXCVBNM<"]; // # = ENTER, < = apagar
  const $ = (id) => document.getElementById(id);
  const raiz = document.documentElement;

  const est = new N.Estatisticas();
  let tema = est.preferencias.tema === "claro" ? "claro" : "escuro";
  let alto = !!est.preferencias.alto_contraste;
  let ordem = null, partida = null, livre = false, digitado = "", ocupado = true;
  let pecas = [], teclas = {}, toastTimer = null;
  const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- montagem
  function montarGrade() {
    const g = $("grade"); g.textContent = "";
    pecas = [];
    for (let r = 0; r < MAX_TENTATIVAS; r++) {
      const linha = document.createElement("div");
      linha.className = "linha"; linha.setAttribute("role", "row");
      const cs = [];
      for (let c = 0; c < TAMANHO; c++) {
        const p = document.createElement("div");
        p.className = "peca"; p.setAttribute("role", "gridcell");
        linha.appendChild(p); cs.push(p);
      }
      g.appendChild(linha); pecas.push(cs);
    }
  }
  function montarTeclado() {
    const t = $("teclado"); t.textContent = "";
    for (const fila of LINHAS_TECLADO) {
      const f = document.createElement("div"); f.className = "fila";
      for (const k of fila) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "tecla";
        if (k === "#") { b.textContent = "ENTER"; b.classList.add("larga"); b.dataset.k = "ENTER"; b.setAttribute("aria-label", "Enter"); }
        else if (k === "<") { b.textContent = "⌫"; b.classList.add("larga"); b.dataset.k = "BACK"; b.setAttribute("aria-label", "Apagar"); }
        else { b.textContent = k; b.dataset.k = k; teclas[k] = b; }
        b.addEventListener("click", () => {
          const n = b.dataset.k;
          if (n === "ENTER") confirmar(); else if (n === "BACK") apagar(); else digitar(n);
          b.blur();
        });
        f.appendChild(b);
      }
      t.appendChild(f);
    }
  }

  // ---------- aparencia
  function aplicarAparencia() {
    raiz.dataset.tema = tema;
    raiz.dataset.contraste = alto ? "sim" : "nao";
    $("b-tema").textContent = tema === "escuro" ? "☀" : "☾";
    $("b-contraste").setAttribute("aria-pressed", String(alto));
  }
  function alternarTema() {
    tema = tema === "escuro" ? "claro" : "escuro";
    est.definirPreferencia("tema", tema); aplicarAparencia();
  }
  function alternarContraste() {
    alto = !alto; est.definirPreferencia("alto_contraste", alto);
    aplicarAparencia(); toast("Alto contraste " + (alto ? "ligado" : "desligado"), 1500);
    if (!$("modal").hidden) mostrarEstatisticas();
  }

  function toast(msg, ms) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    $("status").textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 1600);
  }

  // ---------- jogo
  function aleatoria() { return window.PALAVRAS[Math.floor(Math.random() * window.PALAVRAS.length)]; }

  function novaPartida() {
    const segredo = livre ? aleatoria() : N.palavraDoDia(ordem);
    partida = new N.Partida(segredo, window.PALAVRAS);
    digitado = ""; ocupado = false;
    montarGrade();
    for (const k in teclas) teclas[k].classList.remove("certa", "lugar", "errada");
    $("subtitulo").textContent = livre ? "Modo livre" : "Palavra do dia #" + N.numeroDoDia();
  }

  function digitar(letra) {
    if (ocupado || !partida || partida.terminou || digitado.length >= TAMANHO) return;
    const p = pecas[partida.tentativasUsadas][digitado.length];
    digitado += letra;
    p.textContent = letra; p.classList.add("digitando");
  }
  function apagar() {
    if (ocupado || !partida || partida.terminou || !digitado) return;
    digitado = digitado.slice(0, -1);
    const p = pecas[partida.tentativasUsadas][digitado.length];
    p.textContent = ""; p.classList.remove("digitando");
  }

  function confirmar() {
    if (ocupado || !partida || partida.terminou) return;
    const r = partida.tentativasUsadas;
    let res;
    try { res = partida.chutar(digitado); }
    catch (e) {
      if (!(e instanceof N.ChuteInvalido)) throw e;
      toast(e.message);
      const linha = pecas[r][0].parentElement;
      ocupado = true; linha.classList.remove("treme"); void linha.offsetWidth; linha.classList.add("treme");
      setTimeout(() => { linha.classList.remove("treme"); ocupado = false; }, reduzido ? 0 : 300);
      return;
    }
    ocupado = true; digitado = "";
    const atraso = reduzido ? 0 : 230, meia = reduzido ? 0 : 250;
    res.forEach((status, c) => {
      const p = pecas[r][c];
      p.classList.remove("digitando");
      p.style.setProperty("--i", c);
      p.classList.add("vira");
      setTimeout(() => { p.classList.add(status); }, c * atraso + meia);
      if (c === TAMANHO - 1) setTimeout(fimDaLinha, c * atraso + meia * 2 + 30);
    });
  }

  function fimDaLinha() {
    const r = partida.tentativasUsadas - 1;
    partida.chutes[r].split("").forEach((l) => {
      const st = partida.teclado[l];
      teclas[l].classList.remove("certa", "lugar", "errada"); teclas[l].classList.add(st);
    });
    ocupado = false;
    const estado = partida.estado;
    if (estado === VENCEU) toast(ELOGIOS[partida.tentativasUsadas - 1], 2200);
    else if (estado === PERDEU) toast("A palavra era " + partida.segredo.toUpperCase(), 4000);
    else return;
    est.registrar(estado === VENCEU, partida.tentativasUsadas, livre ? null : N.numeroDoDia());
    setTimeout(mostrarEstatisticas, reduzido ? 200 : 1300);
  }

  // ---------- estatisticas
  function tituloCompartilhar() { return livre ? "Palavreco livre" : "Palavreco #" + N.numeroDoDia(); }

  async function copiarResultado() {
    const txt = N.compartilhar(partida, tituloCompartilhar(), alto);
    try { await navigator.clipboard.writeText(txt); toast("Resultado copiado!", 1500); }
    catch (e) {
      try {
        const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta);
        ta.select(); document.execCommand("copy"); ta.remove(); toast("Resultado copiado!", 1500);
      } catch (e2) { toast("Não foi possível copiar", 2000); }
    }
  }

  let focoAnterior = null;
  function fecharStats() {
    if ($("modal").hidden) return;
    $("modal").hidden = true;
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  }
  function mostrarEstatisticas() {
    if ($("modal").hidden) focoAnterior = document.activeElement;
    const nums = $("m-numeros"); nums.textContent = "";
    [[est.jogos, "Jogos"], [est.percentualVitorias + "%", "Vitórias"], [est.sequencia, "Sequência"], [est.melhorSequencia, "Melhor"]]
      .forEach(([v, l]) => {
        const d = document.createElement("div");
        const b = document.createElement("b"); b.textContent = v;
        const s = document.createElement("span"); s.textContent = l;
        d.append(b, s); nums.appendChild(d);
      });
    const barras = $("m-barras"); barras.textContent = "";
    const max = Math.max(1, ...Object.values(est.distribuicao));
    const atual = partida && partida.estado === VENCEU ? partida.tentativasUsadas : null;
    for (let i = 1; i <= MAX_TENTATIVAS; i++) {
      const v = est.distribuicao[i];
      const linha = document.createElement("div"); linha.className = "barra-linha";
      const n = document.createElement("b"); n.textContent = i;
      const f = document.createElement("div");
      f.className = "preench" + (i === atual ? " atual" : "");
      f.style.width = "calc(28px + (100% - 40px) * " + (v / max) + ")";
      f.textContent = v;
      linha.append(n, f); barras.appendChild(linha);
    }
    const fim = $("m-final");
    if (partida && partida.terminou) {
      fim.textContent = (partida.estado === VENCEU ? "Você acertou!" : "Não foi dessa vez.") +
        " A palavra era " + partida.segredo.toUpperCase() + ".";
    } else fim.textContent = "";
    const bt = $("m-botoes"); bt.textContent = "";
    const add = (txt, fn, sec) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = txt;
      if (sec) b.className = "sec"; b.addEventListener("click", fn); bt.appendChild(b); return b;
    };
    let primeiro;
    if (partida && partida.terminou) {
      primeiro = add("Copiar resultado", copiarResultado);
      add("Jogar no modo livre", novoLivre);
    }
    const fechar = add("Fechar", fecharStats, true);
    $("modal").hidden = false;
    (primeiro || fechar).focus();
  }

  function novoLivre() {
    livre = true; fecharStats(); novaPartida();
  }

  // ---------- eventos
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!$("modal").hidden) {
      if (e.key === "Escape") { fecharStats(); e.preventDefault(); }
      else if (e.key === "Tab") { // prende o foco no modal
        const bs = $("m-botoes").querySelectorAll("button");
        const first = bs[0], last = bs[bs.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
      return;
    }
    if (e.key === "F2") { e.preventDefault(); alternarTema(); }
    else if (e.key === "F3") { e.preventDefault(); alternarContraste(); }
    else if (e.key === "F4") { e.preventDefault(); mostrarEstatisticas(); }
    else if (e.key === "Enter") {
      if (document.activeElement && document.activeElement.tagName === "BUTTON" && !document.activeElement.classList.contains("tecla")) return;
      e.preventDefault(); confirmar();
    }
    else if (e.key === "Backspace") { e.preventDefault(); apagar(); }
    else if (e.key.length === 1) {
      const l = N.normalizar(e.key);
      if (l.length === 1 && l >= "A" && l <= "Z") digitar(l);
    }
  });
  $("b-stats").addEventListener("click", mostrarEstatisticas);
  $("b-contraste").addEventListener("click", alternarContraste);
  $("b-tema").addEventListener("click", alternarTema);
  $("b-livre").addEventListener("click", () => { livre = true; novaPartida(); toast("Modo livre: nova palavra!", 1400); });
  $("modal").addEventListener("click", (e) => { if (e.target === $("modal")) fecharStats(); });

  // ---------- inicio
  aplicarAparencia();
  montarGrade(); montarTeclado();
  (async function () {
    try {
      ordem = await N.ordemDiaria(window.PALAVRAS);
    } catch (e) {
      ordem = window.ORDEM_DIARIA; // reserva (contexto sem crypto.subtle)
    }
    if (est.ultimoDia === N.numeroDoDia()) {
      livre = true; novaPartida();
      setTimeout(() => toast("Você já jogou a palavra de hoje. Modo livre!", 3000), 300);
    } else novaPartida();
  })();
})();
