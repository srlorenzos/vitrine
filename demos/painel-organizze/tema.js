// Aplica o tema salvo antes da primeira pintura (evita piscar).
try {
  const salvo = localStorage.getItem('painel-tema');
  if (salvo === 'light' || salvo === 'dark') document.documentElement.dataset.theme = salvo;
} catch {
  // armazenamento indisponível: segue o tema do sistema
}
