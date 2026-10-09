// Gera os JSONs estáticos da demo do painel-organizze (últimos 12 meses).
// Usa as mesmas funções do modo demo do servidor: gerarDemo(hoje) + montarPainel(...).
// Uso: node scripts/gerar-dados.mjs   (requer ../painel-organizze ao lado desta pasta)
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const projeto = path.resolve(aqui, '..', '..', 'painel-organizze', 'src');
const { gerarDemo } = await import(pathToFileURL(path.join(projeto, 'demo.js')).href);
const { montarPainel, addMes } = await import(pathToFileURL(path.join(projeto, 'painel.js')).href);

const p = (n) => String(n).padStart(2, '0');
const d = new Date();
const hoje = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
const atual = hoje.slice(0, 7);

const saida = path.resolve(aqui, '..', 'demos', 'painel-organizze', 'api');
await mkdir(saida, { recursive: true });

const meses = [];
for (let i = 0; i < 12; i++) {
  const mes = addMes(atual, -i);
  // idêntico ao servidor: dados do demo são gerados para "hoje" e o painel recortado pelo mês
  const json = { ...montarPainel(gerarDemo(hoje), { mes, hoje }), demo: true };
  await writeFile(path.join(saida, `painel-${mes}.json`), JSON.stringify(json));
  meses.push(mes);
}
await writeFile(path.join(saida, 'indice.json'), JSON.stringify({ atual, hoje, meses }));
console.log(`Gerados ${meses.length} meses (${meses.at(-1)} a ${atual}) em ${saida}`);
