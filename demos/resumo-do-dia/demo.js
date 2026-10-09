(function () {
  var quadro = document.getElementById('quadro');
  var moldura = document.getElementById('moldura');
  function ajustar() {
    try {
      var d = quadro.contentDocument;
      if (d && d.body) quadro.style.height = Math.max(d.documentElement.scrollHeight, 400) + 'px';
    } catch (e) { /* mantém a altura padrão */ }
  }
  function assunto() {
    try {
      var t = quadro.contentDocument.title;
      if (t) {
        document.getElementById('assunto').textContent = t;
        document.getElementById('assunto2').textContent = t;
        document.getElementById('lista-assunto').textContent = t;
      }
    } catch (e) { /* mantém o assunto padrão */ }
  }
  quadro.addEventListener('load', function () { ajustar(); assunto(); });
  window.addEventListener('resize', ajustar);
  function modo(celular) {
    moldura.classList.toggle('celular', celular);
    document.getElementById('b-desktop').setAttribute('aria-pressed', String(!celular));
    document.getElementById('b-celular').setAttribute('aria-pressed', String(celular));
    setTimeout(ajustar, 480);
    ajustar();
  }
  document.getElementById('b-desktop').addEventListener('click', function () { modo(false); });
  document.getElementById('b-celular').addEventListener('click', function () { modo(true); });
})();
