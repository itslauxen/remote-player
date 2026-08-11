@echo off
title Controle do YouTube Music
cd /d "%~dp0"
call npm run endereco
echo   Deixe esta janela aberta enquanto usar o controle.
echo   Para parar: feche a janela ou aperte Ctrl+C.
echo.
call npm start
pause
