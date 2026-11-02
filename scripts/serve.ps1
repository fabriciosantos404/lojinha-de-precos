<#
===============================================================================
 serve.ps1 - servidor estatico local do projeto lojinha-de-precos (Windows)

 O que faz:
   Sobe um servidor de arquivos estaticos usando SOMENTE a biblioteca padrao
   (stdlib) do Python (python -m http.server) a partir da RAIZ do repositório,
   servindo o site em http://localhost:8000.

 Por que e obrigatorio:
   O site usa modulos ES (<script type="module">) e fetch() de data/items.json.
   Os navegadores BLOQUEIAM esses recursos via CORS quando a pagina e aberta
   direto do disco (file://). Por isso o servidor HTTP local e OBRIGATORIO.

 COMO USAR (Windows PowerShell, na raiz do repositório):
   .\scripts\serve.ps1                 # servidor em http://localhost:8000
   .\scripts\serve.ps1 -Port 9000      # servidor em http://localhost:9000

   Se a execution policy do PowerShell bloquear o script:
     powershell -ExecutionPolicy Bypass -File .\scripts\serve.ps1
   (No cmd.exe:
     powershell -ExecutionPolicy Bypass -File scripts\serve.ps1)

 ALTERNATIVAS SEM ESTE SCRIPT (mesmo resultado):
   python -m http.server 8000         # Python 3 no PATH
   py -3 -m http.server 8000          # launcher "py" do Windows (python.org)
   npx serve                          # alternativa via Node.js (baixa sob
                                      # demanda; abre em http://localhost:3000)

 Parar: Ctrl+C no terminal onde o servidor estiver rodando.
===============================================================================
#>

#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateRange(1, 65535)]
    [int]$Port = 8000
)

# --- Encoding UTF-8 na saida do console (acentos PT-BR corretos) -------------
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

# --- Raiz do repositório = sobrepasta do diretorio deste script --------------
if ([string]::IsNullOrEmpty($PSScriptRoot)) {
    $repoRoot = (Get-Location).Path
} else {
    $repoRoot = Split-Path -Parent $PSScriptRoot
}

# Verifica se a porta já está em uso antes de tentar iniciar o servidor
function Test-PortaEmUso {
    param([int]$NumeroPorta)
    $cliente = New-Object System.Net.Sockets.TcpClient
    try {
        $cliente.Connect('127.0.0.1', $NumeroPorta)
        return $true
    } catch {
        return $false
    } finally {
        $cliente.Close()
    }
}

$exitCode = 0
Push-Location $repoRoot
try {

    Write-Host ""
    Write-Host "=== Servidor local - lojinha-de-precos ===" -ForegroundColor Cyan
    Write-Host "Diretorio servido : $repoRoot"
    Write-Host "URL do site       : http://localhost:$Port"
    Write-Host ""
    Write-Host "AVISO: nao abra o index.html via file:// - os modulos ES e o fetch() do" -ForegroundColor Yellow
    Write-Host "       JSON nao funcionam direto do disco (bloqueio de CORS do navegador)." -ForegroundColor Yellow
    Write-Host "       Use sempre a URL acima na barra de endereco do navegador." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pressione Ctrl+C para parar o servidor."
    Write-Host ""

    if (Test-PortaEmUso -NumeroPorta $Port) {
        Write-Host "ERRO: a porta $Port ja esta em uso por outro programa." -ForegroundColor Red
        Write-Host "Escolha outra porta, por exemplo:" -ForegroundColor Yellow
        Write-Host "  .\scripts\serve.ps1 -Port 8001"
        $exitCode = 1
    } else {
        # Ordem de fallback: "python" (PATH direto) -> "py" (launcher Windows)
        $candidatos = @(
            @{ Comando = 'python'; Argumentos = @('-m', 'http.server', $Port) },
            @{ Comando = 'py';     Argumentos = @('-3', '-m', 'http.server', $Port) }
        )

        $servidorIniciado = $false
        $falhas = @()

        foreach ($candidato in $candidatos) {
            $nome = $candidato.Comando

            if (-not (Get-Command -Name $nome -ErrorAction SilentlyContinue)) {
                $falhas += "'$nome' nao encontrado no PATH"
                Write-Host "[aviso] '$nome' nao encontrado no PATH - tentando a proxima opcao..." -ForegroundColor Yellow
                continue
            }

            Write-Host "Usando '$nome' como servidor estatico..." -ForegroundColor Cyan

            # O servidor bloqueia ate o Ctrl+C; se morrer rapido (< 2 s), e
            # falha real (porta ocupada, stub da Microsoft Store no Windows,
            # Python quebrado) - nunca o Ctrl+C do usuario.
            $cronometro = [System.Diagnostics.Stopwatch]::StartNew()
            $argumentos = $candidato.Argumentos
            & $nome @argumentos
            $cronometro.Stop()
            $codigoSaida = $LASTEXITCODE

            if ($cronometro.Elapsed.TotalSeconds -lt 2) {
                $falhas += "'$nome' terminou rapidamente (codigo $codigoSaida)"
                Write-Host "[aviso] '$nome' nao conseguiu manter o servidor de pe (codigo $codigoSaida) - tentando a proxima opcao..." -ForegroundColor Yellow
                continue
            }

            # Servidor rodou de verdade e foi interrompido (Ctrl+C)
            $servidorIniciado = $true
            Write-Host ""
            Write-Host "Servidor encerrado. Ate logo!"
            break
        }

        if (-not $servidorIniciado) {
            Write-Host ""
            Write-Host "ERRO: nenhum servidor pôde ser iniciado neste computador." -ForegroundColor Red
            Write-Host "Tentativas:" -ForegroundColor Red
            foreach ($falha in $falhas) {
                Write-Host "  - $falha" -ForegroundColor Red
            }
            Write-Host ""
            Write-Host "Como resolver (escolha UMA opcao):" -ForegroundColor Yellow
            Write-Host "  1) Instalar o Python 3 e garanti-lo no PATH:"
            Write-Host "       winget install Python.Python.3.12"
            Write-Host "     (ou baixe em https://www.python.org/downloads/ e marque a opcao"
            Write-Host "      'Add python.exe to PATH' na instalacao)"
            Write-Host "  2) Usar a alternativa via Node.js (baixa sob demanda):"
            Write-Host "       npx serve"
            Write-Host "     Depois abra http://localhost:3000 no navegador."
            Write-Host ""
            Write-Host "Nenhuma dependencia e adicionada ao projeto - estas sao apenas"
            Write-Host "ferramentas locais para servir os arquivos estaticos."
            $exitCode = 1
        }
    }

} finally {
    Pop-Location
}

exit $exitCode
