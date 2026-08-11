import YTMusic from 'ytmusic-api';

let cliente = null;
let iniciando = null;
const cache = new Map();

async function obterCliente() {
  if (cliente) return cliente;
  if (!iniciando) {
    iniciando = (async () => {
      const c = new YTMusic();
      await c.initialize();
      cliente = c;
      return c;
    })().catch((e) => {
      iniciando = null;
      throw e;
    });
  }
  return iniciando;
}

function duracaoLegivel(segundos) {
  if (!segundos && segundos !== 0) return '';
  const s = Math.round(segundos);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export async function buscarMusicas(termo, limite = 15) {
  const chave = termo.trim().toLowerCase();
  if (!chave) return { erro: 'digite alguma coisa', itens: [] };
  if (cache.has(chave)) return cache.get(chave);

  let bruto;
  try {
    const c = await obterCliente();
    bruto = await c.searchSongs(termo);
  } catch (e) {
    return { erro: `falha na busca: ${String(e.message || e).slice(0, 90)}`, itens: [] };
  }

  const itens = bruto
    .filter((m) => m.videoId)
    .slice(0, limite)
    .map((m) => ({
      id: m.videoId,
      titulo: m.name || '',
      artista: m.artist?.name || '',
      album: m.album?.name || '',
      duracao: duracaoLegivel(m.duration),
      capa: [...(m.thumbnails || [])].sort((a, b) => a.width - b.width)[0]?.url || '',
    }));

  const saida = { erro: '', itens };
  if (cache.size > 60) cache.clear();
  cache.set(chave, saida);
  return saida;
}
