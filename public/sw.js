const CACHE = 'controle-ytm-v7';
const CASCA = ['/', '/manifest.webmanifest', '/icone-192.png', '/icone-512.png'];

function daRede(requisicao) {
  return fetch(requisicao).then((resposta) => {
    // resposta.redirected significa que o fetch seguiu um desvio: atras do
    // Cloudflare Access isso e a tela de login, que chega com status 200 e
    // seria guardada no lugar do CSS. Serve, mas nao cacheia.
    if (resposta && resposta.ok && !resposta.redirected) {
      const copia = resposta.clone();
      caches.open(CACHE).then((c) => c.put(requisicao, copia));
    }
    return resposta;
  });
}

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

  // Os arquivos de /_next/static tem hash no nome, entao o conteudo nunca muda:
  // valem do cache primeiro. Assim o CSS acompanha a casca quando ela sai do
  // cache. Buscando pela rede ele voltaria como a tela de login do Access
  // sempre que a sessao caducar, e o Safari nao aplica HTML como folha de
  // estilo -- e o app abre sem estilo nenhum.
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || daRede(e.request)));
    return;
  }

  const ehNavegacao = e.request.mode === 'navigate';

  e.respondWith(
    daRede(e.request).catch(() =>
      caches.match(e.request).then((hit) => {
        if (hit) return hit;
        // A casca so responde por navegacao: entregar HTML no lugar de um CSS
        // ou de um script deixaria a pagina quebrada do mesmo jeito.
        return ehNavegacao ? caches.match('/') : Response.error();
      }),
    ),
  );
});
