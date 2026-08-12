# Controle do YouTube Music

Controle pelo celular a música que toca no PC. O servidor roda na sua máquina e o
celular abre uma página web na mesma rede — play/pause, faixa anterior e próxima,
volume, barra de progresso, capa do álbum e busca no catálogo do YouTube Music.

Funciona no Windows, macOS e Linux.

## Como funciona

O servidor roda **no PC que toca a música** e fala com o player de duas formas:

**Modo completo (recomendado)** — o app desktop [pear-desktop](https://github.com/pear-devs/pear-desktop)
(antigo `th-ch/youtube-music`) expõe uma API local. Você tem volume exato, barra de
progresso arrastável, capa do álbum e a música escolhida entra direto na fila.

**Modo básico** — o YouTube Music aberto no navegador, controlado pelas teclas de
mídia do sistema. Play/pause, anterior e próxima funcionam; o volume vira o do
sistema, não há barra de progresso nem capa, e escolher uma música abre uma aba nova.

O servidor detecta sozinho qual está disponível e mostra o modo ativo na tela do celular.

---

## Instalação no Windows

### 1. Instale o Node.js

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

Feche e reabra o terminal para o PATH atualizar. Confira com `node -v`.

### 2. Instale o app desktop do YouTube Music

```powershell
winget install --id th-ch.YouTubeMusic -e
```

Abra o app uma vez e faça login na sua conta.

### 3. Ligue o plugin API Server

No app, vá em **Plugins → API Server** e ative. Em **Auth Strategy**, escolha **None**
(sem isso o controle recebe 401 e cai no modo básico).

Se preferir editar o arquivo, ele fica em `%APPDATA%\YouTube Music\config.json`:

```json
"plugins": {
  "api-server": {
    "enabled": true,
    "hostname": "127.0.0.1",
    "port": 26538,
    "authStrategy": "NONE"
  }
}
```

Feche o app completamente antes de editar — ele reescreve o arquivo ao sair.

### 4. Rode o projeto

```powershell
npm install
npm run build
npm start
```

O servidor sobe em `0.0.0.0:8765`. Na primeira execução o Windows pode pedir para
liberar o firewall — aceite para **redes privadas**.

Se a sua rede estiver classificada como pública, libere a porta manualmente num
PowerShell **como administrador**:

```powershell
New-NetFirewallRule -DisplayName "Controle YTM 8765" -Direction Inbound `
  -Protocol TCP -LocalPort 8765 -Action Allow -RemoteAddress LocalSubnet
```

### 5. Abra no celular

```powershell
npm run endereco
```

Mostra o endereço, algo como `http://192.168.1.47:8765`. Digite no navegador do
celular, que precisa estar na mesma rede.

Para não repetir os comandos, dê dois cliques em `iniciar.cmd` — ele mostra o
endereço e sobe o servidor.

---

## Instalação no macOS

### 1. Instale o Node.js

```bash
brew install node
```

### 2. Instale o app desktop do YouTube Music

```bash
brew install --cask th-ch/youtube-music/youtube-music
```

O app não está no cask oficial do Homebrew porque não é assinado, então o comando
usa o tap do próprio projeto.

Abra o app uma vez e faça login. Como ele não é assinado pela Apple, na primeira
tentativa o macOS bloqueia: vá em **Ajustes do Sistema → Privacidade e Segurança**
e clique em **Abrir Assim Mesmo**.

### 3. Ligue o plugin API Server

No app, **Plugins → API Server**, e em **Auth Strategy** escolha **None**.

O arquivo de configuração fica em
`~/Library/Application Support/YouTube Music/config.json`.

### 4. Rode o projeto

```bash
npm install
npm run build
npm start
```

Na primeira execução o macOS pergunta se o Node pode aceitar conexões de entrada —
aceite.

### 5. Abra no celular

```bash
npm run endereco
```

### Modo básico no macOS

Se preferir usar o YouTube Music no navegador em vez do app desktop, instale:

```bash
brew install nowplaying-cli
```

Sem isso, o nome da faixa não aparece e os controles não funcionam nesse modo.
No Linux o equivalente é `sudo apt install playerctl`.

---

## Instalar como app no celular

**iPhone** — no Safari, Compartilhar → Adicionar à Tela de Início.

**Android** — o Chrome só instala PWA em contexto seguro, e aqui é HTTP num IP
local. Duas saídas:

- Abra `chrome://flags/#unsafely-treat-insecure-origin-as-secure` no celular,
  cadastre o endereço do servidor e reinicie o navegador.
- Ou coloque atrás de um túnel com HTTPS válido (veja abaixo).

## Acessar de fora de casa

O servidor precisa continuar rodando no seu PC. **Hospedar em Vercel, Netlify ou
qualquer nuvem não funciona**: as rotas da API falam com o player em `127.0.0.1`,
que na nuvem é a máquina do provedor, não a sua. Lá só a busca funcionaria.

A solução é um túnel, que mantém o servidor na sua máquina e expõe um endereço
público. O agente abre uma conexão de saída, então não é preciso abrir portas no
roteador.

### Cloudflare Tunnel

Requer um domínio com DNS na Cloudflare. Você ganha HTTPS válido, o que também
libera instalar o PWA no Android.

Baixe o `cloudflared` ([releases](https://github.com/cloudflare/cloudflared/releases)),
ou no Windows:

```powershell
winget install --id Cloudflare.cloudflared -e
```

No macOS:

```bash
brew install cloudflared
```

Autorize e crie o túnel:

```bash
cloudflared tunnel login
cloudflared tunnel create remoteplayer
```

Crie o `config.yml` em `~/.cloudflared/` (no Windows, `C:\Users\SEU_USUARIO\.cloudflared\`),
trocando o ID pelo que o comando anterior imprimiu:

```yaml
tunnel: SEU_TUNNEL_ID
credentials-file: /caminho/para/SEU_TUNNEL_ID.json

ingress:
  - hostname: seu-subdominio.seu-dominio.com
    service: http://localhost:8765
  - service: http_status:404
```

Aponte o DNS e suba o túnel:

```bash
cloudflared tunnel route dns remoteplayer seu-subdominio.seu-dominio.com
cloudflared tunnel run remoteplayer
```

Use `--overwrite-dns` no comando de rota se o subdomínio já apontar para outro lugar.

**Proteja o acesso.** Sem autenticação, qualquer pessoa que descobrir o endereço
controla o som do seu PC. O Cloudflare Access resolve de graça: no painel Zero Trust,
crie uma aplicação self-hosted para o subdomínio e uma política que só aceite o seu
e-mail.

### Tailscale

Alternativa sem domínio próprio: `tailscale serve --bg 8765` cria uma rede privada
entre seus aparelhos, sem expor nada na internet.

## Subir junto com o sistema

### Windows

Os scripts `iniciar.cmd` (com janela) e `iniciar-silencioso.vbs` (sem janela) sobem
o servidor e o túnel juntos. Ambos usam o nome de túnel `remoteplayer` — troque se
tiver usado outro.

Para iniciar no login, coloque um atalho do `iniciar-silencioso.vbs` na pasta de
Inicialização:

```powershell
explorer shell:startup
```

### macOS

Use o `iniciar.sh`, passando o nome do túnel se tiver um:

```bash
chmod +x iniciar.sh
TUNEL=mac ./iniciar.sh
```

Para subir no login, instale o túnel como serviço e crie um LaunchAgent para o
servidor:

```bash
sudo cloudflared service install
```

## Rodar em mais de um computador

Cada máquina roda seu próprio servidor e precisa do seu próprio túnel, porque um
túnel entrega para uma máquina só. Use um subdomínio por computador:

```bash
cloudflared tunnel create mac
cloudflared tunnel route dns mac mac.seu-dominio.com
```

Aponte o `config.yml` do Mac para `http://localhost:8765` dele e pronto: cada
endereço controla o player da máquina correspondente, e os dois podem ficar no ar
ao mesmo tempo.

## Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `PORT` | Porta do servidor (padrão `8765`) |
| `YTMD_TOKEN` | Token do API Server, se você manteve a autenticação ligada |

## Estrutura

```
app/
  page.jsx              interface
  pagina.module.css     estilos
  api/now/              faixa atual e modo ativo
  api/cmd/[acao]/       playpause, next, prev, volup, voldown, mute
  api/volume/           volume absoluto (modo completo)
  api/seek/             posição na faixa (modo completo)
  api/search/           busca no catálogo
  api/play/             toca a música escolhida
lib/
  media.js              detecção e implementação dos dois modos
  search.js             busca via ytmusic-api, com cache
public/                 manifest, service worker e ícones
```

## Problemas comuns

**O celular não abre o endereço** — confira que ele está no Wi-Fi da casa e não nos
dados móveis. Redes de convidados isolam os aparelhos e não funcionam. No Windows,
confira o firewall (passo 4).

**Aparece "Teclas de mídia" em vez de "App desktop"** — o plugin API Server não está
respondendo. Confira que o app desktop está aberto e que o Auth Strategy é **None**.

**O volume do slider não bate com o número** — o YouTube Music aplica uma curva de
resposta própria, então o valor lido difere do enviado. O slider mostra o que você
definiu.

**O endereço mudou** — o IP é atribuído pelo roteador e pode trocar ao reiniciar.
Rode `npm run endereco` de novo, ou fixe o IP nas configurações do roteador.
