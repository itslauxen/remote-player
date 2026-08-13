import { abrirApp, listarApps } from '@/lib/apps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apps = await listarApps();
    return Response.json(
      { apps: apps.map((a) => a.nome) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json({ apps: [], erro: String(e.message || e).slice(0, 120) });
  }
}

export async function POST(req) {
  const { app } = await req.json().catch(() => ({}));
  if (typeof app !== 'string' || !app) {
    return Response.json({ ok: false, erro: 'app invalido' }, { status: 400 });
  }
  try {
    const ok = await abrirApp(app);
    return Response.json({ ok, erro: ok ? '' : 'esse app nao esta instalado' });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e.message || e).slice(0, 120) });
  }
}
