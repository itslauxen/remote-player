#!/usr/bin/env bash
# Instalacao guiada no macOS: dependencias, app desktop e plugin API Server.
set -euo pipefail
cd "$(dirname "$0")"

REPO_APP="pear-devs/pear-desktop"
APP="/Applications/YouTube Music.app"
CONFIG="$HOME/Library/Application Support/YouTube Music/config.json"
SIM=0
[ "${1:-}" = "-y" ] || [ "${1:-}" = "--sim" ] && SIM=1

passo() { echo; echo "==> $1"; }

fechar_app() {
  pgrep -f "$APP/Contents/MacOS" >/dev/null 2>&1 || return 0
  osascript -e 'quit app "YouTube Music"' >/dev/null 2>&1 || true
  for _ in $(seq 1 15); do
    pgrep -f "$APP/Contents/MacOS" >/dev/null 2>&1 || return 0
    sleep 1
  done
}

if [ "$(uname -s)" != "Darwin" ]; then
  echo "  Este script e so para macOS. No Windows use iniciar.cmd."
  exit 1
fi

passo "Node.js"
if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    brew install node
  else
    echo "  Node nao encontrado, e o Homebrew tambem nao."
    echo "  Instale o Homebrew em https://brew.sh e rode este script de novo."
    exit 1
  fi
fi
echo "  Node $(node -v)"

passo "Dependencias do projeto"
npm install
npm run build

passo "App desktop do YouTube Music"
if [ -d "$APP" ]; then
  echo "  Ja instalado em $APP"
else
  echo "  O modo completo (volume exato, barra de progresso, capa e fila) usa o app"
  echo "  desktop pear-desktop. Sem ele o controle cai no modo basico."
  if [ "$SIM" -eq 0 ]; then
    read -r -p "  Baixar e instalar agora? [S/n] " resposta
    case "${resposta:-s}" in [nN]*) echo "  Pulando."; APP="";; esac
  fi
fi

if [ -n "$APP" ] && [ ! -d "$APP" ]; then
  versao=$(curl -fsSL "https://api.github.com/repos/$REPO_APP/releases/latest" |
    sed -n 's/.*"tag_name": *"v\{0,1\}\([^"]*\)".*/\1/p' | head -1)
  if [ -z "$versao" ]; then
    echo "  Nao consegui descobrir a ultima versao. Baixe o .dmg manualmente em"
    echo "  https://github.com/$REPO_APP/releases e rode este script de novo."
    exit 1
  fi

  arquivo="YouTube-Music-${versao}.dmg"
  [ "$(uname -m)" = "arm64" ] && arquivo="YouTube-Music-${versao}-arm64.dmg"
  echo "  Baixando $arquivo ..."

  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  curl -fL --progress-bar -o "$tmp/ytm.dmg" \
    "https://github.com/$REPO_APP/releases/download/v$versao/$arquivo"

  ponto=$(hdiutil attach "$tmp/ytm.dmg" -nobrowse -noverify | grep -Eo '/Volumes/.*' | tail -1)
  cp -R "$ponto/YouTube Music.app" /Applications/
  hdiutil detach "$ponto" -quiet
  echo "  Instalado em $APP"
fi

if [ -n "$APP" ]; then
  passo "Plugin API Server"
  fechar_app

  if [ ! -f "$CONFIG" ]; then
    echo "  Abrindo o app uma vez para ele gerar a configuracao..."
    open -a "$APP"
    for _ in $(seq 1 30); do [ -f "$CONFIG" ] && break; sleep 1; done
    fechar_app
  fi

  if [ ! -f "$CONFIG" ]; then
    echo "  O app nao gerou $CONFIG."
    echo "  Abra ele manualmente, feche, e rode este script de novo."
    exit 1
  fi

  CONFIG="$CONFIG" node -e '
    const fs = require("node:fs");
    const caminho = process.env.CONFIG;
    const config = JSON.parse(fs.readFileSync(caminho, "utf8"));
    config.plugins = config.plugins || {};
    config.plugins["api-server"] = {
      ...config.plugins["api-server"],
      enabled: true,
      hostname: "127.0.0.1",
      port: 26538,
      authStrategy: "NONE",
    };
    // Sem precise-volume a rota de volume responde 204 e nao mexe em nada.
    config.plugins["precise-volume"] = {
      ...config.plugins["precise-volume"],
      enabled: true,
    };
    fs.writeFileSync(caminho, JSON.stringify(config, null, "\t"));
  '
  echo "  Ligado na porta 26538, sem autenticacao (com precise-volume)."

  open -a "$APP"
  for _ in $(seq 1 25); do
    codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 \
      http://127.0.0.1:26538/api/v1/song || true)
    case "$codigo" in 2*) echo "  API respondendo."; break;; esac
    sleep 1
  done
fi

passo "Pronto"
echo "  Faca login no app do YouTube Music, se ainda nao fez."
echo "  Se o macOS bloquear o app por nao ser assinado, va em Ajustes do Sistema ->"
echo "  Privacidade e Seguranca e clique em Abrir Assim Mesmo."
echo
echo "  Para subir o servidor:  ./iniciar.sh"
npm run endereco
