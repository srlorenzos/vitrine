const palco = document.getElementById('palco'), f = palco.querySelector('iframe');
    function ajustar() {
      const W = Math.max(1180, palco.clientWidth), s = Math.min(1, palco.clientWidth / W);
      f.style.width = W + 'px'; f.style.height = (palco.clientHeight / s) + 'px'; f.style.transform = `scale(${s})`;
    }
    addEventListener('resize', ajustar); ajustar();
