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
  const arrastando = useRef(false);
  const volumeFixado = useRef(false);
  const toque = useRef(null);
  const toqueLista = useRef(null);
  const toqueItem = useRef(null);
  const timer = useRef(null);
  const campo = useRef(null);
  const lista = useRef(null);

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

  function inicioToque(e) {
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
    navigator.vibrate?.(10);
    if (dy < 0) setVista((v) => (v === 'foco' ? 'normal' : 'fila'));
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
    if (noTopo && dy > 60 && Math.abs(dy) > Math.abs(dx)) {
      navigator.vibrate?.(10);
      setVista('normal');
    }
  }

  function inicioItemToque(e, item) {
    toqueItem.current = { x: e.touches[0].clientX, indice: item.indice, moveu: false };
  }

  function moveItemToque(e, item) {
    if (!toqueItem.current || toqueItem.current.indice !== item.indice) return;
    const dx = e.touches[0].clientX - toqueItem.current.x;
    if (dx < -20) {
      toqueItem.current.moveu = true;
      setDeslizado(item.indice);
    } else if (dx > 20) {
      toqueItem.current.moveu = true;
      setDeslizado(-1);
    }
  }

  function inicioArrasto(e, item, posicao) {
    e.stopPropagation();
    navigator.vibrate?.(14);
    setDeslizado(-1);
    setArrasto({ indice: item.indice, posicao, y: e.touches[0].clientY, dy: 0 });
  }

  function moveArrasto(e) {
    if (!arrasto) return;
    e.preventDefault();
    setArrasto((a) => (a ? { ...a, dy: e.touches[0].clientY - a.y } : a));
  }

  async function fimArrasto() {
    if (!arrasto) return;
    const passos = Math.round(arrasto.dy / ALTURA_ITEM);
    const alvo = Math.min(fila.itens.length - 1, Math.max(0, arrasto.posicao + passos));
    const de = arrasto.indice;
    setArrasto(null);
    if (!passos || alvo === arrasto.posicao) return;
    navigator.vibrate?.(12);
    const para = fila.itens[alvo]?.indice;
    if (para === undefined) return;
    const d = await chamar('/api/fila', { de, para }, 'PATCH');
    if (!d.ok) avisar(d.erro || 'não consegui reordenar', false);
    setTimeout(carregarFila, 500);
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

      <main className={styles.tela}>
        <header className={`${styles.topo} ${vista === 'foco' ? styles.topoOculto : ''}`}>
          <span className={styles.marca}>Controle</span>
          <div className={styles.topoDireita}>
            <span className={styles.selo}>
              <span className={`${styles.ponto} ${faixa?.tocando ? styles.pontoVivo : ''}`} />
              {completo ? 'App desktop' : 'Teclas de mídia'}
            </span>
            <nav className={styles.navTopo}>
              <button
                className={aba === 'tocando' ? styles.navAtivo : undefined}
                onClick={() => setAba('tocando')}
                aria-label="Tocando"
              >
                <Icone nome="onda" tamanho={18} />
              </button>
              <button
                className={aba === 'busca' ? styles.navAtivo : undefined}
                onClick={() => {
                  setAba('busca');
                  setTimeout(() => campo.current?.focus(), 80);
                }}
                aria-label="Buscar"
              >
                <Icone nome="busca" tamanho={18} />
              </button>
              {completo ? (
                <button
                  className={vista === 'fila' ? styles.navAtivo : undefined}
                  onClick={() => setVista((v) => (v === 'fila' ? 'normal' : 'fila'))}
                  aria-label="Fila"
                >
                  <Icone nome="fila" tamanho={18} />
                </button>
              ) : null}
            </nav>
          </div>
        </header>

        <section className={aba === 'tocando' ? classeTocando : styles.oculto}>
          <div className={styles.conteudo} onTouchStart={inicioToque} onTouchEnd={fimToque}>
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

              {completo ? (
                <button className={styles.puxador} onClick={() => setVista('fila')}>
                  <Icone nome="fila" tamanho={16} />
                  Fila
                </button>
              ) : null}
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

      <div
        className={`${styles.cortina} ${vista === 'fila' ? styles.cortinaVisivel : ''}`}
        onClick={() => setVista('normal')}
      />

      <aside className={`${styles.gaveta} ${vista === 'fila' ? styles.gavetaAberta : ''}`}>
        <header
          className={styles.gavetaTopo}
          onTouchStart={inicioToque}
          onTouchEnd={fimToque}
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
        >
          {fila.erro ? <p className={styles.nota}>{fila.erro}</p> : null}
          {!fila.erro && !fila.itens.length ? <p className={styles.nota}>Fila vazia.</p> : null}
          {fila.itens.map((item, i) => {
            const arrastandoEste = arrasto?.indice === item.indice;
            return (
              <div
                key={`${item.id}-${item.indice}`}
                className={`${styles.linhaFila} ${arrastandoEste ? styles.linhaArrastando : ''}`}
                style={arrastandoEste ? { transform: `translateY(${arrasto.dy}px)` } : undefined}
              >
                <button
                  className={styles.botaoLixeira}
                  onClick={() => remover(item)}
                  aria-label={`Remover ${item.titulo} da fila`}
                  tabIndex={deslizado === item.indice ? 0 : -1}
                >
                  <Icone nome="lixeira" tamanho={20} />
                </button>

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
                    onTouchStart={(e) => inicioArrasto(e, item, i)}
                    onTouchMove={moveArrasto}
                    onTouchEnd={fimArrasto}
                    role="button"
                    aria-label={`Reordenar ${item.titulo}`}
                  >
                    <Icone nome="pegar" tamanho={18} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
