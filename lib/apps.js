import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const SO = process.platform;
const PASTAS = ['/Applications', '/Applications/Utilities', `${process.env.HOME}/Applications`];

// No Windows o equivalente a /Applications e a pasta de apps da shell - a mesma
// que a tela "Todos os aplicativos" do Menu Iniciar mostra.
//
// Varrer os .lnk do Menu Iniciar nao dava conta. App da Store nao deixa atalho
// nenhum em disco, jogo da Steam tambem nao, e uma parte dos instaladores grava
// o destino so como lista de IDs - o atalho existe, mas nao revela executavel.
// Nesta maquina eram 28 apps listados contra 138 que o Menu Iniciar mostra:
// ficavam de fora Terminal, Paint, Fotos, Configuracoes, Xbox, Minecraft, os
// jogos da Steam e o Chrome. A pasta de apps ja traz todos, com o nome que a
// pessoa ve na tela, e serve tanto para abrir quanto para tirar o icone.
const PASTA_APPS = 'shell:AppsFolder';

// O Menu Iniciar mistura o app com desinstalador, manual, nota de versao e
// buscador de atualizacao. Abrir qualquer um desses no meio de uma musica nao
// ajuda, entao saem da lista.
const LIXO =
  /desinstal|uninstall|readme|leia-?me|licen[cs]|manual|documenta|ajuda|help|website|web site|na web|prompt de comando|command prompt|release notes|notas de vers|check for .*update|install manager|download assistant|diagnostic|import tool/i;

// Nunca concatenar caminho no texto do script: ele vai por variavel de ambiente,
// entao nome com aspas, & ou $ continua sendo so um nome.
function powershell(script, ambiente = {}) {
  return exec(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    {
      timeout: 20000,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, ...ambiente },
    },
  );
}

// A pasta de apps identifica cada item por um texto que a shell sabe abrir: o
// nome do pacote da Store, o `steam://` do jogo, ou `{pasta conhecida}\resto`
// para o executavel de sempre.
//
// O corte de "isso nao e app" sai do destino, nao do nome: ferramenta do Windows
// mora dentro do diretorio do sistema, e app de verdade nao. E o equivalente a
// nao listar /System no Mac, e vale em qualquer idioma - os nomes que a pasta de
// apps mostra sao traduzidos, o caminho do sistema nao. Resolver o GUID da pasta
// conhecida e o que devolve esse caminho.
const PS_LISTA = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Conhecidas {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHGetKnownFolderPath([In] ref Guid id, uint flags, IntPtr token, out IntPtr saida);
  public static string Onde(Guid id) {
    IntPtr p = IntPtr.Zero;
    try { SHGetKnownFolderPath(ref id, 0, IntPtr.Zero, out p); return Marshal.PtrToStringUni(p); }
    catch { return ""; }
    finally { if (p != IntPtr.Zero) Marshal.FreeCoTaskMem(p); }
  }
}
'@

$shell = New-Object -ComObject Shell.Application
$sistema = [Environment]::GetFolderPath('Windows')

function Real($id) {
  if (-not $id.StartsWith('{')) { return '' }
  $fim = $id.IndexOf('}')
  if ($fim -lt 1) { return '' }
  $raiz = ''
  try { $raiz = [Conhecidas]::Onde([Guid]$id.Substring(1, $fim - 1)) } catch { return '' }
  if (-not $raiz) { return '' }
  return (Join-Path $raiz $id.Substring($fim + 1).TrimStart('\\'))
}

# As Ferramentas do Windows tem pasta propria no Menu Iniciar, mas na pasta de
# apps aparecem soltas no meio do resto - e varias sao atalho anunciado de MSI,
# sem caminho para testar. A lista de nomes da pasta e o que permite tirar essas.
$ferramentas = @{}
$ondeFerramentas = Join-Path $env:ProgramData 'Microsoft\\Windows\\Start Menu\\Programs\\Administrative Tools'
if (Test-Path -LiteralPath $ondeFerramentas) {
  foreach ($item in $shell.NameSpace($ondeFerramentas).Items()) { $ferramentas[$item.Name] = $true }
}

# Telas da shell que a pasta de apps lista junto com os apps. O corte e pelo
# identificador, que e o mesmo em qualquer idioma.
$lugares = @{
  'Microsoft.Windows.ControlPanel' = $true
  'Microsoft.Windows.Explorer' = $true
  'Microsoft.Windows.Shell.RunDialog' = $true
  'Microsoft.Windows.AdministrativeTools' = $true
}

$achados = [ordered]@{}
$ocupados = @{}
foreach ($item in $shell.NameSpace($env:RP_PASTA).Items()) {
  $nome = $item.Name
  if (-not $nome -or $achados.Contains($nome)) { continue }
  if ($ferramentas.Contains($nome)) { continue }
  $id = $item.Path
  if (-not $id -or $lugares.Contains($id)) { continue }
  # Ajuda e site do fabricante entram aqui como link. Abrir isso pelo deck so
  # tira o navegador do lugar.
  if ($id -match '^https?://') { continue }
  $alvo = Real $id
  if ($alvo -and $alvo.StartsWith($sistema, [StringComparison]::OrdinalIgnoreCase)) { continue }
  # Sai daqui pronto para uso: e o mesmo texto que abre o item e que pede o icone
  # dele, e para o resto do codigo nao importa de qual das duas listas ele veio.
  $achados[$nome] = "$($env:RP_PASTA)\\$id"
  # O mesmo executavel costuma estar nas duas listas com nomes diferentes - o
  # WordPad e "WordPad" aqui e "Aplicativo Wordpad do Windows" no registro. Vale
  # o nome que a pessoa ve no Menu Iniciar, entao o destino fica anotado para a
  # outra lista nao repetir o app.
  if ($alvo) { $ocupados[$alvo.ToLower()] = $true }
}

# App com o atalho quebrado nao entra na pasta de apps - o Chrome desta maquina e
# assim, o .lnk esta la mas nao aponta para lugar nenhum, e por isso o proprio
# Menu Iniciar nao mostra o Chrome. O registro de caminhos de aplicativo e a
# outra lista que o Windows mantem, e alcanca esses. O nome de exibicao sai da
# informacao de versao do executavel: 'chrome.exe' viraria um botao sem sentido.
foreach ($raiz in 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths',
                  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths',
                  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths') {
  if (-not (Test-Path $raiz)) { continue }
  foreach ($chave in Get-ChildItem $raiz -ErrorAction SilentlyContinue) {
    $exe = ''
    try { $exe = (Get-ItemProperty $chave.PSPath -ErrorAction Stop).'(default)' } catch { continue }
    if (-not $exe) { continue }
    $exe = $exe.Trim('"')
    if (-not (Test-Path -LiteralPath $exe)) { continue }
    if ($ocupados.Contains($exe.ToLower())) { continue }
    if ($exe.StartsWith($sistema, [StringComparison]::OrdinalIgnoreCase)) { continue }
    # Pacote da Store ja veio inteiro da pasta de apps, e o que mora em Common
    # Files e componente compartilhado, nao app.
    if ($exe -like '*\\WindowsApps\\*' -or $exe -like '*\\Common Files\\*') { continue }
    $nome = ''
    try { $nome = [Diagnostics.FileVersionInfo]::GetVersionInfo($exe).FileDescription } catch {}
    if ($nome) { $nome = $nome.Trim() }
    if (-not $nome -or $achados.Contains($nome)) { continue }
    $achados[$nome] = $exe
  }
}

$lista = @($achados.GetEnumerator() | ForEach-Object {
  [pscustomobject]@{ nome = $_.Key; caminho = $_.Value }
})
ConvertTo-Json -InputObject $lista -Compress
`;

// A varredura custa mais de um segundo. Guardar o resultado por um tempo curto
// deixa a leva de icones reusar o mesmo trabalho, e ainda pega app instalado no
// meio da sessao na visita seguinte a aba.
const VALIDADE_LISTA = 30000;
let listaWin = { quando: 0, apps: [] };
let varredura = null;

async function listarWin() {
  if (listaWin.apps.length && Date.now() - listaWin.quando < VALIDADE_LISTA) return listaWin.apps;
  // A tela pede a lista e os icones quase junto, e a leva de icones tambem passa
  // por aqui. Sem isto, cada pedido que chega antes do primeiro terminar abriria
  // uma varredura propria.
  if (!varredura) {
    varredura = (async () => {
      let apps = [];
      try {
        const { stdout } = await powershell(PS_LISTA, { RP_PASTA: PASTA_APPS });
        const cru = JSON.parse(stdout.trim() || '[]');
        apps = (Array.isArray(cru) ? cru : [cru]).filter((a) => a?.nome && !LIXO.test(a.nome));
      } catch {
        apps = [];
      }
      listaWin = { quando: Date.now(), apps };
      varredura = null;
      return apps;
    })();
  }
  return varredura;
}

// A lista de apps instalados e tambem a autorizacao: abrir so aceita nome que
// aparece aqui, entao a rota nunca vira execucao de comando arbitrario.
export async function listarApps() {
  const achados = new Map();

  if (SO === 'darwin') {
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
  } else if (SO === 'win32') {
    for (const { nome, caminho } of await listarWin()) {
      if (!achados.has(nome)) achados.set(nome, caminho);
    }
  } else {
    return [];
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
  if (SO === 'win32') {
    // O caminho ja vem no formato que a shell entende, seja item da pasta de
    // apps ou executavel solto. E Start-Process reclama quando o alvo sumiu,
    // coisa que `explorer.exe` engole em silencio. -FilePath, e nao
    // -LiteralPath: este so existe no PowerShell 7, e o que vem com o Windows e
    // o 5.1.
    await powershell('Start-Process -FilePath $env:RP_ALVO', { RP_ALVO: caminho });
    return true;
  }
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
const emCurso = new Map();

// A tela de edicao pede um icone por app de uma vez so, e no Mac cada um e um
// `sips` barato - mas dezenas em paralelo ainda se atropelam. Poucos por vez
// terminam mais rapido no total, e cada um que termina ja alimenta o cache. No
// Windows nao ha fila: os icones saem todos de uma vez, num processo so.
const LIMITE = 12;
let rodando = 0;
const fila = [];

function entrar() {
  if (rodando < LIMITE) {
    rodando++;
    return Promise.resolve();
  }
  return new Promise((liberado) => fila.push(liberado));
}

function sair() {
  const proximo = fila.shift();
  if (proximo) proximo();
  else rodando--;
}

export async function iconeDoApp(nome) {
  if (cache.has(nome)) return cache.get(nome);

  if (SO === 'win32') {
    await lote();
    return cache.has(nome) ? cache.get(nome) : null;
  }

  // Dois pedidos do mesmo icone antes do primeiro terminar - acontece quando a
  // tela reabre - devem esperar o mesmo trabalho, nao abrir outro.
  if (emCurso.has(nome)) return emCurso.get(nome);

  const tarefa = (async () => {
    await entrar();
    try {
      const png = await extrair(nome);
      cache.set(nome, png);
      return png;
    } finally {
      sair();
      emCurso.delete(nome);
    }
  })();

  emCurso.set(nome, tarefa);
  return tarefa;
}

// Quem desenha o Menu Iniciar e a shell, entao e dela que o icone sai: a mesma
// arte, no mesmo tamanho, para app da Store, jogo da Steam e .exe de sempre. Nao
// da para ir pelo executavel: app da Store nao tem um, e o de varios outros
// guarda so o icone pequeno.
//
// E tudo num processo so. Um PowerShell por app - cada um recompilando este
// mesmo C# - levava perto de um segundo cada, e a tela de edicao pede a lista
// inteira de uma vez: com a centena de apps que a pasta de apps devolve, a
// espera passava de meio minuto. Em lote sao dois segundos para todos.
const PS_ICONES = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct TAMANHO { public int cx; public int cy; }

[StructLayout(LayoutKind.Sequential)]
public struct MAPA {
  public int tipo, largura, altura, bytesPorLinha;
  public ushort planos, bitsPorPixel;
  public IntPtr bits;
}

[ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IFabricaDeImagem {
  void GetImage(TAMANHO tamanho, int flags, out IntPtr mapa);
}

public class Nativo {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string caminho, IntPtr contexto,
    [In] ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IFabricaDeImagem fabrica);
  [DllImport("gdi32.dll")]
  static extern int GetObject(IntPtr mao, int tamanho, ref MAPA info);
  [DllImport("gdi32.dll")]
  static extern bool DeleteObject(IntPtr mao);

  // O retangulo que tem alguma tinta. Icone do Windows varia: uns vem de borda a
  // borda, outros com margem transparente de sobra.
  static Rectangle ComTinta(Bitmap b) {
    BitmapData d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height),
                              ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    byte[] bytes = new byte[d.Stride * b.Height];
    Marshal.Copy(d.Scan0, bytes, 0, bytes.Length);
    b.UnlockBits(d);
    int x1 = b.Width, y1 = b.Height, x2 = -1, y2 = -1;
    for (int y = 0; y < b.Height; y++) {
      int linha = y * d.Stride;
      for (int x = 0; x < b.Width; x++) {
        // Um fiapo de alfa nao conta como tinta: varios icones tem a borda
        // suavizada e ela sozinha nao deveria segurar a margem.
        if (bytes[linha + x * 4 + 3] > 8) {
          if (x < x1) x1 = x;
          if (x > x2) x2 = x;
          if (y < y1) y1 = y;
          if (y > y2) y2 = y;
        }
      }
    }
    if (x2 < 0) return new Rectangle(0, 0, b.Width, b.Height);
    return new Rectangle(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
  }

  // Apara o transparente e recua sempre o mesmo tanto. O .icns do Mac ja traz
  // essa margem de fabrica - a arte ocupa uns 80% da tela do icone -, e o deck
  // foi desenhado para ela. Sem isto o icone do Windows chega de borda a borda:
  // parece maior que o do Mac no mesmo espaco, e o arredondamento do cartao
  // come os cantos da arte.
  static Bitmap Encaixar(Bitmap cru, int lado) {
    Rectangle corte = ComTinta(cru);
    int alvo = (int)Math.Round(lado * 0.8);
    double escala = Math.Min((double)alvo / corte.Width, (double)alvo / corte.Height);
    int largura = Math.Max(1, (int)Math.Round(corte.Width * escala));
    int altura = Math.Max(1, (int)Math.Round(corte.Height * escala));
    Bitmap fim = new Bitmap(lado, lado, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(fim)) {
      g.Clear(Color.Transparent);
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.PixelOffsetMode = PixelOffsetMode.HighQuality;
      g.DrawImage(cru, new Rectangle((lado - largura) / 2, (lado - altura) / 2, largura, altura),
                  corte, GraphicsUnit.Pixel);
    }
    cru.Dispose();
    return fim;
  }

  public static Bitmap Ler(string caminho, int px) {
    Guid iid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
    IFabricaDeImagem fabrica;
    SHCreateItemFromParsingName(caminho, IntPtr.Zero, ref iid, out fabrica);
    TAMANHO tamanho; tamanho.cx = px; tamanho.cy = px;
    IntPtr mao;
    // 0x04 = SIIGBF_BIGGERSIZEOK: prefere entregar a arte maior que ja existe a
    // esticar uma menor ate o tamanho pedido.
    fabrica.GetImage(tamanho, 0x04, out mao);
    Marshal.ReleaseComObject(fabrica);
    if (mao == IntPtr.Zero) return null;

    MAPA info = new MAPA();
    GetObject(mao, Marshal.SizeOf(typeof(MAPA)), ref info);
    Bitmap fim;
    // FromHbitmap joga o canal alfa fora, e o icone sai com o fundo preto em vez
    // de transparente. Ler os bytes do proprio mapa preserva a transparencia.
    //
    // O mapa vem de baixo para cima, como e o padrao do GDI: o primeiro byte e a
    // ultima linha da imagem. Lido em ordem direta o icone sai de cabeca para
    // baixo, entao a leitura comeca na ultima linha e anda para tras - e o que o
    // passo negativo faz.
    if (info.bitsPorPixel == 32 && info.bits != IntPtr.Zero) {
      IntPtr ultima = new IntPtr(info.bits.ToInt64() + (long)(info.altura - 1) * info.bytesPorLinha);
      using (Bitmap cru = new Bitmap(info.largura, info.altura, -info.bytesPorLinha,
                                     PixelFormat.Format32bppArgb, ultima))
        fim = new Bitmap(cru);
    } else {
      fim = Bitmap.FromHbitmap(mao);
    }
    DeleteObject(mao);
    return Encaixar(fim, px);
  }
}
'@

# Um item por linha, na ordem em que a lista foi montada: o arquivo de saida leva
# o numero da linha, e e assim que cada PNG volta a encontrar o seu app. Vai por
# arquivo, e nao por variavel de ambiente, porque a lista inteira nao cabe nela.
$i = -1
foreach ($id in [IO.File]::ReadAllLines($env:RP_LISTA, [Text.Encoding]::UTF8)) {
  $i++
  if (-not $id) { continue }
  # Um app sem arte nao pode derrubar a leva inteira: a tela cai na inicial do
  # nome quando o icone nao vem, e os outros continuam.
  try {
    $bmp = [Nativo]::Ler($id, 128)
    if (-not $bmp) { continue }
    $bmp.Save((Join-Path $env:RP_SAIDA "$i.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  } catch {}
}
`;

// A leva vale enquanto a lista que a gerou valer. Quem pede um icone durante a
// leva espera a mesma; lista nova - app instalado no meio da sessao - pede leva
// nova na visita seguinte a aba.
let loteWin = { quando: 0, feito: null };

async function extrairTodosWin(apps) {
  const pasta = await mkdtemp(join(tmpdir(), 'remote-player-icones-'));
  try {
    const lista = join(pasta, 'apps.txt');
    await writeFile(lista, apps.map((a) => a.caminho).join('\n'), 'utf8');
    await powershell(PS_ICONES, { RP_LISTA: lista, RP_SAIDA: pasta });
    await Promise.all(
      apps.map(async (a, i) => {
        try {
          cache.set(a.nome, await readFile(join(pasta, `${i}.png`)));
        } catch {}
      }),
    );
  } catch {
  } finally {
    rm(pasta, { recursive: true, force: true }).catch(() => {});
  }
}

// A lista vem antes da comparacao: e ela que diz qual e a geracao atual, e e a
// mesma que a leva vai percorrer.
async function lote() {
  const apps = await listarWin();
  if (!apps.length) return;
  if (loteWin.quando !== listaWin.quando) {
    // Uma falha nao pode deixar a aba sem icone para sempre, mas repetir a leva a
    // cada icone que faltou seria pior: a geracao guardada segura as duas coisas
    // - erra uma vez por lista, e a lista seguinte tenta de novo.
    loteWin = { quando: listaWin.quando, feito: extrairTodosWin(apps).catch(() => {}) };
  }
  await loteWin.feito;
}

async function extrair(nome) {
  const caminho = await caminhoDoApp(nome);
  if (!caminho) return null;

  const saida = join(tmpdir(), `remote-player-icone-${Buffer.from(nome).toString('hex').slice(0, 24)}.png`);

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
  try {
    await exec('sips', ['-s', 'format', 'png', '-Z', '128', icns, '--out', saida], { timeout: 8000 });
    const png = await readFile(saida);
    unlink(saida).catch(() => {});
    return png;
  } catch {
    return null;
  }
}
