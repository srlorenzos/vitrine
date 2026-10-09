// Cliente "HTTP" da demo: mesma interface do painel real, mas as requisições são
// respondidas em memória por demo-servidor.js (nenhuma chamada de rede é feita).
import { servidor } from './demo-conexao.js';

export class ErroApi extends Error {
  constructor(status, dados) {
    super(dados?.erro || `Erro ${status}`);
    this.status = status;
    this.dados = dados || {};
  }
}

let aoNaoAutenticado = () => {};
export function definirAoNaoAutenticado(fn) { aoNaoAutenticado = fn; }

export async function api(caminho, { metodo = 'GET', corpo, silencioso401 = false } = {}) {
  // Simula a latência de rede e entrega uma cópia, como o JSON de uma resposta real.
  await new Promise((r) => setTimeout(r, 40 + Math.random() * 90));
  const { status, dados } = await servidor.requisitar(metodo, caminho, corpo === undefined ? undefined : JSON.parse(JSON.stringify(corpo)));
  if (status >= 400) {
    if (status === 401 && !silencioso401 && !caminho.startsWith('/api/login') && !caminho.startsWith('/api/elevar')) {
      aoNaoAutenticado();
    }
    throw new ErroApi(status, dados);
  }
  return dados;
}

export const get = (c) => api(c);
export const post = (c, corpo = {}) => api(c, { metodo: 'POST', corpo });
export const put = (c, corpo) => api(c, { metodo: 'PUT', corpo });
export const del = (c) => api(c, { metodo: 'DELETE' });
