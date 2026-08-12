#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

TUNEL="${TUNEL:-}"

if [ -n "$TUNEL" ] && ! pgrep -x cloudflared >/dev/null 2>&1; then
  cloudflared tunnel run "$TUNEL" &
  echo "  Tunel $TUNEL iniciado."
fi

npm run endereco
echo "  Deixe este terminal aberto enquanto usar o controle."
echo "  Para parar: Ctrl+C."
echo
npm start
