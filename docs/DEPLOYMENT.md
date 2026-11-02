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
| Manual (Python 3 no PATH) | `python -m http.server 8000` | 8000 |
| Manual (Windows launcher `py`) | `py -3 -m http.server 8000` | 8000 |
| Manual (Node.js, baixa sob demanda) | `npx serve` | **3000** |

- URL do site: **http://localhost:8000** (ou `http://localhost:3000` no `npx serve`).
- Os wrappers resolvem a raiz do repositório sozinhos — funciona de qualquer diretório.
- `bash scripts/serve.sh` também funciona se o bit de execução (`+x`) não estiver setado.

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

# 2) Catálogo → 200 + JSON válido
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/data/items.json   # espera: 200

# 3) Módulo de entrada → 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/js/app.js        # espera: 200
```

Evidência manual mínima (T-08 smoke):

1. Abrir **http://localhost:8000** → vê "Lojinha de Preços — Catálogo de Itens de RPG" e **50 itens**.
2. Digitar `pocao` na busca → "1 item encontrado" (Poções de cura aparecem; ação sem acento funciona).
3. Console do navegador **sem erros** (sem violação de CSP, sem falha de `fetch`).

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

- [ ] `node --test` verde (sem `npm install`).
- [ ] `python scripts/validate_data.py` → exit 0.
- [ ] Servidor sobe em uma das variantes §2.
- [ ] `GET /`, `GET /data/items.json`, `GET /js/app.js` → 200 (§4).
- [ ] 50 itens renderizados; busca `pocao` funciona; console limpo.
- [ ] Desconectado da rede, o site continua funcional (RNF-04).

## 8. Segurança operacional

- **Nenhum segredo existe neste projeto** — não há variáveis de ambiente, tokens, chaves nem credenciais no código ou nos scripts. (Se um dia houver, vão para `.env` — já ignorado no `.gitignore` — nunca para o git.)
- O servidor serve **somente arquivos da raiz do repositório** (stdlib `http.server`), sem escrita nem execução de código.
- **Atenção:** `python -m http.server` escuta em **todas as interfaces** por padrão (0.0.0.0) — em rede local (LAN), quem estiver na mesma rede pode acessar os arquivos. Para uso pessoal restrito, prefira `npx serve --listen 127.0.0.1:3000` ou bloqueie a porta 8000 no firewall do SO.
- Não há porta encaminhada para a internet (NAT/roteador) sem ação explícita do usuário.
