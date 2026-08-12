import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execBruto = promisify(execFile);
const SO = process.platform;

const COMO_INSTALAR = {
  'nowplaying-cli': 'instale com: brew install nowplaying-cli',
  playerctl: 'instale com: sudo apt install playerctl',
};

async function exec(comando, args, opcoes) {
  try {
    return await execBruto(comando, args, opcoes);
  } catch (e) {
    if (e.code === 'ENOENT') {
      const dica = COMO_INSTALAR[comando];
      throw new Error(`${comando} nao encontrado${dica ? ` - ${dica}` : ''}`);
    }
    throw e;
  }
}

const PORTAS_YTMD = [26538, 9863, 8080];
const TOKEN = process.env.YTMD_TOKEN || '';

async function pedir(url, metodo = 'GET', corpo) {
  try {
    const r = await fetch(url, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
        ...(TOKEN ? { Authorization: TOKEN } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
    });
    if (!r.ok) return { status: r.status, dados: null };
    const texto = await r.text();
    try {
      return { status: r.status, dados: JSON.parse(texto) };
    } catch {
      return { status: r.status, dados: null };
    }
  } catch {
    return { status: 0, dados: null };
  }
}

class BackendDesktop {
  nome = 'app desktop (API Server)';
  completo = true;

  constructor(base) {
    this.base = base;
  }

  static async detectar() {
    for (const porta of PORTAS_YTMD) {
      const base = `http://127.0.0.1:${porta}`;
      const { status } = await pedir(`${base}/api/v1/song`);
      if (status === 401) {
        throw new Error(
          `O API Server na porta ${porta} exige token. Desligue a autenticacao ` +
            'no plugin ou rode com YTMD_TOKEN=seu_token.',
        );
      }
      if (status >= 200 && status < 300) return new BackendDesktop(base);
    }
    return null;
  }

  async tentar(caminhos, corpo, metodo = 'POST') {
    for (const caminho of caminhos) {
      const { status } = await pedir(this.base + caminho, metodo, corpo);
      if (status >= 200 && status < 300) return true;
    }
    return false;
  }

  async comando(acao) {
    const rotas = {
      playpause: ['/api/v1/toggle-play'],
      next: ['/api/v1/next'],
      prev: ['/api/v1/previous'],
      mute: ['/api/v1/toggle-mute', '/api/v1/mute'],
    };
    if (rotas[acao]) return this.tentar(rotas[acao]);

    if (acao === 'volup' || acao === 'voldown') {
      const atual = (await this.agora())?.volume ?? 50;
      return this.volume(Math.max(0, Math.min(100, atual + (acao === 'volup' ? 5 : -5))));
    }
    return false;
  }

  volume(valor) {
    return this.tentar(['/api/v1/volume', '/api/v1/set-volume'], {
      volume: Math.round(valor),
    });
  }

  seek(segundos) {
    return this.tentar(['/api/v1/seek-to', '/api/v1/seek'], {
      seconds: Math.round(segundos),
    });
  }

  async tocar(videoId) {
    const corpos = [
      { videoId, insertPosition: 'INSERT_AFTER_CURRENT_VIDEO' },
      { videoId, insertPosition: 'INSERT_AT_END' },
      { videoId },
    ];
    for (const corpo of corpos) {
      if (await this.tentar(['/api/v1/queue'], corpo)) {
        await this.tentar(['/api/v1/next']);
        return true;
      }
    }
    return abrirNoNavegador(videoId);
  }

  async fila() {
    const { dados } = await pedir(`${this.base}/api/v1/queue`);
    const itens = dados?.items;
    if (!Array.isArray(itens)) return null;

    const lista = [];
    let atual = -1;
    itens.forEach((bruto, i) => {
      const v =
        bruto.playlistPanelVideoRenderer ||
        bruto.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
      if (!v) return;
      if (v.selected) atual = lista.length;
      const capas = v.thumbnail?.thumbnails || [];
      lista.push({
        indice: i,
        id: v.videoId || '',
        titulo: v.title?.runs?.[0]?.text || '',
        artista: v.longBylineText?.runs?.[0]?.text || '',
        duracao: v.lengthText?.runs?.[0]?.text || '',
        capa: capas[0]?.url || '',
      });
    });
    return { itens: lista, atual };
  }

  pularPara(indice) {
    return this.tentar(['/api/v1/queue'], { index: Math.round(indice) }, 'PATCH');
  }

  mover(de, para) {
    return this.tentar([`/api/v1/queue/${Math.round(de)}`], { toIndex: Math.round(para) }, 'PATCH');
  }

  remover(indice) {
    return this.tentar([`/api/v1/queue/${Math.round(indice)}`], undefined, 'DELETE');
  }

  async agora() {
    const [faixa, som] = await Promise.all([
      pedir(`${this.base}/api/v1/song`),
      pedir(`${this.base}/api/v1/volume`),
    ]);
    const dados = faixa.dados;
    if (!dados) return null;
    return {
      titulo: dados.title || '',
      artista: dados.artist || dados.author || '',
      capa: dados.imageSrc || '',
      tocando: !dados.isPaused,
      posicao: dados.elapsedSeconds || 0,
      duracao: dados.songDuration || 0,
      volume: som.dados?.state ?? dados.volume ?? null,
      mudo: som.dados?.isMuted ?? false,
      completo: true,
    };
  }
}

const VK = {
  playpause: 0xb3,
  next: 0xb0,
  prev: 0xb1,
  volup: 0xaf,
  voldown: 0xae,
  mute: 0xad,
};

async function teclaWindows(acao) {
  const vk = VK[acao];
  if (vk === undefined) return false;
  const script =
    "Add-Type -Namespace N -Name K -MemberDefinition '[DllImport(\"user32.dll\")] " +
    'public static extern void keybd_event(byte b, byte s, uint f, System.UIntPtr e);\'; ' +
    `[N.K]::keybd_event(${vk},0,0,[System.UIntPtr]::Zero); ` +
    `[N.K]::keybd_event(${vk},0,2,[System.UIntPtr]::Zero)`;
  await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    timeout: 6000,
  });
  return true;
}

async function teclaMac(acao) {
  const controles = { playpause: 'togglePlayPause', next: 'next', prev: 'previous' };
  if (controles[acao]) {
    await exec('nowplaying-cli', [controles[acao]], { timeout: 6000 });
    return true;
  }
  const volumes = {
    volup: 'set volume output volume (output volume of (get volume settings) + 6)',
    voldown: 'set volume output volume (output volume of (get volume settings) - 6)',
    mute: 'set volume output muted (not output muted of (get volume settings))',
  };
  if (volumes[acao]) {
    await exec('osascript', ['-e', volumes[acao]], { timeout: 6000 });
    return true;
  }
  return false;
}

async function teclaLinux(acao) {
  const mapa = {
    playpause: ['play-pause'],
    next: ['next'],
    prev: ['previous'],
    volup: ['volume', '0.05+'],
    voldown: ['volume', '0.05-'],
    mute: ['volume', '0'],
  };
  if (!mapa[acao]) return false;
  await exec('playerctl', mapa[acao], { timeout: 6000 });
  return true;
}

const PS_FAIXA = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Aguardar($op, $tipo) {
  $t = $asTask.MakeGenericMethod($tipo).Invoke($null, @($op)); $t.Wait(3000) | Out-Null; $t.Result
}
$tipoGerenciador=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$g = Aguardar ($tipoGerenciador::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$s = $g.GetCurrentSession()
if ($s -eq $null) { '{}' ; exit }
$p = Aguardar ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
$status = $s.GetPlaybackInfo().PlaybackStatus
@{ titulo=$p.Title; artista=$p.Artist; tocando=($status -eq 'Playing') } | ConvertTo-Json -Compress
`;

async function faixaWindows() {
  try {
    const { stdout } = await exec(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PS_FAIXA],
      { timeout: 9000 },
    );
    const d = JSON.parse(stdout.trim() || '{}');
    return d.titulo ? { ...d, capa: '', posicao: 0, duracao: 0, volume: null } : null;
  } catch {
    return null;
  }
}

async function faixaMac() {
  try {
    const { stdout } = await exec('nowplaying-cli', ['get', 'title', 'artist'], {
      timeout: 6000,
    });
    const [titulo = '', artista = ''] = stdout.trim().split('\n').map((l) => l.trim());
    if (!titulo || titulo === 'null') return null;
    return {
      titulo,
      artista: artista === 'null' ? '' : artista,
      capa: '',
      tocando: true,
      posicao: 0,
      duracao: 0,
      volume: null,
    };
  } catch {
    return null;
  }
}

class BackendTeclas {
  nome = 'teclas de midia do sistema';
  completo = false;

  async comando(acao) {
    if (SO === 'win32') return teclaWindows(acao);
    if (SO === 'darwin') return teclaMac(acao);
    return teclaLinux(acao);
  }

  async volume() {
    return false;
  }

  async seek() {
    return false;
  }

  async fila() {
    return null;
  }

  async pularPara() {
    return false;
  }

  async mover() {
    return false;
  }

  async remover() {
    return false;
  }

  async tocar(videoId) {
    return abrirNoNavegador(videoId);
  }

  async agora() {
    const info = SO === 'win32' ? await faixaWindows() : SO === 'darwin' ? await faixaMac() : null;
    return info ? { ...info, completo: false } : null;
  }
}

export async function abrirNoNavegador(videoId) {
  const url = `https://music.youtube.com/watch?v=${videoId}`;
  try {
    if (SO === 'win32') await exec('cmd', ['/c', 'start', '', url], { timeout: 6000 });
    else if (SO === 'darwin') await exec('open', [url], { timeout: 6000 });
    else await exec('xdg-open', [url], { timeout: 6000 });
    return true;
  } catch {
    return false;
  }
}

let cache = { backend: null, quando: 0, aviso: '' };

export async function obterBackend() {
  const agora = Date.now();
  const ehDesktop = cache.backend instanceof BackendDesktop;
  if (cache.backend && (ehDesktop || agora - cache.quando < 15000)) return cache.backend;

  let aviso = '';
  let backend = null;
  try {
    backend = await BackendDesktop.detectar();
  } catch (e) {
    aviso = e.message;
  }
  cache = { backend: backend || new BackendTeclas(), quando: agora, aviso };
  return cache.backend;
}

export function avisoAtual() {
  return cache.aviso;
}
