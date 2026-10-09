// Instância única do servidor simulado, compartilhada por api.js e estado.js.
import { criarServidor } from './demo-servidor.js';

export const servidor = criarServidor();
