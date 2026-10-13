// Registra o service worker (jogo offline). Em arquivo próprio para funcionar sob CSP sem scripts inline.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
