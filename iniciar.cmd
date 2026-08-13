@echo off
title Controle do YouTube Music
cd /d "%~dp0"

rem O tunel vem antes da checagem do servidor: os dois caem de forma
rem independente, e com a ordem trocada um servidor de pe fazia o script sair
rem cedo demais, deixando o tunel morto e o celular sem alcancar o PC.
tasklist /fi "imagename eq cloudflared.exe" | find /i "cloudflared.exe" >nul
if errorlevel 1 (
  echo   Subindo o tunel...
  start "Tunel Cloudflare" /min "%USERPROFILE%\.cloudflared\cloudflared.exe" tunnel run remoteplayer
)

netstat -ano | find ":8765" | find /i "LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo   O servidor ja estava rodando.
  echo.
  call npm run endereco
  echo   Fora de casa: https://remoteplayer.lauxen.dev
  echo.
  pause
  exit /b
)

call npm run endereco
echo   Fora de casa: https://remoteplayer.lauxen.dev
echo.
echo   Deixe esta janela aberta enquanto usar o controle.
echo   Para parar: feche a janela ou aperte Ctrl+C.
echo.
call npm start
pause
