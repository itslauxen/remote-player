import { obterBackend } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERMITIDAS = new Set([
  'play',
  'pause',
  'playpause',
  'next',
  'prev',
  'volup',
  'voldown',
  'mute',
]);

export async function POST(_req, { params }) {
  const { acao } = await params;
  if (!PERMITIDAS.has(acao)) {
    return Response.json({ ok: false, erro: 'acao desconhecida' }, { status: 400 });
  }
  const backend = await obterBackend();
  try {
    const ok = await backend.comando(acao);
    return Response.json({ ok, erro: ok ? '' : 'este modo nao suporta essa acao' });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e.message || e).slice(0, 120) });
  }
}
