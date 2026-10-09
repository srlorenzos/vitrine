// Estado global mínimo do painel + barramento de eventos em tempo real.

export const estado = {
  usuario: null,
  totpAtivo: false,
  elevadoAte: 0,
  alertasAbertos: 0,
};

const ouvintes = new Map();

/** Assina um tipo de evento do WebSocket ('checkin', 'agente', 'job', 'alerta', 'conexao'). Devolve função para cancelar. */
export function aoEvento(tipo, fn) {
  if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
  ouvintes.get(tipo).add(fn);
  return () => ouvintes.get(tipo)?.delete(fn);
}

export function emitir(tipo, dados) {
  for (const fn of ouvintes.get(tipo) ?? []) {
    try { fn(dados); } catch (e) { console.error(e); }
  }
}

// Demo: em vez de um WebSocket, assina o emissor do servidor simulado (mesmas mensagens JSON).
import { servidor } from './demo-conexao.js';

let cancelar = null;

export function conectarTempoReal() {
  if (cancelar) return;
  cancelar = servidor.aoMensagem((dado) => {
    try {
      const msg = JSON.parse(dado);
      if (msg.tipo) emitir(msg.tipo, msg.dados);
    } catch { /* mensagem malformada é ignorada */ }
  });
  servidor.iniciar();
  setTimeout(() => emitir('conexao', true), 250);
}

export function desconectarTempoReal() {
  cancelar?.();
  cancelar = null;
  emitir('conexao', false);
}
