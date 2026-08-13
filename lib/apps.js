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

// Bits de modificador do AppKit, na ordem em que o AppleScript os nomeia.
const MODIFICADORES = [
  [1 << 17, 'shift down'],
  [1 << 18, 'control down'],
  [1 << 19, 'option down'],
  [1 << 20, 'command down'],
];

// A janela overlay do iTerm nao entra na lista de janelas do AppleScript
// enquanto esta escondida, entao nao da para revela-la por script. O que
// funciona e disparar o mesmo atalho que o usuario configurou - lido da
// preferencia do proprio iTerm, para continuar valendo se ele trocar o atalho.
const PLIST_ITERM = `${process.env.HOME}/Library/Preferences/com.googlecode.iterm2.plist`;

// Converter o plist inteiro falha: ele guarda objetos que nao viram JSON. Por
// isso cada campo e extraido em separado.
async function campo(caminho) {
  try {
    const { stdout } = await exec('plutil', ['-extract', caminho, 'raw', '-o', '-', PLIST_ITERM], {
      timeout: 4000,
    });
    return stdout.trim();
  } catch {
    return '';
  }
}

async function atalhoDaOverlay() {
  const quantos = Number(await campo('New Bookmarks'));
  if (!Number.isInteger(quantos) || quantos < 1) return null;

  for (let i = 0; i < quantos; i++) {
    if ((await campo(`New Bookmarks.${i}.Has Hotkey`)) !== 'true') continue;
    const codigo = Number(await campo(`New Bookmarks.${i}.HotKey Key Code`));
    if (!Number.isInteger(codigo)) continue;
    return {
      codigo,
      modificadores: Number(await campo(`New Bookmarks.${i}.HotKey Modifier Flags`)) || 0,
    };
  }
  return null;
}

export async function temOverlayDoITerm() {
  if (SO !== 'darwin') return false;
  return (await atalhoDaOverlay()) !== null;
}

export async function alternarOverlayDoITerm() {
  const atalho = await atalhoDaOverlay();
  if (!atalho) return false;
  const usando = MODIFICADORES.filter(([bit]) => atalho.modificadores & bit).map(([, nome]) => nome);
  const script =
    `tell application "System Events" to key code ${atalho.codigo}` +
    (usando.length ? ` using {${usando.join(', ')}}` : '');
  await exec('osascript', ['-e', script], { timeout: 6000 });
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
