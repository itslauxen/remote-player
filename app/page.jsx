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
    onda: (
      <>
        <path d="M3 12h2l2.5-7 4 18 3.5-13 2 6h4" />
      </>
    ),
  };
  return <svg {...comum}>{desenhos[nome]}</svg>;
}

async function chamar(url, corpo) {
  try {
    const r = await fetch(url, {
      method: corpo === undefined ? 'GET' : 'POST',
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      cache: 'no-store',
    });
    return await r.json();
  } catch {
    return { ok: false, erro: 'sem conexão com o PC', offline: true };
  }
}

export default function Pagina() {
  const [aba, setAba] = useState('tocando');
  const [faixa, setFaixa] = useState(null);
  const [estado, setEstado] = useState(null);
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [notaBusca, setNotaBusca] = useState('');
  const [promptPwa, setPromptPwa] = useState(null);
  const [volume, setVolume] = useState(null);
  const arrastando = useRef(false);
  const volumeFixado = useRef(false);
  const timer = useRef(null);
  const campo = useRef(null);

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

  async function instalar() {
    promptPwa.prompt();
    await promptPwa.userChoice;
    setPromptPwa(null);
  }

  const temProgresso = completo && faixa.duracao > 0;

  return (
    <>
      <div className={styles.fundo} style={{ '--capa': faixa?.capa ? `url(${faixa.capa})` : 'none' }} />
      <div className={styles.veu} />

      <main className={styles.tela}>
        <section className={aba === 'tocando' ? styles.painel : styles.oculto}>
          <header className={styles.topo}>
            <span className={styles.marca}>Controle</span>
            <span className={styles.selo}>
              <span className={`${styles.ponto} ${faixa?.tocando ? styles.pontoVivo : ''}`} />
              {completo ? 'App desktop' : 'Teclas de mídia'}
            </span>
          </header>

          <div className={styles.palco}>
            {faixa?.capa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.capa} src={faixa.capa} alt="" />
            ) : (
              <div className={styles.capaVazia}>
                <Icone nome="disco" tamanho={80} />
              </div>
            )}
          </div>

          <div className={styles.vidro}>
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
                    onKeyUp={(e) => chamar('/api/volume', { valor: Number(e.currentTarget.value) })}
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

          <div className={styles.rodapeTocando}>
            <div
              className={`${styles.estado} ${estado ? (estado.ok ? styles.ok : styles.erro) : ''}`}
            >
              {estado?.texto || ''}
            </div>
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

        <nav className={styles.abas}>
          <button
            className={aba === 'tocando' ? styles.abaAtiva : undefined}
            onClick={() => setAba('tocando')}
          >
            <Icone nome="onda" tamanho={20} />
            Tocando
          </button>
          <button
            className={aba === 'busca' ? styles.abaAtiva : undefined}
            onClick={() => {
              setAba('busca');
              setTimeout(() => campo.current?.focus(), 80);
            }}
          >
            <Icone nome="busca" tamanho={20} />
            Buscar
          </button>
        </nav>
      </main>
    </>
  );
}
