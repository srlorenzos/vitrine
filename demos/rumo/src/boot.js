// Registra o service worker (offline). Em arquivo próprio para o app funcionar sob CSP sem scripts inline.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
