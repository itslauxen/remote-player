import { obterBackend } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { segundos } = await req.json().catch(() => ({}));
  const n = Number(segundos);
  if (!Number.isFinite(n) || n < 0) {
    return Response.json({ ok: false, erro: 'posicao invalida' }, { status: 400 });
  }
  const backend = await obterBackend();
  const ok = await backend.seek(n);
  return Response.json({ ok, erro: ok ? '' : 'este modo nao suporta avancar na faixa' });
}
