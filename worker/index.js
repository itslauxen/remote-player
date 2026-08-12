// Um endereco so para varias maquinas. O Worker fica na frente e encaminha
// para o tunel da maquina escolhida; ?pc=mac troca e o cookie lembra.
const COOKIE = 'pc';
const ANO = 31536000;
const ROTA_LISTA = '/__dispositivos';

function alvos(env) {
  const mapa = {};
  for (const [chave, valor] of Object.entries(env)) {
    const nome = chave.match(/^ALVO_(.+)$/);
    if (nome && valor) mapa[nome[1].toLowerCase()] = valor;
  }
  return mapa;
}

function cabecalhosAccess(env) {
  if (!env.ACCESS_ID || !env.ACCESS_SECRET) return {};
  return {
    'CF-Access-Client-Id': env.ACCESS_ID,
    'CF-Access-Client-Secret': env.ACCESS_SECRET,
  };
}

function lerCookie(cabecalho, nome) {
  for (const parte of (cabecalho || '').split(';')) {
    const [chave, ...resto] = parte.trim().split('=');
    if (chave === nome) return resto.join('=');
  }
  return '';
}

function offline(alvo, outros, ehApi) {
  if (ehApi) {
    return Response.json(
      { ok: false, erro: `${alvo} nao esta respondendo`, offline: true },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const links = outros
    .map((nome) => `<a href="/?${COOKIE}=${nome}">controlar ${nome}</a>`)
    .join(' &middot; ');
  return new Response(
    `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${alvo} offline</title>
<style>
  body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#111;
       color:#eee;font:16px/1.6 system-ui,sans-serif;text-align:center;padding:24px}
  a{color:#7ab7ff}
</style>
<div>
  <h1>${alvo} nao esta respondendo</h1>
  <p>O servidor nao esta rodando nessa maquina, ou o tunel caiu.</p>
  <p>${links}</p>
</div>`,
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

// Bate em cada maquina para a tela de configuracoes saber quem esta de pe.
async function listar(mapa, nomes, alvo, padrao, env) {
  const dispositivos = await Promise.all(
    nomes.map(async (nome) => {
      try {
        const r = await fetch(new URL('/api/now', mapa[nome]), {
          headers: cabecalhosAccess(env),
          signal: AbortSignal.timeout(4000),
          cf: { cacheTtl: 0 },
        });
        return { nome, online: r.ok };
      } catch {
        return { nome, online: false };
      }
    }),
  );
  return Response.json(
    { atual: alvo, padrao, dispositivos },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export default {
  async fetch(requisicao, env) {
    const mapa = alvos(env);
    const nomes = Object.keys(mapa);
    if (!nomes.length) return new Response('nenhum ALVO_* configurado', { status: 500 });

    const padrao = mapa[env.PADRAO] ? env.PADRAO : nomes[0];
    const url = new URL(requisicao.url);
    const escolhido = url.searchParams.get(COOKIE);

    // Troca de maquina volta para a URL limpa, para o PWA nao guardar o parametro
    // no cache do service worker.
    if (escolhido !== null) {
      if (!mapa[escolhido]) return new Response('maquina desconhecida', { status: 400 });
      url.searchParams.delete(COOKIE);
      return new Response(null, {
        status: 302,
        headers: {
          Location: url.pathname + url.search,
          'Set-Cookie': `${COOKIE}=${escolhido}; Path=/; Max-Age=${ANO}; Secure; SameSite=Lax`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const cookie = lerCookie(requisicao.headers.get('Cookie'), COOKIE);
    const alvo = mapa[cookie] ? cookie : padrao;

    if (url.pathname === ROTA_LISTA) return listar(mapa, nomes, alvo, padrao, env);

    const ehApi = url.pathname.startsWith('/api/');
    const destino = new URL(url.pathname + url.search, mapa[alvo]);
    const adiante = new Request(destino, requisicao);
    for (const [chave, valor] of Object.entries(cabecalhosAccess(env))) {
      adiante.headers.set(chave, valor);
    }

    let resposta;
    try {
      resposta = await fetch(adiante);
    } catch {
      return offline(alvo, nomes.filter((n) => n !== alvo), ehApi);
    }
    // 502 e a familia 52x sao o tunel dizendo que a origem sumiu.
    if (resposta.status === 502 || (resposta.status >= 520 && resposta.status <= 530)) {
      return offline(alvo, nomes.filter((n) => n !== alvo), ehApi);
    }
    return resposta;
  },
};
