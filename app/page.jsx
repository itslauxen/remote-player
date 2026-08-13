'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import styles from './pagina.module.css';

const tempo = (s) => {
  const n = Math.max(0, Math.round(s || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

const pct = (valor, total) => `${total > 0 ? Math.min(100, (valor / total) * 100) : 0}%`;

function Icone({ nome, tamanho = 24 }) {
  const comum = {
    width: tamanho,
    height: tamanho,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  const desenhos = {
    anterior: (
      <>
        <path d="M19 20 9 12l10-8z" fill="currentColor" />
        <path d="M5 19V5" />
      </>
    ),
    proxima: (
      <>
        <path d="M5 4l10 8-10 8z" fill="currentColor" />
        <path d="M19 5v14" />
      </>
    ),
    tocar: <path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none" />,
    pausar: (
      <>
        <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
        <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
      </>
    ),
    som: (
      <>
        <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </>
    ),
    mudo: (
      <>
        <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" />
        <path d="M22 9l-6 6M16 9l6 6" />
      </>
    ),
    busca: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    disco: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    onda: <path d="M3 12h2l2.5-7 4 18 3.5-13 2 6h4" />,
    fila: (
      <>
        <path d="M3 6h13M3 12h13M3 18h9" />
        <path d="m17 15 4 3-4 3z" fill="currentColor" />
      </>
    ),
    dispositivos: (
      <>
        <rect x="2" y="4" width="13" height="9" rx="1.5" />
        <path d="M8.5 13v4M6 17h5" />
        <rect x="17" y="9" width="5" height="11" rx="1.5" />
      </>
    ),
    fechar: <path d="M6 6l12 12M18 6L6 18" />,
    mais: <path d="M12 5v14M5 12h14" />,
    menos: <path d="M5 12h14" />,
    grade: (
      <>
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
      </>
    ),
    seta: <path d="m6 9 6 6 6-6" />,
    pegar: <path d="M5 9h14M5 15h14" />,
    equalizador: (
      <>
        <path d="M5 14v4M9.5 9v9M14.5 5v13M19 11v7" />
      </>
    ),
    lixeira: (
      <>
        <path d="M4 7h16M10 11v6M14 11v6" />
        <path d="M6 7l1 13h10l1-13" />
        <path d="M9 7V4h6v3" />
      </>
    ),
  };
  return <svg {...comum}>{desenhos[nome]}</svg>;
}

const BARRAS = Array.from({ length: 48 }, (_, i) => {
  const centro = 1 - Math.abs(i - 23.5) / 23.5;
  return {
    // Os dois modulos quebram a simetria e dao cara de onda em vez de lente.
    altura: 16 + centro * 30 + ((i * 37) % 23) + ((i * 53) % 17),
    duracao: 0.62 + ((i * 13) % 9) / 10,
    atraso: ((i * 29) % 17) / 20,
  };
});

function Ondas({ classe, tocando }) {
  return (
    <div className={classe} aria-hidden>
      {BARRAS.map((b, i) => (
        // O span carrega a mascara de segmentos e nao escala, senao os tracinhos
        // esticariam junto com a barra.
        <span key={i}>
          <i
            style={{
              '--alt': `${b.altura}%`,
              animationDuration: `${b.duracao}s`,
              animationDelay: `${b.atraso}s`,
              animationPlayState: tocando ? 'running' : 'paused',
            }}
          />
        </span>
      ))}
    </div>
  );
}

// O icone sai do proprio bundle do app. Quem guarda so o icone dentro do
// Assets.car nao expoe .icns, e ai a inicial do nome faz as vezes dele.
function IconeApp({ nome, grande }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <span className={grande ? styles.iconeAppGrande : styles.iconeApp}>
      {falhou ? (
        <span className={styles.inicialApp}>{nome.slice(0, 1)}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/apps/icone?app=${encodeURIComponent(nome)}`}
          alt=""
          loading="lazy"
          onError={() => setFalhou(true)}
        />
      )}
    </span>
  );
}

async function chamar(url, corpo, metodo) {
  const verbo = metodo || (corpo === undefined ? 'GET' : 'POST');
  const temCorpo = corpo !== undefined && verbo !== 'GET' && verbo !== 'DELETE';
  try {
    const r = await fetch(url, {
      method: verbo,
      headers: temCorpo ? { 'Content-Type': 'application/json' } : undefined,
      body: temCorpo ? JSON.stringify(corpo) : undefined,
      cache: 'no-store',
    });
    return await r.json();
  } catch {
    return { ok: false, erro: 'sem conexão com o PC', offline: true };
  }
}

// Altura da linha da fila (64px) mais o respiro entre linhas.
const ALTURA_ITEM = 66;

export default function Pagina() {
  const [aba, setAba] = useState('tocando');
  const [vista, setVista] = useState('normal');
  const [faixa, setFaixa] = useState(null);
  const [estado, setEstado] = useState(null);
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [notaBusca, setNotaBusca] = useState('');
  const [recentes, setRecentes] = useState([]);
  // Cada item do deck e o nome de um app, ou "acao:<id>" para as acoes fixas.
  const [deck, setDeck] = useState([]);
  // null = ainda procurando; [] = servidor nao e um Mac.
  const [appsMac, setAppsMac] = useState(null);
  const [acoesMac, setAcoesMac] = useState([]);
  const [editandoDeck, setEditandoDeck] = useState(false);
  const [promptPwa, setPromptPwa] = useState(null);
  const [volume, setVolume] = useState(null);
  const [fila, setFila] = useState({ itens: [], atual: -1, erro: '' });
  const [deslizado, setDeslizado] = useState(-1);
  const [arrasto, setArrasto] = useState(null);
  const [ondas, setOndas] = useState(false);
  const [somAberto, setSomAberto] = useState(false);
  // null = procurando, false = sem Worker na frente (acesso direto a esta maquina)
  const [dispositivos, setDispositivos] = useState(null);
  // Zero = parado; qualquer outro valor e a hora em que o arrasto comecou.
  const arrastando = useRef(0);
  const volumeFixado = useRef(false);
  const toque = useRef(null);
  const toqueTela = useRef(null);
  const toqueLista = useRef(null);
  const toqueItem = useRef(null);
  const timer = useRef(null);
  const campo = useRef(null);
  const lista = useRef(null);
  const ultimoAlvo = useRef(-1);
  const gestou = useRef(0);
  const rolagem = useRef({ total: 0, quando: 0, disparo: 0 });
  const rolagemX = useRef({ total: 0, quando: 0, disparo: 0 });
  const arrastandoFila = useRef(false);
  const gestoItem = useRef(false);
  const toqueBusca = useRef(null);
  const buscaConsumida = useRef(false);
  const somArrasto = useRef(null);
  const somMoveu = useRef(false);
  const ultimoVolume = useRef(0);
  const envioVolume = useRef(0);

  // A lista mostra so o que vem depois da faixa atual, entao arrastar tambem
  // nao pode passar para tras dela.
  const alvoDe = useCallback(
    (a) =>
      Math.min(
        fila.itens.length - 1,
        Math.max(
          fila.atual >= 0 ? fila.atual + 1 : 0,
          a.posicao + Math.round(a.dy / (a.altura || ALTURA_ITEM)),
        ),
      ),
    [fila.itens.length, fila.atual],
  );

  const completo = !!faixa?.completo;
  const aSeguir = fila.atual >= 0 ? fila.itens[fila.atual + 1] : null;
  const naFila = fila.atual >= 0 ? fila.itens[fila.atual] : null;
  const proximos = fila.atual >= 0 ? fila.itens.length - fila.atual - 1 : fila.itens.length;

  const avisar = useCallback((texto, ok) => {
    setEstado({ texto, ok });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setEstado(null), 2600);
  }, []);

  const atualizar = useCallback(async () => {
    const d = await chamar('/api/now');
    if (d.offline) return;
    // A marca de arrasto guarda a hora, nao um sim/nao: se algum evento de
    // ponteiro se perder, ela expira sozinha e a tela nunca fica congelada.
    if (!arrastando.current || Date.now() - arrastando.current > 4000) {
      arrastando.current = 0;
      setFaixa(d);
    }
    if (!volumeFixado.current && d.volume != null) setVolume(d.volume);
  }, []);

  const carregarFila = useCallback(async () => {
    const d = await chamar('/api/fila');
    if (!d.offline) setFila(d);
  }, []);

  useEffect(() => {
    atualizar();
    const id = setInterval(() => {
      if (!document.hidden) atualizar();
    }, 3000);
    const aoVoltar = () => !document.hidden && atualizar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [atualizar]);

  useEffect(() => {
    if (vista !== 'fila') return;
    carregarFila();
    const id = setInterval(() => {
      if (!document.hidden) carregarFila();
    }, 5000);
    return () => clearInterval(id);
  }, [vista, carregarFila]);

  // O "a seguir" do modo deitado precisa da fila carregada mesmo com a gaveta
  // fechada. Recarrega quando a faixa troca, em vez de ficar em intervalo.
  useEffect(() => {
    if (aba !== 'tocando' || !completo) return;
    carregarFila();
  }, [aba, completo, faixa?.titulo, carregarFila]);

  // Quem responde /__dispositivos e o Worker, nao este servidor. Acessando a
  // maquina direto a rota nao existe, e a tela explica isso.
  useEffect(() => {
    if (aba !== 'config') return;
    let vivo = true;
    setDispositivos(null);
    (async () => {
      try {
        const r = await fetch('/__dispositivos', { cache: 'no-store' });
        if (!r.ok) throw new Error('sem worker');
        const d = await r.json();
        if (vivo) setDispositivos(d);
      } catch {
        if (vivo) setDispositivos(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [aba]);

  useEffect(() => {
    try {
      setRecentes(JSON.parse(localStorage.getItem('buscasRecentes') || '[]'));
      setDeck(JSON.parse(localStorage.getItem('deckApps') || '[]'));
    } catch {}
  }, []);

  // A lista de apps vem da maquina que esta tocando, entao so e pedida quando a
  // aba abre - e de novo a cada visita, caso um app tenha sido instalado.
  useEffect(() => {
    if (aba !== 'deck') return;
    let vivo = true;
    (async () => {
      const d = await chamar('/api/apps');
      if (!vivo) return;
      setAppsMac(d.apps || []);
      setAcoesMac(d.acoes || []);
    })();
    return () => {
      vivo = false;
    };
  }, [aba]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const aoInstalar = (e) => {
      e.preventDefault();
      setPromptPwa(e);
    };
    window.addEventListener('beforeinstallprompt', aoInstalar);
    window.addEventListener('appinstalled', () => setPromptPwa(null));
    return () => window.removeEventListener('beforeinstallprompt', aoInstalar);
  }, []);

  function inicioToqueTela(e) {
    buscaConsumida.current = false;
    if (e.target.closest('input[type=range]')) return (toqueTela.current = null);
    const t = e.touches[0];
    toqueTela.current = { x: t.clientX, y: t.clientY };
  }

  function fimToqueTela(e) {
    if (!toqueTela.current) return;
    // Arrastar um resultado da busca para a direita ja enfileirou: sem isto o
    // mesmo gesto ainda trocaria de tela, porque o limiar dos dois e 70px.
    if (buscaConsumida.current) {
      toqueTela.current = null;
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - toqueTela.current.x;
    const dy = t.clientY - toqueTela.current.y;
    toqueTela.current = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    gestou.current = Date.now();
    navigator.vibrate?.(10);
    // Mesmo sentido do trackpad: dedo para a direita avanca de tela.
    navegar(dx < 0 ? -1 : 1);
  }

  function inicioToque(e) {
    if (e.target.closest('input[type=range]')) return (toque.current = null);
    const t = e.touches[0];
    toque.current = { x: t.clientX, y: t.clientY };
  }

  function fimToque(e) {
    if (!toque.current) return;
    const t = e.changedTouches[0];
    const dy = t.clientY - toque.current.y;
    const dx = t.clientX - toque.current.x;
    toque.current = null;
    if (Math.abs(dy) < 55 || Math.abs(dx) > Math.abs(dy)) return;
    gestou.current = Date.now();
    navigator.vibrate?.(10);
    if (dy < 0) {
      if (vista === 'foco') focar('normal');
      else setVista('fila');
    } else {
      if (vista === 'fila') setVista('normal');
      else focar('foco');
    }
  }

  // Entre 10a e a capa sangrada o navegador morfa capa, player e cabecalho
  // entre os layouts reais - nas duas direcoes, sem posicao chutada. Onde nao
  // ha View Transitions a troca e seca, como antes.
  function focar(novo) {
    const aplicar = () => setVista(novo);
    if (document.startViewTransition) {
      document.startViewTransition(() => flushSync(aplicar));
    } else {
      aplicar();
    }
  }

  function cliqueCapa() {
    if (Date.now() - gestou.current < 600) return;
    focar(vista === 'foco' ? 'normal' : 'foco');
  }

  const TELAS = ['tocando', 'deck', 'busca', 'config'];

  function irPara(nome) {
    if (nome === 'deck') {
      setVista('normal');
      setAba('deck');
      setSomAberto(false);
      return;
    }
    if (nome === 'busca') {
      setVista('normal');
      setAba('busca');
      // O botao some na busca, mas a cortina vive fora dele e ficaria
      // cobrindo a tela inteira, invisivel.
      setSomAberto(false);
      setTimeout(() => campo.current?.focus(), 80);
      return;
    }
    if (nome === 'config') {
      setVista('normal');
      setAba('config');
      return;
    }
    setAba('tocando');
    setVista(nome === 'fila' ? 'fila' : 'normal');
  }

  function telaAtual() {
    if (aba === 'busca' || aba === 'config' || aba === 'deck') return aba;
    return vista === 'fila' ? 'fila' : 'tocando';
  }

  function navegar(passo) {
    if (vista === 'fila') return setVista('normal');
    const base = TELAS.includes(aba) ? aba : 'tocando';
    const i = TELAS.indexOf(base);
    irPara(TELAS[(i + passo + TELAS.length) % TELAS.length]);
  }

  function aoRolarLado(e) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    const agora = Date.now();
    const r = rolagemX.current;
    if (agora - r.quando > 260) r.total = 0;
    r.quando = agora;
    if (agora - r.disparo < 700) return;
    r.total += e.deltaX;
    if (Math.abs(r.total) < 90) return;
    const passo = r.total > 0 ? 1 : -1;
    r.total = 0;
    r.disparo = agora;
    navegar(passo);
  }

  function aoRolar(e) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return aoRolarLado(e);
    const agora = Date.now();
    const r = rolagem.current;
    if (agora - r.quando > 260) r.total = 0;
    r.quando = agora;
    if (agora - r.disparo < 700) return;
    r.total += e.deltaY;
    if (Math.abs(r.total) < 90) return;
    const paraBaixo = r.total > 0;
    r.total = 0;
    r.disparo = agora;
    if (paraBaixo) {
      if (vista === 'foco') focar('normal');
      else setVista('fila');
    } else {
      if (vista === 'fila') setVista('normal');
      else focar('foco');
    }
  }

  // Sucesso de comando nao avisa: o proprio player mudando e o feedback.
  async function comando(acao) {
    navigator.vibrate?.(12);
    const d = await chamar(`/api/cmd/${acao}`, {});
    if (!d.ok) avisar(d.erro || 'não enviado', false);
    setTimeout(atualizar, 350);
  }

  function guardarRecente(q) {
    setRecentes((r) => {
      const novo = [q, ...r.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem('buscasRecentes', JSON.stringify(novo));
      } catch {}
      return novo;
    });
  }

  async function buscar(e, direto) {
    e?.preventDefault();
    const q = (direto ?? termo).trim();
    if (!q) return;
    campo.current?.blur();
    setNotaBusca('Buscando...');
    setResultados([]);
    const d = await chamar(`/api/search?q=${encodeURIComponent(q)}`);
    if (d.erro) return setNotaBusca(d.erro);
    if (!d.itens?.length) return setNotaBusca('Nada encontrado para esse termo.');
    setResultados(d.itens);
    setNotaBusca('');
    guardarRecente(q);
  }

  // Os chips de busca recente pesquisam na hora, sem redigitar.
  function buscarRecente(q) {
    setTermo(q);
    buscar(undefined, q);
  }

  function guardarDeck(novo) {
    setDeck(novo);
    try {
      localStorage.setItem('deckApps', JSON.stringify(novo));
    } catch {}
  }

  // Uma acao guardada e "acao:<id>"; o resto e nome de app.
  const acaoDe = (item) => acoesMac.find((a) => item === `acao:${a.id}`);

  async function abrirNoMac(item) {
    navigator.vibrate?.(12);
    const acao = acaoDe(item);
    const d = await chamar('/api/apps', acao ? { acao: acao.id } : { app: item });
    const rotulo = acao ? acao.nome : item;
    avisar(d.ok ? `${rotulo} ✓` : d.erro || 'não consegui abrir', d.ok);
  }

  async function tocar(item) {
    navigator.vibrate?.(12);
    setNotaBusca(`Enviando ${item.titulo}...`);
    const d = await chamar('/api/play', { id: item.id });
    setNotaBusca(d.ok ? '' : d.erro || 'Não consegui tocar.');
    if (d.ok) {
      setAba('tocando');
      setTimeout(atualizar, 1200);
    }
  }

  async function enfileirar(item) {
    navigator.vibrate?.(16);
    const d = await chamar('/api/enfileirar', { id: item.id });
    avisar(d.ok ? `${item.titulo} na fila` : d.erro || 'não consegui enfileirar', d.ok);
    if (d.ok) setTimeout(carregarFila, 900);
  }

  function inicioBuscaToque(e, item) {
    buscaConsumida.current = false;
    toqueBusca.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, id: item.id };
  }

  // Arrastar o resultado para a direita enfileira sem trocar o que toca agora.
  function moveBuscaToque(e, item) {
    const t = toqueBusca.current;
    if (!t || t.id !== item.id || t.usado) return;
    const dx = e.touches[0].clientX - t.x;
    const dy = e.touches[0].clientY - t.y;
    if (dx < 0 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 70) {
      t.usado = true;
      buscaConsumida.current = true;
      e.currentTarget.style.transform = '';
      enfileirar(item);
      return;
    }
    e.currentTarget.style.transform = `translateX(${Math.min(dx, 90)}px)`;
  }

  function fimBuscaToque(e) {
    e.currentTarget.style.transform = '';
    toqueBusca.current = null;
  }

  function cliqueResultado(item) {
    // O clique vem depois do touchend; se o arrasto ja enfileirou, ignora.
    if (buscaConsumida.current) {
      buscaConsumida.current = false;
      return;
    }
    tocar(item);
  }

  async function pular(item) {
    if (deslizado >= 0) return setDeslizado(-1);
    navigator.vibrate?.(12);
    const d = await chamar('/api/fila', { indice: item.indice });
    if (d.ok) {
      setTimeout(atualizar, 800);
      setTimeout(carregarFila, 1000);
    } else {
      avisar(d.erro || 'não consegui pular', false);
    }
  }

  async function remover(item) {
    navigator.vibrate?.(16);
    setDeslizado(-1);
    setFila((f) => ({ ...f, itens: f.itens.filter((x) => x.indice !== item.indice) }));
    const d = await chamar(`/api/fila?indice=${item.indice}`, undefined, 'DELETE');
    if (!d.ok) avisar(d.erro || 'não consegui remover', false);
    setTimeout(carregarFila, 600);
  }

  async function limparFila() {
    navigator.vibrate?.(16);
    setDeslizado(-1);
    setFila((f) => ({ ...f, itens: f.atual >= 0 ? f.itens.slice(0, f.atual + 1) : [] }));
    const d = await chamar('/api/fila?tudo=1', undefined, 'DELETE');
    if (!d.ok) avisar(d.erro || 'não consegui limpar', false);
    setTimeout(carregarFila, 600);
  }

  function inicioListaToque(e) {
    if (arrasto) return;
    const t = e.touches[0];
    gestoItem.current = false;
    toqueLista.current = { y: t.clientY, x: t.clientX, topo: lista.current?.scrollTop ?? 0 };
  }

  function fimListaToque(e) {
    if (!toqueLista.current || arrasto) return;
    // Se o gesto foi abrir ou fechar a lixeira de um item, ele ja foi consumido:
    // olhar so o deslizado nao basta, porque o proprio move ja zerou ele.
    if (gestoItem.current) {
      gestoItem.current = false;
      toqueLista.current = null;
      return;
    }
    const t = e.changedTouches[0];
    const dy = t.clientY - toqueLista.current.y;
    const dx = t.clientX - toqueLista.current.x;
    const noTopo = toqueLista.current.topo <= 2;
    toqueLista.current = null;

    const paraBaixo = noTopo && dy > 60 && Math.abs(dy) > Math.abs(dx);
    const paraDireita = deslizado === -1 && dx > 70 && Math.abs(dx) > Math.abs(dy);
    if (paraBaixo || paraDireita) {
      navigator.vibrate?.(10);
      setVista('normal');
    }
  }

  function inicioItemToque(e, item) {
    if (arrastandoFila.current || e.target.closest(`.${styles.pegador}`)) return;
    toqueItem.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, indice: item.indice };
  }

  function moveItemToque(e, item) {
    if (arrastandoFila.current) return;
    if (!toqueItem.current || toqueItem.current.indice !== item.indice) return;
    const dx = e.touches[0].clientX - toqueItem.current.x;
    const dy = e.touches[0].clientY - toqueItem.current.y;
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < -24) {
      gestoItem.current = true;
      setDeslizado(item.indice);
    } else if (dx > 24) {
      // So consome o gesto se havia mesmo uma lixeira aberta para fechar; senao
      // arrastar para a direita continua fechando a fila, como antes.
      if (deslizado !== -1) gestoItem.current = true;
      setDeslizado(-1);
    }
  }

  function inicioArrasto(e, item, posicao) {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    navigator.vibrate?.(14);
    arrastandoFila.current = true;
    toqueItem.current = null;
    setDeslizado(-1);
    const linha = e.currentTarget.closest(`.${styles.linhaFila}`);
    ultimoAlvo.current = posicao;
    setArrasto({
      indice: item.indice,
      posicao,
      y: e.clientY,
      dy: 0,
      altura: linha?.offsetHeight || ALTURA_ITEM,
    });
  }

  function moveArrasto(e) {
    if (!arrasto) return;
    const dy = e.clientY - arrasto.y;
    const alvo = alvoDe({ ...arrasto, dy });
    if (alvo !== ultimoAlvo.current) {
      ultimoAlvo.current = alvo;
      navigator.vibrate?.(8);
    }
    setArrasto((a) => (a ? { ...a, dy } : a));
  }

  async function fimArrasto() {
    arrastandoFila.current = false;
    if (!arrasto) return;
    const alvo = alvoDe(arrasto);
    const origem = arrasto.posicao;
    const de = arrasto.indice;
    setArrasto(null);
    if (alvo === origem) return;
    navigator.vibrate?.(12);
    const para = fila.itens[alvo]?.indice;
    if (para === undefined) return;

    setFila((f) => {
      const itens = [...f.itens];
      const [movido] = itens.splice(origem, 1);
      itens.splice(alvo, 0, movido);
      let atual = f.atual;
      if (f.atual === origem) atual = alvo;
      else if (origem < f.atual && alvo >= f.atual) atual = f.atual - 1;
      else if (origem > f.atual && alvo <= f.atual) atual = f.atual + 1;
      return { ...f, itens, atual };
    });

    const d = await chamar('/api/fila', { de, para }, 'PATCH');
    if (!d.ok) avisar(d.erro || 'não consegui reordenar', false);
    setTimeout(carregarFila, 600);
  }

  function enviarVolume(valor) {
    ultimoVolume.current = valor;
    volumeFixado.current = true;
    setVolume(valor);
    const agora = Date.now();
    if (agora - envioVolume.current < 140) return;
    envioVolume.current = agora;
    chamar('/api/volume', { valor });
  }

  // O arrasto vale em qualquer ponto do menu, inclusive sobre o botao de mudo:
  // se o dedo andou, o clique dele e descartado no fim.
  function inicioSom(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    somArrasto.current = { y: e.clientY, base: volume ?? 0, moveu: false };
  }

  function moveSom(e) {
    if (!somArrasto.current) return;
    e.preventDefault();
    const dy = somArrasto.current.y - e.clientY;
    if (Math.abs(dy) > 4) somArrasto.current.moveu = true;
    const novo = Math.round(Math.min(100, Math.max(0, somArrasto.current.base + (dy / 170) * 100)));
    if (novo !== ultimoVolume.current) enviarVolume(novo);
  }

  function fimSom() {
    if (!somArrasto.current) return;
    const moveu = somArrasto.current.moveu;
    somArrasto.current = null;
    envioVolume.current = 0;
    // Sem movimento nao houve mudanca: mandar ultimoVolume aqui reaplicaria um
    // valor velho por cima do atual.
    if (!moveu) return;
    somMoveu.current = true;
    chamar('/api/volume', { valor: ultimoVolume.current });
  }

  async function instalar() {
    promptPwa.prompt();
    await promptPwa.userChoice;
    setPromptPwa(null);
  }

  const temProgresso = completo && faixa.duracao > 0;
  const classeTocando = [
    styles.painel,
    vista === 'foco' ? styles.modoFoco : '',
    vista === 'fila' ? styles.modoFila : '',
    ondas ? styles.comEqualizador : '',
  ].join(' ');

  return (
    <>
      <div
        className={styles.fundo}
        style={{ '--capa': faixa?.capa ? `url(${faixa.capa})` : 'none' }}
      />
      <div className={styles.veu} />

      <main
        className={styles.tela}
        onWheel={aoRolarLado}
        onTouchStart={inicioToqueTela}
        onTouchEnd={fimToqueTela}
      >
        <header
          className={`${styles.topo} ${vista === 'foco' ? styles.topoOculto : ''} ${
            vista === 'fila' ? styles.topoNaFila : ''
          }`}
        >
          <div className={styles.topoEsquerda}>
            {/* Na busca o volume nao aparece: nada ali depende dele. Deitado no
                modo completo quem manda e o trilho da borda direita. */}
            <div
              className={
                aba === 'busca'
                  ? styles.oculto
                  : `${styles.volumeCaixa} ${completo ? styles.volumeCaixaComTrilho : ''}`
              }
            >
              <button
                className={`${styles.volumeBotao} ${somAberto ? styles.volumeBotaoAtivo : ''}`}
                onClick={() => setSomAberto((v) => !v)}
                aria-label="Volume"
                aria-expanded={somAberto}
              >
                <Icone nome={faixa?.mudo ? 'mudo' : 'som'} tamanho={19} />
              </button>

              {somAberto ? (
                <div
                  className={styles.volumeMenu}
                  onPointerDown={completo ? inicioSom : undefined}
                  onPointerMove={completo ? moveSom : undefined}
                  onPointerUp={completo ? fimSom : undefined}
                  onPointerCancel={completo ? fimSom : undefined}
                >
                  <span className={styles.volumeValor}>{completo ? (volume ?? '—') : '·'}</span>

                  {completo ? (
                    <div className={styles.trilhaVertical}>
                      <input
                        type="range"
                        className={styles.faixaDeslize}
                        style={{ '--pct': `${volume ?? 0}%` }}
                        min={0}
                        max={100}
                        value={volume ?? 0}
                        aria-label="Volume"
                        tabIndex={-1}
                        readOnly
                      />
                    </div>
                  ) : (
                    <div className={styles.passosVertical}>
                      <button onClick={() => comando('volup')} aria-label="Aumentar volume">
                        +
                      </button>
                      <button onClick={() => comando('voldown')} aria-label="Diminuir volume">
                        −
                      </button>
                    </div>
                  )}

                  <button
                    className={`${styles.somBotao} ${faixa?.mudo ? styles.somMudo : ''}`}
                    onClick={() => {
                      if (somMoveu.current) {
                        somMoveu.current = false;
                        return;
                      }
                      comando('mute');
                    }}
                    aria-label="Alternar mudo"
                  >
                    <Icone nome={faixa?.mudo ? 'mudo' : 'som'} tamanho={18} />
                  </button>
                </div>
              ) : null}
            </div>
            <span className={styles.marca}>the player</span>
          </div>
          <div className={styles.topoDireita}>
            <nav className={styles.navTopo}>
              <span
                className={styles.navBolha}
                style={{
                  transform: `translateX(${
                    { deck: 40, busca: 80, config: 120 }[telaAtual()] ?? 0
                  }px)`,
                }}
              />
              <button
                className={telaAtual() === 'tocando' ? styles.navAtivo : undefined}
                onClick={() => irPara('tocando')}
                aria-label="Tocando"
              >
                <Icone nome="onda" tamanho={18} />
              </button>
              <button
                className={telaAtual() === 'deck' ? styles.navAtivo : undefined}
                onClick={() => irPara('deck')}
                aria-label="Atalhos"
              >
                <Icone nome="grade" tamanho={18} />
              </button>
              <button
                className={telaAtual() === 'busca' ? styles.navAtivo : undefined}
                onClick={() => irPara('busca')}
                aria-label="Buscar"
              >
                <Icone nome="busca" tamanho={18} />
              </button>
              <button
                className={telaAtual() === 'config' ? styles.navAtivo : undefined}
                onClick={() => irPara('config')}
                aria-label="Dispositivos"
              >
                <Icone nome="dispositivos" tamanho={18} />
              </button>
            </nav>
          </div>
        </header>

        <section className={aba === 'tocando' ? classeTocando : styles.oculto}>
          <div
            className={styles.conteudo}
            onTouchStart={inicioToque}
            onTouchEnd={fimToque}
            onWheel={aoRolar}
          >
            <div className={styles.palco} onClick={cliqueCapa}>
              {faixa?.capa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.capa} src={faixa.capa} alt="" />
              ) : (
                <div className={styles.capaVazia}>
                  <Icone nome="disco" tamanho={80} />
                </div>
              )}
              {/* O veu que funde a capa no fundo participa do morfo. */}
              {vista === 'foco' ? <div className={styles.veuFoco} aria-hidden /> : null}
            </div>

            {/* Na capa sangrada o cabecalho some; a pill diz como voltar. */}
            {vista === 'foco' ? (
              <div className={styles.dicaVoltar}>
                <span className={styles.setaCima}>
                  <Icone nome="seta" tamanho={14} />
                </span>
                arraste para cima para voltar
              </div>
            ) : null}

            <div className={styles.vidro}>
              <div className={styles.identidade}>
                {/* So aparece deitado, como titulo da coluna de texto. */}
                <div className={styles.rotuloTocando}>tocando agora</div>
                <div className={`${styles.faixa} ${faixa?.titulo ? '' : styles.vazio}`}>
                  {faixa?.titulo || 'Nada tocando'}
                </div>
                <div className={styles.artista}>{faixa?.artista || ''}</div>
              </div>

              {/* Fica entre o texto e a trilha; deitado o order o mantem ali. */}
              {ondas ? <Ondas classe={styles.ondasTopo} tocando={faixa?.tocando} /> : null}

              {temProgresso && (
                <div className={styles.progresso}>
                  <input
                    type="range"
                    className={styles.faixaDeslize}
                    style={{ '--pct': pct(faixa.posicao, faixa.duracao) }}
                    min={0}
                    max={Math.round(faixa.duracao)}
                    value={Math.round(faixa.posicao)}
                    aria-label="Posição da música"
                    onPointerDown={() => {
                      arrastando.current = Date.now();
                    }}
                    onChange={(e) => setFaixa((f) => ({ ...f, posicao: Number(e.target.value) }))}
                    onPointerUp={async (e) => {
                      arrastando.current = 0;
                      await chamar('/api/seek', { segundos: Number(e.currentTarget.value) });
                      setTimeout(atualizar, 300);
                    }}
                    // No iOS o sistema toma o gesto e manda pointercancel no
                    // lugar de pointerup. Sem isto a marca de arrasto ficava
                    // presa e a tela parava de receber atualizacao nenhuma.
                    onPointerCancel={() => {
                      arrastando.current = 0;
                    }}
                    onLostPointerCapture={() => {
                      arrastando.current = 0;
                    }}
                  />
                  <div className={styles.tempos}>
                    <span>{tempo(faixa.posicao)}</span>
                    {/* O lado direito mostra quanto falta, como num player. */}
                    <span>−{tempo(Math.max(0, faixa.duracao - faixa.posicao))}</span>
                  </div>
                </div>
              )}

              <div className={styles.controles}>
                {completo ? (
                  <button
                    className={`${styles.alternar} ${vista === 'fila' ? styles.alternarAtivo : ''}`}
                    onClick={() => setVista((v) => (v === 'fila' ? 'normal' : 'fila'))}
                    aria-label="Fila de reprodução"
                    aria-pressed={vista === 'fila'}
                  >
                    <Icone nome="fila" tamanho={22} />
                  </button>
                ) : (
                  <span className={styles.alternar} />
                )}
                <button
                  className={styles.passo}
                  onClick={() => comando('prev')}
                  aria-label="Faixa anterior"
                >
                  <Icone nome="anterior" tamanho={26} />
                </button>
                <button
                  className={styles.tocar}
                  onClick={() => comando('playpause')}
                  aria-label={faixa?.tocando ? 'Pausar' : 'Tocar'}
                >
                  <Icone nome={faixa?.tocando ? 'pausar' : 'tocar'} tamanho={30} />
                </button>
                <button
                  className={styles.passo}
                  onClick={() => comando('next')}
                  aria-label="Próxima faixa"
                >
                  <Icone nome="proxima" tamanho={26} />
                </button>
                {/* So aparece deitado, separando transporte do equalizador. */}
                <span className={styles.divisor} aria-hidden />
                <button
                  className={`${styles.alternar} ${ondas ? styles.alternarAtivo : ''}`}
                  onClick={() => setOndas((v) => !v)}
                  aria-label="Alternar visualização de ondas"
                  aria-pressed={ondas}
                >
                  <Icone nome="equalizador" tamanho={22} />
                </button>
              </div>


              {/* So aparece deitado, onde sobra espaco embaixo dos botoes. */}
              {aSeguir ? (
                <div className={styles.aSeguir}>
                  <div className={styles.aSeguirTopo}>
                    <span className={styles.aSeguirRotulo}>
                      a seguir{proximos > 1 ? ` · ${proximos}` : ''}
                    </span>
                    <button className={styles.verFila} onClick={() => setVista('fila')}>
                      ver fila
                    </button>
                  </div>
                  <div className={styles.aSeguirCard}>
                    {aSeguir.capa ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={aSeguir.capa} alt="" loading="lazy" />
                    ) : null}
                    <span className={styles.coluna}>
                      <span className={styles.aSeguirFaixa}>{aSeguir.titulo}</span>
                      {aSeguir.artista ? (
                        <span className={styles.aSeguirArtista}>{aSeguir.artista}</span>
                      ) : null}
                    </span>
                    {aSeguir.duracao ? (
                      <span className={styles.duracao}>{aSeguir.duracao}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}

            </div>
          </div>

          <div className={styles.rodapeTocando}>
            {!completo ? (
              <p className={styles.nota}>
                Abra o app desktop do YouTube Music no PC para ter capa, fila e volume exato.
              </p>
            ) : null}
            {faixa?.aviso ? <p className={styles.nota}>{faixa.aviso}</p> : null}
            {promptPwa ? (
              <button className={styles.instalar} onClick={instalar}>
                Instalar na tela de início
              </button>
            ) : null}
          </div>

          {/* Trilho de volume na borda direita: so existe deitado, onde ele
              substitui o menu flutuante. O arrasto reusa a mesma conta do menu. */}
          {completo ? (
            <div
              className={styles.trilhoSom}
              onPointerDown={inicioSom}
              onPointerMove={moveSom}
              onPointerUp={fimSom}
              onPointerCancel={fimSom}
            >
              <div className={styles.trilhoBarra}>
                <div className={styles.trilhoNivel} style={{ height: `${volume ?? 0}%` }} />
              </div>
              <button
                className={`${styles.somBotao} ${faixa?.mudo ? styles.somMudo : ''}`}
                onClick={() => {
                  if (somMoveu.current) {
                    somMoveu.current = false;
                    return;
                  }
                  comando('mute');
                }}
                aria-label="Alternar mudo"
              >
                <Icone nome={faixa?.mudo ? 'mudo' : 'som'} tamanho={17} />
              </button>
            </div>
          ) : null}
        </section>

        <section className={aba === 'busca' ? styles.painelBusca : styles.oculto}>
          <div className={styles.campoLinha}>
            <form className={styles.campo} onSubmit={buscar}>
              <span className={styles.lupa}>
                <Icone nome="busca" tamanho={18} />
              </span>
              <input
                ref={campo}
                type="search"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Música, artista ou álbum"
                enterKeyHint="search"
                autoComplete="off"
              />
              {termo ? (
                <button
                  type="button"
                  className={styles.campoLimpar}
                  onClick={() => {
                    setTermo('');
                    campo.current?.focus();
                  }}
                  aria-label="Limpar busca"
                >
                  <Icone nome="fechar" tamanho={13} />
                </button>
              ) : null}
            </form>
            <button
              className={styles.botaoFilaBusca}
              onClick={() => setVista('fila')}
              aria-label="Fila de reprodução"
            >
              <Icone nome="fila" tamanho={20} />
            </button>
          </div>

          {recentes.length ? (
            <div className={styles.recentes}>
              {recentes.map((r) => (
                <button key={r} className={styles.chip} onClick={() => buscarRecente(r)}>
                  {r}
                </button>
              ))}
            </div>
          ) : null}

          <div className={styles.resultados}>
            {resultados.length ? (
              <div className={styles.melhor}>
                {resultados[0].capa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resultados[0].capa} alt="" loading="lazy" />
                ) : null}
                <span className={styles.coluna}>
                  <span className={styles.melhorRotulo}>melhor resultado</span>
                  <span className={styles.melhorTitulo}>{resultados[0].titulo}</span>
                  <span className={styles.itemSub}>
                    {[resultados[0].artista, resultados[0].duracao].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={styles.melhorBotoes}>
                  <button
                    className={styles.melhorTocar}
                    onClick={() => tocar(resultados[0])}
                    aria-label={`Tocar ${resultados[0].titulo}`}
                  >
                    <Icone nome="tocar" tamanho={20} />
                  </button>
                  <button
                    className={styles.melhorFila}
                    onClick={() => enfileirar(resultados[0])}
                    aria-label={`${resultados[0].titulo} na fila`}
                  >
                    <Icone nome="fila" tamanho={20} />
                  </button>
                </span>
              </div>
            ) : null}

            {resultados.length > 1 ? (
              <div className={styles.secaoBusca}>
                <span className={styles.secaoRotulo}>músicas</span>
                <span className={styles.secaoDica}>toque para tocar · + para a fila</span>
              </div>
            ) : null}

            {resultados.slice(1).map((item) => (
              <div
                key={item.id}
                className={styles.item}
                role="button"
                tabIndex={0}
                onClick={() => cliqueResultado(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    cliqueResultado(item);
                  }
                }}
                onTouchStart={(e) => inicioBuscaToque(e, item)}
                onTouchMove={(e) => moveBuscaToque(e, item)}
                onTouchEnd={fimBuscaToque}
                onTouchCancel={fimBuscaToque}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.capa} alt="" loading="lazy" />
                <span className={styles.coluna}>
                  <span className={styles.itemTitulo}>{item.titulo}</span>
                  <span className={styles.itemSub}>
                    {[item.artista, item.duracao].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <button
                  className={styles.botaoMais}
                  onClick={(e) => {
                    e.stopPropagation();
                    enfileirar(item);
                  }}
                  aria-label={`${item.titulo} na fila`}
                >
                  <Icone nome="mais" tamanho={20} />
                </button>
              </div>
            ))}
          </div>

          {notaBusca ? <p className={styles.nota}>{notaBusca}</p> : null}
        </section>

        <section className={aba === 'deck' ? styles.painelDeck : styles.oculto}>
          <div className={styles.deckTopo}>
            <h2 className={styles.tituloConfig}>Atalhos</h2>
            {appsMac?.length ? (
              <button
                className={styles.limparFila}
                onClick={() => setEditandoDeck((v) => !v)}
              >
                {editandoDeck ? 'pronto' : 'editar'}
              </button>
            ) : null}
          </div>

          {appsMac === null ? <p className={styles.nota}>Procurando apps…</p> : null}

          {appsMac?.length === 0 ? (
            <p className={styles.nota}>
              Os atalhos abrem apps da máquina que está tocando, e isso só vale quando ela é um
              Mac.
            </p>
          ) : null}

          {editandoDeck && appsMac?.length ? (
            <div className={styles.listaApps}>
              {/* As acoes vem primeiro: sao poucas e nao se acham no meio dos apps. */}
              {[
                ...acoesMac.map((a) => ({ item: `acao:${a.id}`, rotulo: a.nome, icone: a.icone })),
                ...appsMac.map((nome) => ({ item: nome, rotulo: nome, icone: nome })),
              ].map(({ item, rotulo, icone }) => {
                const escolhido = deck.includes(item);
                return (
                  <button
                    key={item}
                    className={`${styles.linhaApp} ${escolhido ? styles.linhaAppNoDeck : ''}`}
                    onClick={() =>
                      guardarDeck(escolhido ? deck.filter((x) => x !== item) : [...deck, item])
                    }
                  >
                    <IconeApp nome={icone} />
                    <span className={styles.itemTitulo}>{rotulo}</span>
                    <span className={styles.marcaApp}>
                      <Icone nome={escolhido ? 'menos' : 'mais'} tamanho={18} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {!editandoDeck && deck.length ? (
            <div className={styles.grade}>
              {deck.map((item) => {
                const acao = acaoDe(item);
                return (
                  <button
                    key={item}
                    className={styles.cartaoApp}
                    onClick={() => abrirNoMac(item)}
                  >
                    <IconeApp nome={acao ? acao.icone : item} grande />
                    <span className={styles.nomeApp}>{acao ? acao.nome : item}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {!editandoDeck && !deck.length && appsMac?.length ? (
            <p className={styles.nota}>
              Toque em editar e escolha os apps que você quer abrir daqui.
            </p>
          ) : null}
        </section>

        <section className={aba === 'config' ? styles.painelConfig : styles.oculto}>
          <h2 className={styles.tituloConfig}>Dispositivos</h2>

          {dispositivos === null ? <p className={styles.nota}>Procurando…</p> : null}

          {dispositivos === false ? (
            <p className={styles.nota}>
              A troca de dispositivo só aparece pelo endereço compartilhado. Você abriu esta
              máquina direto, então é ela que está tocando.
            </p>
          ) : null}

          {dispositivos ? (
            <>
              <div className={styles.listaDispositivos}>
                {dispositivos.dispositivos.map((d) => {
                  const atual = d.nome === dispositivos.atual;
                  return (
                    <button
                      key={d.nome}
                      className={`${styles.dispositivo} ${atual ? styles.dispositivoAtual : ''}`}
                      onClick={() => {
                        if (!atual) window.location.href = `/?pc=${d.nome}`;
                      }}
                    >
                      <span
                        className={`${styles.ponto} ${d.online ? styles.pontoNoAr : ''}`}
                        aria-hidden
                      />
                      <span className={styles.coluna}>
                        <span className={styles.itemTitulo}>{d.nome}</span>
                        <span className={styles.itemSub}>
                          {d.online ? 'no ar' : 'fora do ar'}
                          {d.nome === dispositivos.padrao ? ' · padrão' : ''}
                        </span>
                      </span>
                      {atual ? <span className={styles.selo}>atual</span> : null}
                    </button>
                  );
                })}
              </div>
              <p className={styles.nota}>
                Para acrescentar ou tirar uma máquina, mexa nas variáveis ALVO_ em
                worker/wrangler.toml e publique o Worker de novo.
              </p>
            </>
          ) : null}
        </section>

      </main>

      {/* Toast unico para qualquer aviso - enfileirar, comandos, erros - em
          qualquer tela, ja que o rodape so existe no tocando. */}
      {estado ? (
        <div
          className={`${styles.toast} ${estado.ok ? styles.toastOk : styles.toastErro}`}
          role="status"
        >
          {estado.texto}
        </div>
      ) : null}

      {somAberto ? (
        <div className={styles.cortinaSom} onClick={() => setSomAberto(false)} />
      ) : null}

      <div
        className={`${styles.cortina} ${vista === 'fila' ? styles.cortinaVisivel : ''}`}
        onClick={() => setVista('normal')}
      />

      <aside className={`${styles.gaveta} ${vista === 'fila' ? styles.gavetaAberta : ''}`}>
        <header
          className={styles.gavetaTopo}
          onTouchStart={inicioListaToque}
          onTouchEnd={fimListaToque}
        >
          <div className={styles.gavetaLinha}>
            <span className={styles.gavetaTitulo}>
              A seguir
              {proximos ? <span className={styles.contador}>{proximos}</span> : null}
            </span>
            <span className={styles.gavetaAcoes}>
              {proximos ? (
                <button className={styles.limparFila} onClick={limparFila}>
                  limpar
                </button>
              ) : null}
              <button
                className={styles.gavetaFechar}
                onClick={() => setVista('normal')}
                aria-label="Fechar fila"
              >
                <Icone nome="fechar" tamanho={18} />
              </button>
            </span>
          </div>
        </header>

        {naFila ? (
          <div className={styles.cardTocando}>
            <div className={styles.cardTocandoLinha}>
              {naFila.capa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={naFila.capa} alt="" loading="lazy" />
              ) : null}
              <span className={styles.coluna}>
                <span className={styles.cardRotulo}>tocando agora</span>
                <span className={styles.itemTitulo}>{naFila.titulo}</span>
                <span className={styles.itemSub}>{naFila.artista}</span>
              </span>
              <span className={styles.barrasMini} aria-hidden>
                <i style={{ animationPlayState: faixa?.tocando ? 'running' : 'paused' }} />
                <i style={{ animationPlayState: faixa?.tocando ? 'running' : 'paused' }} />
                <i style={{ animationPlayState: faixa?.tocando ? 'running' : 'paused' }} />
              </span>
            </div>
            {temProgresso ? (
              <div className={styles.cardProgresso}>
                <div style={{ width: pct(faixa.posicao, faixa.duracao) }} />
              </div>
            ) : null}
          </div>
        ) : null}

        {proximos ? (
          <p className={styles.instrucao}>
            arraste a alça para reordenar · deslize para a esquerda para remover
          </p>
        ) : null}

        <div
          className={styles.gavetaLista}
          ref={lista}
          onTouchStart={inicioListaToque}
          onTouchEnd={fimListaToque}
          onWheel={(e) => {
            if ((lista.current?.scrollTop ?? 0) <= 2 && e.deltaY < 0) aoRolar(e);
          }}
        >
          {fila.erro ? <p className={styles.nota}>{fila.erro}</p> : null}
          {!fila.erro && !proximos ? <p className={styles.nota}>Fila vazia.</p> : null}
          {/* O tocando agora vive no card fixo; a lista e so o que vem depois.
              O indice absoluto continua valendo para arrasto e API. */}
          {(fila.atual >= 0 ? fila.itens.slice(fila.atual + 1) : fila.itens).map((item, rel) => {
            const i = (fila.atual >= 0 ? fila.atual + 1 : 0) + rel;
            const arrastandoEste = arrasto?.indice === item.indice;
            let deslocamento = 0;
            if (arrasto && !arrastandoEste) {
              const alvo = alvoDe(arrasto);
              const origem = arrasto.posicao;
              if (alvo > origem && i > origem && i <= alvo) deslocamento = -arrasto.altura;
              else if (alvo < origem && i < origem && i >= alvo) deslocamento = arrasto.altura;
            }
            return (
              <div
                key={`${item.id}-${item.indice}`}
                className={`${styles.linhaFila} ${arrastandoEste ? styles.linhaArrastando : ''} ${
                  deslocamento ? styles.linhaAbrindo : ''
                }`}
                style={
                  arrastandoEste
                    ? { transform: `translateY(${arrasto.dy}px)` }
                    : deslocamento
                      ? { transform: `translateY(${deslocamento}px)` }
                      : undefined
                }
              >
                {deslizado === item.indice ? (
                  <button
                    className={styles.botaoLixeira}
                    onClick={() => remover(item)}
                    aria-label={`Remover ${item.titulo} da fila`}
                  >
                    <Icone nome="lixeira" tamanho={20} />
                  </button>
                ) : null}

                <div
                  className={`${styles.deslizavel} ${
                    deslizado === item.indice ? styles.deslizado : ''
                  }`}
                  onTouchStart={(e) => inicioItemToque(e, item)}
                  onTouchMove={(e) => moveItemToque(e, item)}
                >
                  <button className={styles.item} onClick={() => pular(item)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.capa} alt="" loading="lazy" />
                    <span className={styles.coluna}>
                      <span className={styles.itemTitulo}>{item.titulo}</span>
                      <span className={styles.itemSub}>
                        {[item.artista, item.duracao].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>

                  <span
                    className={styles.pegador}
                    onPointerDown={(e) => inicioArrasto(e, item, i)}
                    onPointerMove={moveArrasto}
                    onPointerUp={fimArrasto}
                    onPointerCancel={fimArrasto}
                    role="button"
                    aria-label={`Reordenar ${item.titulo}`}
                  >
                    <Icone nome="pegar" tamanho={18} />
                  </span>

                  <button
                    className={styles.removerDireto}
                    onClick={(e) => {
                      e.stopPropagation();
                      remover(item);
                    }}
                    aria-label={`Remover ${item.titulo} da fila`}
                  >
                    <Icone nome="lixeira" tamanho={17} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
