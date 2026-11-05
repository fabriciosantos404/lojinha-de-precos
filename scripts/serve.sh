#!/usr/bin/env bash
# =============================================================================
# serve.sh - servidor estatico local do projeto lojinha-de-precos
#            (macOS / Linux / Git Bash / WSL)
#
# O que faz:
#   Sobe um servidor de arquivos estaticos usando SOMENTE a biblioteca padrao
#   (stdlib) do Python (python3 -m http.server) a partir da RAIZ do repositório,
#   servindo o site em http://localhost:8000 — RESTRITO a 127.0.0.1
#   (via --bind 127.0.0.1; nunca exposto nas demais interfaces da maquina).
#
# Por que e obrigatorio:
#   O site usa modulos ES (<script type="module">) e fetch() de data/items.json.
#   Os navegadores BLOQUEIAM esses recursos via CORS quando a pagina e aberta
#   direto do disco (file://). Por isso o servidor HTTP local e OBRIGATORIO.
#
# COMO USAR (na raiz do repositório):
#   ./scripts/serve.sh                 # servidor em http://localhost:8000
#   ./scripts/serve.sh 9000            # servidor em http://localhost:9000
#
#   Primeira vez: de permissao de execucao ao script
#     chmod +x scripts/serve.sh
#   (Se o arquivo ja foi versionado com o bit de execucao, o chmod nao e
#    necessario apos um git clone; rode o comando acima apenas se aparecer
#    "Permission denied".)
#
# ALTERNATIVAS SEM ESTE SCRIPT (mesmo resultado):
#   python3 -m http.server 8000 --bind 127.0.0.1   # Python 3 (macOS, Linux)
#   python -m http.server 8000 --bind 127.0.0.1    # se o binario e "python"
#   npx serve                         # alternativa via Node.js (baixa sob
#                                     # demanda; abre em http://localhost:3000)
#
# Parar: Ctrl+C no terminal onde o servidor estiver rodando.
# =============================================================================

set -euo pipefail

# --- Porta (argumento opcional, padrao 8000) ---------------------------------
PORTA="${1:-8000}"
if ! printf '%s' "$PORTA" | grep -Eq '^[0-9]+$' || [ "$PORTA" -lt 1 ] || [ "$PORTA" -gt 65535 ]; then
  echo "ERRO: porta invalida '$PORTA'. Use um numero entre 1 e 65535 (ex.: 8000)." >&2
  exit 1
fi

# --- Raiz do repositório = sobrepasta do diretorio deste script --------------
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

# Heredoc QUOTADO (<<'EOF') para nao expandir $RAIZ/$(...) no corpo — as duas
# linhas dinamicas sao emitidas via printf com aspas (sem risco de execucao).
printf '=== Servidor local - lojinha-de-precos ===\n'
printf 'Diretorio servido : %s\n' "$RAIZ"
printf 'URL do site       : %s\n' "http://localhost:$PORTA"
printf 'Escuta            : somente 127.0.0.1 (nao exposto na LAN)\n'
cat <<'EOF'

AVISO: nao abra o index.html via file:// - os modulos ES e o fetch() do
       JSON nao funcionam direto do disco (bloqueio de CORS do navegador).
       Use sempre a URL acima na barra de endereco do navegador.

Pressione Ctrl+C para parar o servidor.

EOF

# --- Fallback: python3 -> python -> mensagem clara --------------------------
# tentar <comando>:
#   - comando ausente           -> aviso + registro da falha, retorna 1
#   - comando existe mas morre
#     rapido (< 2 s)            -> falha real (stub da Microsoft Store,
#                                  instalacao quebrada, porta ocupada) ->
#                                  aviso + registro, retorna 1
#   - servidor rodou de verdade -> imprime encerramento e sai com o codigo
#                                  do servidor (Ctrl+C = 130/143)
falhas=""
tentar() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[aviso] '$cmd' nao encontrado no PATH - tentando a proxima opcao..." >&2
    falhas="${falhas}
  - '$cmd': nao encontrado no PATH"
    return 1
  fi
  echo "Usando '$cmd' como servidor estatico..."
  # --bind 127.0.0.1: SEMPRE restrito ao loopback. Sem isso o http.server
  # escuta em 0.0.0.0 e publica a RAIZ do repositorio (incl. .git/) em
  # todas as interfaces (risco de exfiltracao via LAN / DNS rebinding).
  echo "Executando: $cmd -m http.server $PORTA --bind 127.0.0.1"
  local inicio fim codigo=0
  inicio=$(date +%s)
  "$cmd" -m http.server "$PORTA" --bind 127.0.0.1 || codigo=$?
  fim=$(date +%s)
  if [ $((fim - inicio)) -lt 2 ]; then
    echo "[aviso] '$cmd' nao conseguiu manter o servidor de pe (codigo $codigo) - tentando a proxima opcao..." >&2
    falhas="${falhas}
  - '$cmd': terminou rapidamente (codigo $codigo)"
    return 1
  fi
  if [ "$codigo" -eq 130 ] || [ "$codigo" -eq 143 ]; then
    echo ""
    echo "Servidor encerrado (Ctrl+C). Ate logo!"
  else
    echo ""
    echo "Servidor terminou (codigo $codigo)."
  fi
  exit "$codigo"
}

# Todas as condicoes de falha sao testadas em contexto de 'if' (isento de
# 'set -e'); se ambos os candidatos falharem, segue para a mensagem de erro.
if tentar python3 || tentar python; then
  :
fi

echo "" >&2
echo "ERRO: nenhum servidor pôde ser iniciado neste computador." >&2
echo "Tentativas:" >&2
printf '%s\n' "$falhas" >&2
echo "" >&2
cat >&2 <<'ERRO'
Como resolver (escolha UMA opcao):
  1) Instalar o Python 3:
       macOS:   brew install python3      (ou https://www.python.org/downloads/)
       Linux:   sudo apt install python3  (Debian/Ubuntu)
  2) Usar a alternativa via Node.js (baixa sob demanda):
       npx serve
     Depois abra http://localhost:3000 no navegador.

Nenhuma dependencia e adicionada ao projeto - estas sao apenas
ferramentas locais para servir os arquivos estaticos.
ERRO
exit 1
