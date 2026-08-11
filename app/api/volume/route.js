import { obterBackend } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { valor } = await req.json().catch(() => ({}));
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return Response.json({ ok: false, erro: 'volume fora de 0 a 100' }, { status: 400 });
  }
  const backend = await obterBackend();
  const ok = await backend.volume(n);
  return Response.json({ ok, erro: ok ? '' : 'este modo nao ajusta volume exato' });
}
