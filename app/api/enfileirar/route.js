import { obterBackend } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== 'string' || !/^[\w-]{11}$/.test(id)) {
    return Response.json({ ok: false, erro: 'id de musica invalido' }, { status: 400 });
  }
  const backend = await obterBackend();
  try {
    const ok = await backend.enfileirar(id);
    return Response.json({
      ok,
      erro: ok ? '' : 'so da para enfileirar no modo app desktop',
    });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e.message || e).slice(0, 120) });
  }
}
