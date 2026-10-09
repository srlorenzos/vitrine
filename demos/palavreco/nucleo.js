/* Nucleo do Palavreco: porte fiel de jogo.py / palavras.py / estatisticas.py */
(function (raiz) {
  "use strict";
  const TAMANHO = 5, MAX_TENTATIVAS = 6;
  const CERTA = "certa", LUGAR = "lugar", ERRADA = "errada";
  const PRIORIDADE = { errada: 1, lugar: 2, certa: 3 };
  const JOGANDO = "jogando", VENCEU = "venceu", PERDEU = "perdeu";
  const EMOJIS = {
    false: { certa: "🟩", lugar: "🟨", errada: "⬛" },
    true: { certa: "🟧", lugar: "🟦", errada: "⬛" }
  };
  // Dia 1 do jogo (2024-01-01), como DATA_BASE no Python.
  const DATA_BASE_UTC = Date.UTC(2024, 0, 1);

  class ChuteInvalido extends Error {}

  function normalizar(texto) {
    return String(texto).trim().normalize("NFD").replace(/\p{Mn}/gu, "").toUpperCase();
  }

  function avaliar(chute, segredo) {
    chute = normalizar(chute); segredo = normalizar(segredo);
    if (chute.length !== segredo.length) throw new Error("chute e segredo precisam ter o mesmo tamanho");
    const res = new Array(chute.length).fill(ERRADA);
    const restantes = {};
    for (let i = 0; i < chute.length; i++) {
      if (chute[i] === segredo[i]) res[i] = CERTA;
      else restantes[segredo[i]] = (restantes[segredo[i]] || 0) + 1;
    }
    for (let i = 0; i < chute.length; i++) {
      if (res[i] === CERTA) continue;
      if ((restantes[chute[i]] || 0) > 0) { res[i] = LUGAR; restantes[chute[i]]--; }
    }
    return res;
  }

  class Partida {
    constructor(segredo, palavrasValidas) {
      this.segredo = segredo;
      this.segredoNorm = normalizar(segredo);
      if (this.segredoNorm.length !== TAMANHO) throw new Error("o segredo precisa ter 5 letras");
      this.maxTentativas = MAX_TENTATIVAS;
      this.validas = palavrasValidas ? new Set(palavrasValidas.map(normalizar)) : null;
      this.chutes = []; this.resultados = []; this.teclado = {};
    }
    get tentativasUsadas() { return this.chutes.length; }
    get estado() {
      if (this.chutes.length && this.chutes[this.chutes.length - 1] === this.segredoNorm) return VENCEU;
      if (this.chutes.length >= this.maxTentativas) return PERDEU;
      return JOGANDO;
    }
    get terminou() { return this.estado !== JOGANDO; }
    validar(chute) {
      if (this.terminou) throw new ChuteInvalido("A partida já terminou");
      const norm = normalizar(chute);
      if (norm.length < TAMANHO) throw new ChuteInvalido("Faltam letras");
      if (norm.length > TAMANHO || !/^[A-Z]+$/.test(norm)) throw new ChuteInvalido("Palavra inválida");
      if (this.validas && !this.validas.has(norm)) throw new ChuteInvalido("Palavra não existe");
      return norm;
    }
    chutar(chute) {
      const norm = this.validar(chute);
      const res = avaliar(norm, this.segredoNorm);
      this.chutes.push(norm); this.resultados.push(res);
      for (let i = 0; i < norm.length; i++) {
        const atual = PRIORIDADE[this.teclado[norm[i]]] || 0;
        if (PRIORIDADE[res[i]] > atual) this.teclado[norm[i]] = res[i];
      }
      return res;
    }
  }

  function compartilhar(partida, titulo, altoContraste) {
    const placar = partida.estado === VENCEU
      ? partida.tentativasUsadas + "/" + partida.maxTentativas : "X/" + partida.maxTentativas;
    const em = EMOJIS[!!altoContraste];
    const linhas = partida.resultados.map(r => r.map(s => em[s]).join(""));
    return [titulo + " " + placar, "", ...linhas].join("\n");
  }

  // numero do dia: dias corridos desde 2024-01-01 (data local), 1 na data base
  function numeroDoDia(data) {
    const d = data || new Date();
    const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((utc - DATA_BASE_UTC) / 86400000) + 1;
  }

  async function sha256Hex(txt) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
  }

  // Ordena por sha256 da palavra sem acento (igual a _ORDEM_DIARIA do Python).
  async function ordemDiaria(palavras) {
    const pares = await Promise.all(palavras.map(async p => [await sha256Hex(normalizar(p)), p]));
    pares.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return pares.map(x => x[1]);
  }

  function palavraDoDia(ordem, dia) {
    const n = dia === undefined ? numeroDoDia() : dia;
    const i = (((n - 1) % ordem.length) + ordem.length) % ordem.length;
    return ordem[i];
  }

  // Estatisticas (mesmo formato do JSON do Python), em localStorage
  const inteiro = (v, p = 0) => (Number.isInteger(v) && v >= 0 ? v : p);
  class Estatisticas {
    constructor(chave) {
      this.chave = chave || "palavreco-estatisticas";
      this.jogos = 0; this.vitorias = 0; this.sequencia = 0; this.melhorSequencia = 0;
      this.distribuicao = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      this.ultimoDia = null; this.preferencias = {};
      this.carregar();
    }
    get percentualVitorias() { return this.jogos ? Math.round(100 * this.vitorias / this.jogos) : 0; }
    carregar() {
      let d;
      try { d = JSON.parse(localStorage.getItem(this.chave)); } catch (e) { return; }
      if (!d || typeof d !== "object" || Array.isArray(d)) return;
      this.jogos = inteiro(d.jogos);
      this.vitorias = Math.min(inteiro(d.vitorias), this.jogos);
      this.sequencia = inteiro(d.sequencia);
      this.melhorSequencia = Math.max(inteiro(d.melhor_sequencia), this.sequencia);
      if (d.distribuicao && typeof d.distribuicao === "object")
        for (const k of Object.keys(this.distribuicao)) this.distribuicao[k] = inteiro(d.distribuicao[k]);
      this.ultimoDia = Number.isInteger(d.ultimo_dia) ? d.ultimo_dia : null;
      this.preferencias = d.preferencias && typeof d.preferencias === "object" ? d.preferencias : {};
    }
    salvar() {
      const d = { jogos: this.jogos, vitorias: this.vitorias, sequencia: this.sequencia,
        melhor_sequencia: this.melhorSequencia, distribuicao: this.distribuicao,
        ultimo_dia: this.ultimoDia, preferencias: this.preferencias };
      try { localStorage.setItem(this.chave, JSON.stringify(d)); return true; } catch (e) { return false; }
    }
    registrar(venceu, tentativas, dia) {
      this.jogos++;
      if (venceu) {
        this.vitorias++; this.sequencia++;
        this.melhorSequencia = Math.max(this.melhorSequencia, this.sequencia);
        if (String(tentativas) in this.distribuicao) this.distribuicao[tentativas]++;
      } else this.sequencia = 0;
      if (dia !== undefined && dia !== null) this.ultimoDia = dia;
      this.salvar();
    }
    definirPreferencia(k, v) { this.preferencias[k] = v; this.salvar(); }
  }

  const Nucleo = { TAMANHO, MAX_TENTATIVAS, CERTA, LUGAR, ERRADA, JOGANDO, VENCEU, PERDEU,
    ChuteInvalido, normalizar, avaliar, Partida, compartilhar, numeroDoDia, ordemDiaria,
    palavraDoDia, Estatisticas };
  if (typeof module !== "undefined" && module.exports) module.exports = Nucleo;
  else raiz.Nucleo = Nucleo;
})(typeof window !== "undefined" ? window : globalThis);
