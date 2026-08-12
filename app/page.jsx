'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
    fechar: <path d="M6 6l12 12M18 6L6 18" />,
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

const BARRAS = Array.from({ length: 32 }, (_, i) => {
  const centro = 1 - Math.abs(i - 15.5) / 15.5;
  return {
    altura: 22 + centro * 58 + ((i * 37) % 19),
    duracao: 0.62 + ((i * 13) % 9) / 10,
    atraso: ((i * 29) % 17) / 20,
  };
});

function Ondas({ classe, tocando }) {
  return (
    <div className={classe} aria-hidden>
      {BARRAS.map((b, i) => (
        <span
          key={i}
          style={{
            '--alt': `${b.altura}%`,
            animationDuration: `${b.duracao}s`,
            animationDelay: `${b.atraso}s`,
            animationPlayState: tocando ? 'running' : 'paused',
          }}
        />
      ))}
    </div>
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

const ALTURA_ITEM = 68;

export default function Pagina() {
  const [aba, setAba] = useState('tocando');
  const [vista, setVista] = useState('normal');
  const [faixa, setFaixa] = useState(null);
  const [estado, setEstado] = useState(null);
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [notaBusca, setNotaBusca] = useState('');
  const [promptPwa, setPromptPwa] = useState(null);
  const [volume, setVolume] = useState(null);
  const [fila, setFila] = useState({ itens: [], atual: -1, erro: '' });
  const [deslizado, setDeslizado] = useState(-1);
  const [arrasto, setArrasto] = useState(null);
  const [ondas, setOndas] = useState(false);
  const arrastando = useRef(false);
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

  const alvoDe = useCallback(
    (a) =>
      Math.min(
        fila.itens.length - 1,
        Math.max(0, a.posicao + Math.round(a.dy / (a.altura || ALTURA_ITEM))),
      ),
    [fila.itens.length],
  );

  const completo = !!faixa?.completo;

  const avisar = useCallback((texto, ok) => {
    setEstado({ texto, ok });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setEstado(null), 2600);
  }, []);

  const atualizar = useCallback(async () => {
    const d = await chamar('/api/now');
    if (d.offline) return;
    if (!arrastando.current) setFaixa(d);
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
    if (e.target.closest('input[type=range]')) return (toqueTela.current = null);
    const t = e.touches[0];
    toqueTela.current = { x: t.clientX, y: t.clientY };
  }

  function fimToqueTela(e) {
    if (!toqueTela.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - toqueTela.current.x;
    const dy = t.clientY - toqueTela.current.y;
    toqueTela.current = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    gestou.current = Date.now();
    navigator.vibrate?.(10);
    navegar(dx < 0 ? 1 : -1);
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
    if (dy < 0) setVista((v) => (v === 'foco' ? 'normal' : 'fila'));
    else setVista((v) => (v === 'fila' ? 'normal' : 'foco'));
  }

  function cliqueCapa() {
    if (Date.now() - gestou.current < 600) return;
    setVista((v) => (v === 'foco' ? 'normal' : 'foco'));
  }

  const TELAS = ['tocando', 'busca'];

  function irPara(nome) {
    if (nome === 'busca') {
      setVista('normal');
      setAba('busca');
      setTimeout(() => campo.current?.focus(), 80);
      return;
    }
    setAba('tocando');
    setVista(nome === 'fila' ? 'fila' : 'normal');
  }

  function telaAtual() {
    if (aba === 'busca') return 'busca';
    return vista === 'fila' ? 'fila' : 'tocando';
  }

  function navegar(passo) {
    if (vista === 'fila') return setVista('normal');
    const base = aba === 'busca' ? 'busca' : 'tocando';
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
    if (paraBaixo) setVista((v) => (v === 'foco' ? 'normal' : 'fila'));
    else setVista((v) => (v === 'fila' ? 'normal' : 'foco'));
  }

  async function comando(acao) {
    navigator.vibrate?.(12);
    const d = await chamar(`/api/cmd/${acao}`, {});
    avisar(d.ok ? 'enviado' : d.erro || 'não enviado', d.ok);
    setTimeout(atualizar, 350);
  }

  async function buscar(e) {
    e?.preventDefault();
    if (!termo.trim()) return;
    campo.current?.blur();
    setNotaBusca('Buscando...');
    setResultados([]);
    const d = await chamar(`/api/search?q=${encodeURIComponent(termo)}`);
    if (d.erro) return setNotaBusca(d.erro);
    if (!d.itens?.length) return setNotaBusca('Nada encontrado para esse termo.');
    setResultados(d.itens);
    setNotaBusca('');
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

  function inicioListaToque(e) {
    if (arrasto) return;
    const t = e.touches[0];
    toqueLista.current = { y: t.clientY, x: t.clientX, topo: lista.current?.scrollTop ?? 0 };
  }

  function fimListaToque(e) {
    if (!toqueLista.current || arrasto) return;
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
    if (dx < -24) setDeslizado(item.indice);
    else if (dx > 24) setDeslizado(-1);
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
        <header className={`${styles.topo} ${vista === 'foco' ? styles.topoOculto : ''}`}>
          <span className={styles.marca}>the player</span>
          <div className={styles.topoDireita}>
            <nav className={styles.navTopo}>
              <span
                className={styles.navBolha}
                style={{ transform: `translateX(${telaAtual() === 'busca' ? 40 : 0}px)` }}
              />
              <button
                className={telaAtual() === 'tocando' ? styles.navAtivo : undefined}
                onClick={() => irPara('tocando')}
                aria-label="Tocando"
              >
                <Icone nome="onda" tamanho={18} />
              </button>
              <button
                className={telaAtual() === 'busca' ? styles.navAtivo : undefined}
                onClick={() => irPara('busca')}
                aria-label="Buscar"
              >
                <Icone nome="busca" tamanho={18} />
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
            <div
              className={`${styles.palco} ${ondas ? styles.comOndas : ''}`}
              onClick={cliqueCapa}
            >
              {faixa?.capa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.capa} src={faixa.capa} alt="" />
              ) : (
                <div className={styles.capaVazia}>
                  <Icone nome="disco" tamanho={80} />
                </div>
              )}
              {ondas ? <Ondas classe={styles.ondasPalco} tocando={faixa?.tocando} /> : null}
            </div>

            <div className={styles.vidro}>
              {ondas ? <Ondas classe={styles.ondasTopo} tocando={faixa?.tocando} /> : null}

              <div className={styles.identidade}>
                <div className={`${styles.faixa} ${faixa?.titulo ? '' : styles.vazio}`}>
                  {faixa?.titulo || 'Nada tocando'}
                </div>
                <div className={styles.artista}>{faixa?.artista || ''}</div>
              </div>

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
                      arrastando.current = true;
                    }}
                    onChange={(e) => setFaixa((f) => ({ ...f, posicao: Number(e.target.value) }))}
                    onPointerUp={async (e) => {
                      arrastando.current = false;
                      await chamar('/api/seek', { segundos: Number(e.currentTarget.value) });
                      setTimeout(atualizar, 300);
                    }}
                  />
                  <div className={styles.tempos}>
                    <span>{tempo(faixa.posicao)}</span>
                    <span>{tempo(faixa.duracao)}</span>
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
                  <Icone nome={faixa?.tocando ? 'pausar' : 'tocar'} tamanho={28} />
                </button>
                <button
                  className={styles.passo}
                  onClick={() => comando('next')}
                  aria-label="Próxima faixa"
                >
                  <Icone nome="proxima" tamanho={26} />
                </button>
                <button
                  className={`${styles.alternar} ${ondas ? styles.alternarAtivo : ''}`}
                  onClick={() => setOndas((v) => !v)}
                  aria-label="Alternar visualização de ondas"
                  aria-pressed={ondas}
                >
                  <Icone nome="equalizador" tamanho={22} />
                </button>
              </div>

              <div className={styles.som}>
                <button
                  className={`${styles.somBotao} ${faixa?.mudo ? styles.somMudo : ''}`}
                  onClick={() => comando('mute')}
                  aria-label="Alternar mudo"
                >
                  <Icone nome={faixa?.mudo ? 'mudo' : 'som'} tamanho={20} />
                </button>

                {completo ? (
                  <>
                    <input
                      type="range"
                      className={styles.faixaDeslize}
                      style={{ '--pct': `${volume ?? 0}%`, flex: 1, minWidth: 0 }}
                      min={0}
                      max={100}
                      value={volume ?? 0}
                      aria-label="Volume"
                      onChange={(e) => {
                        volumeFixado.current = true;
                        setVolume(Number(e.target.value));
                      }}
                      onPointerUp={(e) =>
                        chamar('/api/volume', { valor: Number(e.currentTarget.value) })
                      }
                      onKeyUp={(e) =>
                        chamar('/api/volume', { valor: Number(e.currentTarget.value) })
                      }
                    />
                    <span className={styles.somValor}>{volume ?? '—'}</span>
                  </>
                ) : (
                  <div className={styles.passos}>
                    <button onClick={() => comando('voldown')}>Menos</button>
                    <button onClick={() => comando('volup')}>Mais</button>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className={styles.rodapeTocando}>
            <div
              className={`${styles.estado} ${estado ? (estado.ok ? styles.ok : styles.erro) : ''}`}
            >
              {estado?.texto || ''}
            </div>
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
        </section>

        <section className={aba === 'busca' ? styles.painelBusca : styles.oculto}>
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
          </form>

          <div className={styles.resultados}>
            {resultados.map((item) => (
              <button key={item.id} className={styles.item} onClick={() => tocar(item)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.capa} alt="" loading="lazy" />
                <span className={styles.coluna}>
                  <span className={styles.itemTitulo}>{item.titulo}</span>
                  <span className={styles.itemSub}>
                    {[item.artista, item.album].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={styles.duracao}>{item.duracao}</span>
              </button>
            ))}
          </div>

          {notaBusca ? <p className={styles.nota}>{notaBusca}</p> : null}
        </section>

      </main>

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
          <span className={styles.puxadorBarra} />
          <div className={styles.gavetaLinha}>
            <span className={styles.gavetaTitulo}>
              A seguir
              {fila.itens.length ? <span className={styles.contador}>{fila.itens.length}</span> : null}
            </span>
            <button
              className={styles.somBotao}
              onClick={() => setVista('normal')}
              aria-label="Fechar fila"
            >
              <Icone nome="fechar" tamanho={18} />
            </button>
          </div>
        </header>

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
          {!fila.erro && !fila.itens.length ? <p className={styles.nota}>Fila vazia.</p> : null}
          {fila.itens.map((item, i) => {
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
                  <button
                    className={`${styles.item} ${i === fila.atual ? styles.itemAtual : ''}`}
                    onClick={() => pular(item)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.capa} alt="" loading="lazy" />
                    <span className={styles.coluna}>
                      <span className={styles.itemTitulo}>{item.titulo}</span>
                      <span className={styles.itemSub}>{item.artista}</span>
                    </span>
                    {i === fila.atual ? (
                      <span className={styles.tocandoAgora}>
                        <Icone nome="onda" tamanho={16} />
                      </span>
                    ) : (
                      <span className={styles.duracao}>{item.duracao}</span>
                    )}
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
