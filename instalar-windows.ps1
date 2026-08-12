# Instalacao guiada no Windows: dependencias, app desktop e plugins do player.
# Equivalente ao instalar-mac.sh. Rode num PowerShell normal (nao precisa admin):
#   powershell -ExecutionPolicy Bypass -File instalar-windows.ps1
param([switch]$Sim)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Passo($texto) { Write-Host ""; Write-Host "==> $texto" }

function Tem($nome) { [bool](Get-Command $nome -ErrorAction SilentlyContinue) }

Passo "Node.js"
if (-not (Tem 'node')) {
  if (-not (Tem 'winget')) {
    Write-Host "  Node nao encontrado, e o winget tambem nao."
    Write-Host "  Instale o Node em https://nodejs.org e rode este script de novo."
    exit 1
  }
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  Write-Host "  Feche e reabra o PowerShell para o PATH atualizar, e rode de novo."
  exit 0
}
Write-Host "  Node $(node -v)"

Passo "Dependencias do projeto"
npm install
npm run build

Passo "App desktop do YouTube Music"
$config = Join-Path $env:APPDATA 'YouTube Music\config.json'
$instalado = Test-Path $config
if (-not $instalado) {
  $instalado = [bool](winget list --id th-ch.YouTubeMusic -e 2>$null | Select-String 'th-ch.YouTubeMusic')
}

if ($instalado) {
  Write-Host "  Ja instalado."
} else {
  Write-Host "  O modo completo (volume exato, barra de progresso, capa e fila) usa o app"
  Write-Host "  desktop do YouTube Music. Sem ele o controle cai no modo basico."
  $ok = $Sim
  if (-not $ok) {
    $r = Read-Host "  Baixar e instalar agora? [S/n]"
    $ok = ($r -eq '' -or $r -match '^[sSyY]')
  }
  if ($ok) {
    winget install --id th-ch.YouTubeMusic -e --accept-source-agreements --accept-package-agreements
    Write-Host "  Abra o app uma vez, faca login e feche antes de continuar."
    if (-not $Sim) { Read-Host "  Pressione Enter quando tiver fechado" }
  }
}

Passo "Plugins API Server e precise-volume"
# O app reescreve o config ao sair, entao ele precisa estar fechado aqui.
Get-Process 'YouTube Music' -ErrorAction SilentlyContinue | ForEach-Object {
  $_.CloseMainWindow() | Out-Null
}
Start-Sleep -Seconds 4
Get-Process 'YouTube Music' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

if (-not (Test-Path $config)) {
  Write-Host "  Nao achei $config."
  Write-Host "  Abra o app uma vez para ele gerar a configuracao, feche, e rode de novo."
  exit 1
}

$json = Get-Content $config -Raw | ConvertFrom-Json
if (-not $json.plugins) {
  $json | Add-Member -NotePropertyName plugins -NotePropertyValue ([pscustomobject]@{}) -Force
}
$json.plugins | Add-Member -NotePropertyName 'api-server' -NotePropertyValue ([pscustomobject]@{
    enabled      = $true
    hostname     = '127.0.0.1'
    port         = 26538
    authStrategy = 'NONE'
  }) -Force
# Sem precise-volume a rota de volume responde 204 e nao mexe em nada.
$json.plugins | Add-Member -NotePropertyName 'precise-volume' -NotePropertyValue ([pscustomobject]@{
    enabled = $true
  }) -Force
$json | ConvertTo-Json -Depth 20 | Set-Content $config -Encoding UTF8
Write-Host "  Ligados na porta 26538, sem autenticacao."

Passo "Firewall"
$regra = Get-NetFirewallRule -DisplayName 'Remote Player 8765' -ErrorAction SilentlyContinue
if ($regra) {
  Write-Host "  Regra ja existe."
} else {
  Write-Host "  Para o celular alcancar o PC, a porta 8765 precisa estar liberada."
  Write-Host "  Num PowerShell como administrador:"
  Write-Host ""
  Write-Host "    New-NetFirewallRule -DisplayName 'Remote Player 8765' -Direction Inbound ``"
  Write-Host "      -Protocol TCP -LocalPort 8765 -Action Allow -RemoteAddress LocalSubnet"
}

Passo "Pronto"
Write-Host "  Para subir o servidor: iniciar.cmd (ou iniciar-silencioso.vbs, sem janela)."
npm run endereco
