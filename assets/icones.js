// Ícones SVG próprios (24x24, traço). Cada projeto tem o seu.
const svg = (corpo) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${corpo}</svg>`;

export const icones = {
  resumo: svg('<circle cx="12" cy="8" r="3.2"/><path d="M12 2.2v1.4M5.6 4.8l1 1M18.4 4.8l-1 1M3 10h1.4M19.6 10H21"/><rect x="3.5" y="13" width="17" height="8" rx="2"/><path d="M4 14l8 5 8-5"/>'),
  email: svg('<rect x="3" y="5" width="12" height="9" rx="2"/><path d="M3.5 6l5.5 4.2L14.5 6"/><path d="M15 17.5l2.2 2.2L21.5 15"/><path d="M8 18H5"/>'),
  painel: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 17v-4M12 17V8M16 17v-6"/>'),
  mcp: svg('<circle cx="12" cy="12" r="2.4"/><circle cx="5" cy="6" r="1.8"/><circle cx="19" cy="6" r="1.8"/><circle cx="12" cy="20" r="1.8"/><path d="M6.4 7.2l3.6 3.4M17.6 7.2L14 10.6M12 14.4V18.2"/>'),
  palavreco: svg('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="M14.5 17l2 2 4-4.2"/>'),
  gtd: svg('<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M6.5 9.5l3 2.5-3 2.5M12 15h5"/>'),
  farol: svg('<path d="M9.5 21l1.2-12h2.6l1.2 12z"/><path d="M10.4 12.5h3.2M10.1 16.5h3.8"/><path d="M10.7 9l.5-3h1.6l.5 3"/><path d="M6 4.5L3 3.5M18 4.5l3-1M6 7.5H3M18 7.5h3"/><path d="M8 21h8"/>'),
  codigo: svg('<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  sol: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
  lua: svg('<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>'),
  github: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 .5a11.5 11.5 0 00-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 015.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0012 .5z"/></svg>',
};
