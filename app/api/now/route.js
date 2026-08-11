import { obterBackend, avisoAtual } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const backend = await obterBackend();
  let info = null;
  try {
    info = await backend.agora();
  } catch {
    info = null;
  }
  return Response.json(
    { ...(info || {}), backend: backend.nome, aviso: avisoAtual() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
