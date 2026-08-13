import { iconeDoApp } from '@/lib/apps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const nome = new URL(req.url).searchParams.get('app') || '';
  let png = null;
  try {
    png = await iconeDoApp(nome);
  } catch {
    png = null;
  }
  // Sem icone a tela desenha a inicial do nome, entao o 404 aqui e esperado.
  if (!png) return new Response('sem icone', { status: 404 });
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  });
}
