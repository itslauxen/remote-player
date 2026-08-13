import { execFile } from 'node:child_process';
import { readdir, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const SO = process.platform;
const PASTAS = ['/Applications', '/Applications/Utilities', `${process.env.HOME}/Applications`];

// A lista de apps instalados e tambem a autorizacao: abrir so aceita nome que
// aparece aqui, entao a rota nunca vira execucao de comando arbitrario.
export async function listarApps() {
  if (SO !== 'darwin') return [];
  const achados = new Map();
  for (const pasta of PASTAS) {
    let nomes = [];
    try {
      nomes = await readdir(pasta);
    } catch {
      continue;
    }
    for (const nome of nomes) {
      if (!nome.endsWith('.app')) continue;
      const limpo = nome.slice(0, -4);
      if (!achados.has(limpo)) achados.set(limpo, join(pasta, nome));
    }
  }
  return [...achados]
    .map(([nome, caminho]) => ({ nome, caminho }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

async function caminhoDoApp(nome) {
  if (typeof nome !== 'string' || !nome) return '';
  const apps = await listarApps();
  return apps.find((a) => a.nome === nome)?.caminho || '';
}

export async function abrirApp(nome) {
  const caminho = await caminhoDoApp(nome);
  if (!caminho) return false;
  await exec('open', ['-a', caminho], { timeout: 8000 });
  return true;
}

// O icone vale enquanto o servidor estiver de pe: converter custa uns 100ms e
// a tela pede todos de uma vez quando a aba abre.
const cache = new Map();

export async function iconeDoApp(nome) {
  if (cache.has(nome)) return cache.get(nome);

  const png = await extrair(nome);
  cache.set(nome, png);
  return png;
}

async function extrair(nome) {
  const caminho = await caminhoDoApp(nome);
  if (!caminho) return null;

  // O Info.plist aponta o arquivo do icone, as vezes sem a extensao. Apps mais
  // novos guardam o icone dentro do Assets.car e nao expoem .icns nenhum - para
  // esses a tela cai na inicial do nome.
  let arquivo = '';
  try {
    const { stdout } = await exec(
      '/usr/libexec/PlistBuddy',
      ['-c', 'Print :CFBundleIconFile', join(caminho, 'Contents/Info.plist')],
      { timeout: 4000 },
    );
    arquivo = stdout.trim();
  } catch {
    return null;
  }
  if (!arquivo) return null;

  const icns = join(caminho, 'Contents/Resources', arquivo.endsWith('.icns') ? arquivo : `${arquivo}.icns`);
  const saida = join(tmpdir(), `remote-player-icone-${Buffer.from(nome).toString('hex').slice(0, 24)}.png`);
  try {
    await exec('sips', ['-s', 'format', 'png', '-Z', '128', icns, '--out', saida], { timeout: 8000 });
    const png = await readFile(saida);
    unlink(saida).catch(() => {});
    return png;
  } catch {
    return null;
  }
}
