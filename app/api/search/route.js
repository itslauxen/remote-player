import { buscarMusicas } from '@/lib/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const termo = new URL(req.url).searchParams.get('q') || '';
  const resultado = await buscarMusicas(termo);
  return Response.json(resultado, { headers: { 'Cache-Control': 'no-store' } });
}
