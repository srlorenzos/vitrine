// Aplica o tema salvo antes da primeira pintura (compartilhado pela home e pelas demos).
try {
  const t = localStorage.getItem('vitrine-tema');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch { /* sem armazenamento: segue o sistema */ }
