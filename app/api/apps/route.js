import { abrirApp, alternarOverlayDoITerm, listarApps, temOverlayDoITerm } from '@/lib/apps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Alem de abrir apps, o deck faz um punhado de acoes fixas. A lista mora aqui,
// entao a rota nunca executa nada que nao esteja escrito no codigo.
const ACOES = {
  'iterm-overlay': { nome: 'Terminal', icone: 'iTerm', fazer: alternarOverlayDoITerm },
};

export async function GET() {
  try {
    const [apps, temOverlay] = await Promise.all([listarApps(), temOverlayDoITerm()]);
    const acoes = temOverlay
      ? [{ id: 'iterm-overlay', nome: ACOES['iterm-overlay'].nome, icone: 'iTerm' }]
      : [];
    return Response.json(
      { apps: apps.map((a) => a.nome), acoes },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json({ apps: [], acoes: [], erro: String(e.message || e).slice(0, 120) });
  }
}

export async function POST(req) {
  const { app, acao } = await req.json().catch(() => ({}));

  if (typeof acao === 'string' && acao) {
    const escolhida = ACOES[acao];
    if (!escolhida) return Response.json({ ok: false, erro: 'acao desconhecida' }, { status: 400 });
    try {
      const ok = await escolhida.fazer();
      return Response.json({ ok, erro: ok ? '' : 'nao consegui fazer isso' });
    } catch (e) {
      return Response.json({ ok: false, erro: String(e.message || e).slice(0, 120) });
    }
  }

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
