const CACHE = 'controle-ytm-v4';
const CASCA = ['/', '/manifest.webmanifest', '/icone-192.png', '/icone-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CASCA))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'atualizar') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((resposta) => {
        // resposta.redirected significa que o fetch seguiu um desvio: atras do
        // Cloudflare Access isso e a tela de login, que chega com status 200 e
        // seria guardada no lugar do CSS. Serve, mas nao cacheia.
        if (resposta && resposta.ok && !resposta.redirected) {
          const copia = resposta.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('/'))),
  );
});
