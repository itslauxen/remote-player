import { obterBackend } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const backend = await obterBackend();
  try {
    const fila = await backend.fila();
    if (!fila) {
      return Response.json({ itens: [], atual: -1, erro: 'a fila so aparece no modo app desktop' });
    }
    return Response.json({ ...fila, erro: '' });
  } catch (e) {
    return Response.json({ itens: [], atual: -1, erro: String(e.message || e).slice(0, 120) });
  }
}

const inteiro = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

export async function POST(req) {
  const n = inteiro((await req.json().catch(() => ({}))).indice);
  if (n === null) {
    return Response.json({ ok: false, erro: 'indice invalido' }, { status: 400 });
  }
  const backend = await obterBackend();
  try {
    const ok = await backend.pularPara(n);
    return Response.json({ ok, erro: ok ? '' : 'nao consegui pular para essa faixa' });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e.message || e).slice(0, 120) });
  }
}

export async function PATCH(req) {
  const corpo = await req.json().catch(() => ({}));
  const de = inteiro(corpo.de);
  const para = inteiro(corpo.para);
  if (de === null || para === null) {
    return Response.json({ ok: false, erro: 'indices invalidos' }, { status: 400 });
  }
  const backend = await obterBackend();
  try {
    const ok = await backend.mover(de, para);
    return Response.json({ ok, erro: ok ? '' : 'nao consegui reordenar' });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e.message || e).slice(0, 120) });
  }
}

export async function DELETE(req) {
  const n = inteiro(new URL(req.url).searchParams.get('indice'));
  if (n === null) {
    return Response.json({ ok: false, erro: 'indice invalido' }, { status: 400 });
  }
  const backend = await obterBackend();
  try {
    const ok = await backend.remover(n);
    return Response.json({ ok, erro: ok ? '' : 'nao consegui remover' });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e.message || e).slice(0, 120) });
  }
}
