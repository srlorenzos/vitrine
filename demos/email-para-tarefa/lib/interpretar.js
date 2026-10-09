import { montarData, somarDias, diaDaSemana } from './datas.js';

const PREFIXOS = /^\s*(?:(?:re|res|fw|fwd|enc|tr)\s*:\s*)+/i;

const PRIORIDADES = {
  alta: 5, a: 5, '3': 5,
  media: 3, média: 3, m: 3, '2': 3,
  baixa: 1, b: 1, '1': 1,
};

const DIAS_SEMANA = {
  dom: 0, domingo: 0,
  seg: 1, segunda: 1,
  ter: 2, terca: 2, terça: 2,
  qua: 3, quarta: 3,
  qui: 4, quinta: 4,
  sex: 5, sexta: 5,
  sab: 6, sabado: 6, sábado: 6,
};

function interpretarHora(t) {
  const m = /^(\d{1,2})h(\d{2})?$/.exec(t) || /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function interpretarData(t, hoje) {
  if (t === 'hoje') return hoje;
  if (t === 'amanha' || t === 'amanhã') return somarDias(hoje, 1);
  if (Object.hasOwn(DIAS_SEMANA, t)) {
    // 1..7: sempre estritamente depois de hoje
    const delta = ((DIAS_SEMANA[t] - diaDaSemana(hoje) + 6) % 7) + 1;
    return somarDias(hoje, delta);
  }
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(t);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  if (m[3]) return montarData(Number(m[3]), mes, dia);
  const anoHoje = Number(hoje.slice(0, 4));
  // próxima ocorrência (29/02 pode pular alguns anos)
  for (let ano = anoHoje; ano <= anoHoje + 8; ano++) {
    const d = montarData(ano, mes, dia);
    if (d && d >= hoje) return d;
  }
  return null;
}

/**
 * Interpreta o assunto de um e-mail.
 * @param {string} assunto
 * @param {string} hojeISO data de hoje, YYYY-MM-DD
 */
export function interpretar(assunto, hojeISO) {
  const texto = String(assunto ?? '').replace(PREFIXOS, '');
  const tags = [];
  const palavras = [];
  let prioridade = 0;
  let lista = null;
  let data = null;
  let hora = null;

  for (const t of texto.split(/\s+/).filter(Boolean)) {
    let m;
    if ((m = /^#([\p{L}\p{N}_-]+)$/u.exec(t))) {
      tags.push(m[1]);
    } else if (t[0] === '!' && Object.hasOwn(PRIORIDADES, t.slice(1).toLowerCase())) {
      prioridade = PRIORIDADES[t.slice(1).toLowerCase()];
    } else if (t[0] === '^' && t.length > 1) {
      lista = t.slice(1).replaceAll('_', ' ');
    } else if (t[0] === '@' && t.length > 1) {
      const chave = t.slice(1).toLowerCase();
      const h = interpretarHora(chave);
      const d = h ? null : interpretarData(chave, hojeISO);
      if (h) hora = h;
      else if (d) data = d;
      else palavras.push(t);
    } else {
      palavras.push(t);
    }
  }

  if (hora && !data) data = hojeISO;
  return { titulo: palavras.join(' ') || '(sem título)', tags, prioridade, lista, data, hora };
}

/** Monta o corpo do POST /open/v1/task do TickTick. */
export function paraTickTick(interpretado, { listaId, descricao } = {}) {
  const { titulo, tags, prioridade, data, hora } = interpretado;
  const corpo = { title: titulo, priority: prioridade };
  if (descricao) corpo.content = descricao;
  if (listaId) corpo.projectId = listaId;
  if (tags.length) corpo.tags = tags;
  if (data) {
    corpo.dueDate = `${data}T${hora ?? '00:00'}:00-0300`;
    corpo.isAllDay = !hora;
    corpo.timeZone = 'America/Sao_Paulo';
  }
  return corpo;
}
