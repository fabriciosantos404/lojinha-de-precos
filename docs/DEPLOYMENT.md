# DEPLOYMENT.md — Runbook local (lojinha-de-precos)

> **Projeto:** lojinha-de-precos · **Dono:** `devops-engineer` · **Status:** vigente (v0.1.0)
> **Escopo:** como **subir, verificar e descer** o ambiente de desenvolvimento local, resolver problemas comuns e fazer rollback.
> **Fontes de verdade:** `docs/ARCHITECTURE.md` (D-2, D-18), `docs/REQUIREMENTS.md` (RF-15, RNF-04), `scripts/serve.ps1` / `scripts/serve.sh`.

---

## 1. Ambientes

| Ambiente | Status | Descrição |
|---|---|---|
| **Development local** | ✅ **Único ambiente oficial** | Servidor estático HTTP na máquina do mantenedor. É onde o site é desenvolvido, testado e usado (decisão do usuário: deploy somente local — REQUIREMENTS §3 "Out"). |
| Staging / Production | ❌ Não existem | Não há build, artefatos, backend nem banco — não há o que promover entre ambientes. |

### NOTA — Como seria publicar no futuro (não prometido, não planejado hoje)

Se um dia o projeto precisar sair do computador local, a arquitetura estática (zero build)
significa que **basta servir os mesmos arquivos** — por exemplo:

- **GitHub Pages:** publicar a raiz do repositório como site estático (ou `docs/` se preferir).
- **Vercel / Netlify / Cloudflare Pages:** apontar o *output directory* para a raiz (sem comando de build).

Nenhum desses caminhos está implementado, aprovado ou comprometido (decisão 3: somente local).
Esta seção existe apenas para documentar que **nenhuma mudança de código seria necessária** se
a decisão mudar. Requeriria nova decisão explícita + revisão de segurança (headers/CSP em CDN).

---

## 2. Subir o servidor

Na **raiz do repositório**, escolha **UMA** variante:

| SO / ferramenta | Comando exato | Porta padrão |
|---|---|---|
| Windows (PowerShell) | `.\scripts\serve.ps1` | 8000 |
| Windows (outra porta) | `.\scripts\serve.ps1 -Port 9001` | 9001 |
| Windows (execution policy bloqueia) | `powershell -ExecutionPolicy Bypass -File .\scripts\serve.ps1` | 8000 |
| macOS / Linux / Git Bash / WSL | `./scripts/serve.sh` | 8000 |
| macOS / Linux (outra porta) | `./scripts/serve.sh 9001` | 9001 |
| Manual (Python 3 no PATH) | `python -m http.server 8000 --bind 127.0.0.1` | 8000 |
| Manual (Windows launcher `py`) | `py -3 -m http.server 8000 --bind 127.0.0.1` | 8000 |
| Manual (Node.js, baixa sob demanda) | `npx serve --listen 127.0.0.1:3000` | **3000** |

- URL do site: **http://localhost:8000** (ou `http://localhost:3000` no `npx serve`).
- Os wrappers resolvem a raiz do repositório sozinhos — funciona de qualquer diretório.
- `bash scripts/serve.sh` também funciona se o bit de execução (`+x`) não estiver setado.
- **Escuta restrita ao loopback por padrão:** os wrappers e os comandos manuais acima usam
  `--bind 127.0.0.1` — o site só é alcançável na própria máquina (ver §8).

**Offline (RNF-04):** depois que o servidor subir, o site funciona **sem internet** —
não há CDN, fontes externas, analytics nem `npm install` no fluxo.

## 3. Descer o servidor

| Como subiu | Como desce |
|---|---|
| `serve.ps1` / `serve.sh` / `python -m http.server` / `npx serve` | `Ctrl+C` no mesmo terminal |
| Terminal fechado / processo órfão | Encerrar o processo `python`/`serve` do SO (`taskkill` no Windows, `kill` no Unix) |

Não há serviço, daemon nem contêiner — **encerrou o processo, o ambiente desceu.**
Não há dados a migrar nem estado a limpar (o `localStorage` do navegador guarda só o tema).

## 4. Verificações pós-subida (health check)

Não há endpoint `/health`: o produto é **arquivos estáticos servidos pelo Python stdlib**
sem customização de rotas. O health check é o próprio `GET /`:

```bash
# 1) Página principal → 200 + HTML com o título do site
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/          # espera: 200

# 2) Catálogo → 200 + JSON válido (parse: 50 itens no array "items")
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/data/items.json   # espera: 200

# 3) Módulos JS → 200 (o index.html só carrega app.js, que importa os demais)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/js/app.js        # espera: 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/js/render.js     # espera: 200

# 4) Folha de estilo → 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/css/styles.css   # espera: 200

# 5) Negativo (o servidor precisa responder 404, não 200/500)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/data/nao-existe.json  # espera: 404
```

> **Caminhos confirmados em produção local:** `/`, `/data/items.json`, `/js/app.js`,
> `/js/render.js` e `/css/styles.css` respondem **200**; `/data/nao-existe.json` responde
> **404**. Não existem outros assets remotos (ver RNF-04 na §4.1).

### 4.1 Registro do smoke de infraestrutura — **2026-11-04** (T-08)

Executado de verdade nesta data, na porta alternativa **8123** (para não conflitar com a
8000), com saída real registrada:

| Verificação | Comando / requisição | Saída real |
|---|---|---|
| Subida | `.\scripts\serve.ps1 -Port 8123` | servidor ativo em `http://localhost:8123` |
| Página principal | `GET /` | **200** (4.308 bytes), HTML contém `Lojinha de Preços — Catálogo de Itens de RPG` (`<title>`) e `<h1>Lojinha de Preços</h1>` |
| Catálogo | `GET /data/items.json` | **200** (22.497 bytes) → `ConvertFrom-Json` → **`items.Count = 50`** |
| Módulo de entrada | `GET /js/app.js` | **200** (15.090 bytes) |
| Folha de estilo | `GET /css/styles.css` | **200** (17.054 bytes) |
| Módulo de render | `GET /js/render.js` | **200** (17.242 bytes) |
| Negativo | `GET /data/nao-existe.json` | **404** (esperado) |
| Testes | `node --test` | **68 pass / 0 fail** (suites 0, cancelled 0, skipped 0, duration 858,94 ms) → **exit 0** |
| Validador | `py scripts/validate_data.py` | `OK: 50 itens validados, 0 erros, 0 avisos.` → **exit 0** |
| Offline (RNF-04) | grep `https?://` em `index.html`, `css/*.css`, `js/*.js` | **0 ocorrências** — nenhum CDN, fonte, analytics ou script remoto |
| Desligamento | `Stop-Process` no PID do servidor | porta 8123 **liberada**; `GET /` sem resposta |

**Fallback observado neste smoke (evidência real, além do teste da T-05):** nesta máquina o
comando `python` do PATH é o *stub* da Microsoft Store (exit **9009** — "Python was not
found; run without arguments to install from the Microsoft Store"). O `serve.ps1` detectou a
falha rápida (`< 2 s`), imprimiu `[aviso] 'python' nao conseguiu manter o servidor de pe
(codigo 9009) - tentando a proxima opcao...` e subiu com o launcher **`py`** — exatamente o
comportamento documentado na §5. O fallback `python → py` **funciona sem intervenção**.

Evidência manual mínima (continua necessária — o smoke automatizado não cobre o DOM do
navegador):

1. Abrir **http://localhost:8000** → vê "Lojinha de Preços — Catálogo de Itens de RPG" e **50 itens**.
2. Digitar `pocao` na busca → "1 item encontrado" (Poções de cura aparecem; ação sem acento funciona).
3. Console do navegador **sem erros** (sem violação de CSP, sem falha de `fetch`).

### 4.2 Registro do smoke de segurança (bind 127.0.0.1) — **2026-11-04** (T-21 / M1)

Evidência real da correção que restringe o servidor ao loopback:

| Verificação | Comando / requisição | Saída real |
|---|---|---|
| Sintaxe `serve.ps1` | `Parser::ParseFile` (PowerShell) | **0 erros** de parsing |
| Sintaxe `serve.sh` | `bash -n scripts/serve.sh` | **exit 0** |
| Subida (Windows) | `.\scripts\serve.ps1 -Port 8124` | banner com `Escuta : somente 127.0.0.1`; log `Executando: py -3 -m http.server 8124 --bind 127.0.0.1` (fallback `python` → stub 9009 → `py`, como na §4.1) |
| Página principal | `GET http://localhost:8124/` e `GET http://127.0.0.1:8124/` | **200** nos dois |
| Acesso via LAN | `TcpClient.Connect('192.168.1.11', 8124)` | **RECUSADO** (sem listener fora do loopback) |
| Cliente no log do Python | linha de acesso do `http.server` | `127.0.0.1 - - [...] "GET / HTTP/1.1" 200 -` |
| Subida (Git Bash) | `bash scripts/serve.sh 8125` | banner correto (heredoc literal, sem expandir `$RAIZ`); log `Executando: python3 -m http.server 8125 --bind 127.0.0.1` |
| Página + JSON (sh) | `GET /` · `GET /data/items.json` | **200** (4.452 bytes) · **200**; acesso via LAN **RECUSADO** |
| Desligamento | `Stop-Process` no PID do listener | portas **8124 e 8125 liberadas**; `GET /` sem resposta |
| Testes | `node --test` | **68 pass / 0 fail** → **exit 0** |

> **Nota de ambiente:** nesta máquina `python3`/`python` no PATH são stubs da Microsoft
> Store; o smoke do `serve.sh` usou um shim temporário `python3` → `py -3` (fora do
> repositório). O wrapper em si não foi alterado para tentar `py` (fora do escopo T-21).

## 5. Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| `A porta 8000 já está em uso` (o script avisa antes) | Outro servidor/processo na porta | Use outra porta: `.\scripts\serve.ps1 -Port 9001` ou `./scripts/serve.sh 9001` |
| `'python' não é reconhecido` / nenhum servidor pôde ser iniciado | Python ausente do PATH | Instalar: `winget install Python.Python.3.12` (marcar *Add to PATH*) — ou usar `npx serve` (→ `localhost:3000`) |
| Windows Store abre ao digitar `python` | Stub da Microsoft Store | Instalar o Python real (`winget`) ou usar `py -3` / `npx serve` |
| Tela em branco / erros de CORS no console | Página aberta via `file://` | **Nunca duplo-clique no `index.html`.** Suba o servidor e use `http://localhost:8000` |
| `404` em `data/items.json` ou `js/app.js` | Servidor aberto em outro diretório **ou** módulo ausente do repositório | Rode os wrappers (`serve.ps1`/`serve.sh`) — eles fixam a raiz do repositório automaticamente. Se o `GET /js/app.js` continuar 404, confira se `js/app.js` e `js/render.js` existem no clone (`git status` / `git pull`) |
| Estado de erro "Erro ao carregar o catálogo" no site | JSON inválido após edição | `python scripts/validate_data.py` → corrija o erro apontado (virgulas/aspas) e recarregue |
| Site diz que o arquivo está em `file:` | `app.js` detectou `location.protocol === 'file:'` | Mesma solução: subir o servidor local |
| Teste falha: `node --test tests/` | Comportamento conhecido no Node 24/Windows (D-18) | Use **`node --test`** sem caminho de diretório |
| `Permission denied` no `serve.sh` | Bit de execução ausente | `chmod +x scripts/serve.sh` ou `bash scripts/serve.sh` |
| Python responde mas servidor morre rápido | Instalação quebrada / stub | O script lista as tentativas e sugere `winget`/`npx` — siga a mensagem |

## 6. Rollback

Não há build, imagem, migração nem artefato — **o "deploy" é o próprio repositório**.

```bash
# Desfazer a última mudança (histórico local)
git revert <commit>          # cria commit de reversão (preferido, preserva histórico)
# ou, para mudanças ainda não confirmadas:
git checkout -- <arquivo>    # descarta alteração local em um arquivo

# Voltar para uma versão conhecida boa
git log --oneline            # identifica a versão (ex.: v0.1.0)
git checkout v0.1.0          # ou: git revert <range>
```

Validação obrigatória após qualquer rollback:

```bash
node --test                  # testes verdes (D-18)
python scripts/validate_data.py   # catálogo válido (exit 0)
# smoke: subir servidor e conferir 50 itens no http://localhost:8000
```

Como não há artefatos publicados, o rollback é **instantâneo e completo**: qualquer commit
do histórico é um estado executável autocontido.

## 7. Checklist de publicação local (pré-uso)

- [ ] `node --test` verde (sem `npm install`) — esperado **≥ 68 pass / 0 fail**.
- [ ] `python scripts/validate_data.py` → exit 0.
- [ ] Servidor sobe em uma das variantes §2.
- [ ] `GET /`, `GET /data/items.json`, `GET /js/app.js`, `GET /js/render.js`, `GET /css/styles.css` → 200; `GET /data/nao-existe.json` → 404 (§4).
- [ ] 50 itens renderizados; busca `pocao` funciona; console limpo.
- [ ] Servidor restrito ao loopback: banner mostra `--bind 127.0.0.1` e uma conexão ao IP da LAN na porta é **recusada** (§8).
- [ ] Desconectado da rede, o site continua funcional (RNF-04 — nenhum `https?://` em html/css/js).

> Última execução completa destas verificações: **2026-11-04** (§4.1) — todas verdes.

## 8. Segurança operacional

- **Nenhum segredo existe neste projeto** — não há variáveis de ambiente, tokens, chaves nem credenciais no código ou nos scripts. (Se um dia houver, vão para `.env` — já ignorado no `.gitignore` — nunca para o git.)
- O servidor serve **somente arquivos da raiz do repositório** (stdlib `http.server`), sem escrita nem execução de código.
- **Escuta restrita por padrão (correção T-21 / M1):** os wrappers `scripts/serve.ps1` e `scripts/serve.sh` — e os comandos manuais da §2 — executam `python -m http.server <porta> --bind 127.0.0.1`. Por padrão o servidor **não é alcançável nas demais interfaces da máquina**: só `http://localhost:<porta>`. O banner dos wrappers mostra a linha de comando exata executada (incluindo o `--bind`).
- **Risco de expor a raiz do repositório (incl. `.git/`):** `python -m http.server` serve **tudo** o que está no diretório de trabalho — inclusive `.git/` (histórico, objetos, refs). Se o servidor for exposto fora do loopback, na mesma LAN qualquer pessoa acessa `http://<ip-da-máquina>:8000/.git/` e baixa o histórico completo do repositório; via **DNS rebinding**, uma página visitada no navegador pode ler os mesmos arquivos *same-origin*. **Recomendação: não expor.**
- **Se (e somente se) for deliberadamente necessário expor na LAN:**
  1. faça `--bind 0.0.0.0` **de propósito** (nunca por acidente), ciente de que `http://<ip>:8000/.git/` fica servido;
  2. **melhor alternativa:** sirva de **outro diretório** (copie/symlink apenas `index.html`, `css/`, `js/`, `data/` para uma pasta temporária e rode o servidor a partir dela) — assim o `.git/` jamais é publicado;
  3. restrinja a porta no firewall do SO e/ou use `npx serve --listen 127.0.0.1:3000` + túnel se precisar de acesso remoto.
- Não há porta encaminhada para a internet (NAT/roteador) sem ação explícita do usuário.
