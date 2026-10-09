// Mede a altura da faixa da demo e publica em --demo-h, para o painel começar logo abaixo dela.
const barra = document.querySelector('.demo-barra');
const medir = () => document.documentElement.style.setProperty('--demo-h', `${barra.offsetHeight}px`);
if (barra) {
  medir();
  if ('ResizeObserver' in window) new ResizeObserver(medir).observe(barra);
  else addEventListener('resize', medir);
}
