@echo off
title Controle do YouTube Music
cd /d "%~dp0"

tasklist /fi "imagename eq cloudflared.exe" | find /i "cloudflared.exe" >nul
if errorlevel 1 (
  start "Tunel Cloudflare" /min "%USERPROFILE%\.cloudflared\cloudflared.exe" tunnel run remoteplayer
)

call npm run endereco
echo   Fora de casa: https://remoteplayer.lauxen.dev
echo.
echo   Deixe esta janela aberta enquanto usar o controle.
echo   Para parar: feche a janela ou aperte Ctrl+C.
echo.
call npm start
pause
