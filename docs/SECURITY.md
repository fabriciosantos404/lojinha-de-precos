# SECURITY.md — lojinha-de-precos

> **Projeto:** lojinha-de-precos
> **Tarefas:** T-21 (auditoria de segurança) + T-22 (documentação de segurança)
> **Autor:** Senior Application Security Engineer
> **Última auditoria:** 2026-11-04 (re-check pós-correção — ver §9.2)
> **Resultado:** **APROVADO COM RESSALVAS** (0 BLOQUEANTE · 0 achado aberto · 1 MAJOR + 2 MINOR **FECHADOS** · 1 MINOR aceito · 11 OK)
> **Re-check pós-correção:** 2026-11-04 — M1/m1/m2 fechados com evidência; `js/boot-guard.js` auditado (§2.13); registro em §9.1
> **Fonte arquitetural:** `docs/ARCHITECTURE.md` §9 (estratégia de segurança) · `docs/REQUIREMENTS.md` RNF-07/RNF-08/RNF-09

---

## 1. Escopo e modelo de ameaças

### 1.1 O que é o sistema

Site **estático** (HTML/CSS/JS puro, módulos ES, zero build), executado **somente localmente** via servidor estático (`python -m http.server` / `scripts/serve.*`). Não existe backend, API, banco, autenticação, autorização, sessão, cookies, uploads, pagamentos, coleta de PII nem telemetria.

### 1.2 Superfície de ataque real

| Ativo | Origem do dado | Quem controla |
|---|---|---|
| `data/items.json` (catálogo) | Edição manual do mantenedor | Mantenedor (único writer) — **mas é a única entrada de dados não-proveniente do código-fonte** |
| Preferência de tema | `localStorage["theme"]` | Navegador do usuário local (atacante com acesso ao browser/máquina) |
| Código JS/CSS/HTML | Repositório git | Mantenedor + revisores |
| Servidor local (`python -m http.server`) | Processo local | Usuário que roda o comando |

### 1.3 Ameaças consideradas (e as que são por definição impossíveis)

**Consideradas:** XSS via JSON editado (principal), injeção de código (`eval`/`Function`/`javascript:`), CSP contornável, supply chain (CDN/npm), `localStorage` corrompido, JSON inválido/grande (DoS de render), vazamento de segredos, expor o repositório pela rede local, path traversal/command injection nos scripts de manutenção.

**Fora de escopo (por inexistência do vetor, não por omissão):** SQL/NoSQL injection, SSRF, IDOR, CSRF, broken auth, brute force/rate limit de login, mass assignment, malware em upload, XXE, command injection com input remoto — **não há servidor de aplicação, não há estado compartilhado entre usuários e não há entrada de usuário remoto.** Qualquer evolução que introduza esses vetores exige nova revisão (ver §7.3).

### 1.4 Atacantes modelados

1. **Atacante de rede local (LAN)** — acessa a porta do servidor local quando ele escuta em todas as interfaces.
2. **Página maliciosa no browser do mantenedor** — tenta ler `localhost:8000` via DNS rebinding enquanto o servidor está no ar.
3. **Contribuidor mal-intencionado / JSON editado com payload** — injeta `<script>`/`<img onerror>` em `name`/`effectText`/`restrictions`.
4. **Dependência comprometida** — inexistente: não há dependências (§6).
5. **Mantenedor acidental** — commita segredo, roda script com input não validado, expõe o servidor publicamente.

---

## 2. Tabela ameaça → vetor → mitigação → evidência

> Todas as evidências abaixo são a **saída real** dos comandos executados na auditoria de **2026-11-04**, no Windows (PowerShell + ripgrep do tool de auditoria). `rg` não está no PATH do shell → `Select-String` usado quando o comando roda via shell.

### 2.1 XSS via JSON editado (principal) — **OK**

| | |
|---|---|
| **Vetor** | `name`, `effectText`, `restrictions[]`, `modifiers[].label`, `tags[]`, `armorClass`, `damage` contendo `<script>`, `<img src=x onerror=...>` ou `<svg onload=...>` em `data/items.json` |
| **Mitigação** | `render.js` é a única camada DOM e usa **exclusivamente** `document.createElement` + `textContent` + `replaceChildren`; nenhum dado do JSON vira HTML; guards de tipo (`typeof x === 'string'`) antes de todo textContent |
| **Evidência (comando)** | `Get-ChildItem js -Recurse -File \| Select-String -Pattern 'innerHTML\|outerHTML\|insertAdjacentHTML\|document\.write\|eval(\|new Function'` |
| **Saída real** | `js\render.js:4: // Segurança (§9): textContent SEMPRE; innerHTML/insertAdjacentHTML/eval proibidos;` + `js\boot-guard.js:11: // nenhum inline, nenhum innerHTML/eval (textContent/createElement apenas).` → **única ocorrência é comentário de proibição nos 2 arquivos (aceitável)** |
| **Classificação** | **OK** |

Evidência complementar (uso de `textContent`/`createElement` no render):

```
rg -n 'textContent|createElement|appendChild|setAttribute' js/render.js
→ 45 matches — todos em render.js; nenhum `innerHTML`. Ex.: render.js:117 badge.textContent = text;
  render.js:151 name.textContent = typeof data.name === 'string' ? data.name : '';
  render.js:175 paragraph.textContent = data.effectText;
  render.js:402 list.replaceChildren(fragment);
```

Evidência de que **nenhum atributo dinâmico** recebe dado do JSON (vetor `href`/`src`/`style`):

```
rg -n 'setAttribute\(|href|\.src|style\.|setProperty' js/
→ js\render.js:146   emoji.setAttribute('aria-hidden', 'true');      // literal, não-dado
   js\theme.js:22     button.setAttribute('aria-label', ...);         // literal
   js\theme.js:23     button.setAttribute('aria-pressed', ...);       // literal
   (zero href/src/style.setProperty com dado de entrada)
```

O dado só é text: `createBadge` monta `<li>` via `textContent` (render.js:114-119); `createCardHeader` guarda `name` com `typeof` check (render.js:151); `createCardDescription` só cria `<p>` se `effectText` for string não-vazia (render.js:169-176); `appendModifierBadges` descarta `label` não-string (render.js:239); `renderError` escreve mensagem de mapa fixo via `textContent` (render.js:455-468). **Nenhum ponto do código transforma dado em HTML.**

### 2.2 Injeção de código (`eval`, `Function`, `javascript:`) — **OK**

| | |
|---|---|
| **Evidência (comando)** | `grep 'eval\(\|new Function\|Function(\["\'`]' no repo` + `grep 'javascript:' no repo` |
| **Saída real** | `eval`/`new Function`: só 2 matches em **docs** (`docs/ARCHITECTURE.md:463` e `docs/PLAN_EXECUCAO.md:177` — ambos descrevendo a PROIBIÇÃO). `javascript:` → **No matches found** (repo inteiro) |
| **Saída real (handlers string em timer)** | `rg -n "setTimeout\(\s*['\"]|setInterval\(\s*['\"]" js/` → **zero** (único `setTimeout` é `utils.js:39`, com **callback function**, não string) |
| **Classificação** | **OK** |

### 2.3 CSP — **OK** (com ressalta documentada sobre `frame-ancestors`)

| | |
|---|---|
| **Evidência (comando)** | leitura de `index.html:6` + grep de inline em `index.html` |
| **Saída real — meta tag** | `index.html:6: <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">` |
| **Saída real — inline handlers** | `rg -n 'onclick\|onerror\|onload\|style=' index.html` → **No matches found** |
| **Saída real — `<script>`** | `grep '<script' index.html` → **2 matches**: `index.html:11: <script src="js/boot-guard.js"></script>` + `index.html:12: <script type="module" src="js/app.js"></script>` (**ambos com `src` relativo, zero inline)** |
| **Comparação com ARCHITECTURE §9** | idêntico: `default-src/script-src/style-src/img-src/connect-src 'self'` + `object-src 'none'` + `base-uri 'none'` + `form-action 'none'`; **sem `'unsafe-inline'`**; **sem `'unsafe-eval'`** ✅ |
| **Classificação** | **OK** (limitação de `frame-ancestors` em meta → §5, risco aceito) |

### 2.4 Supply chain — **OK**

| | |
|---|---|
| **Evidência (comando)** | `rg -n 'https?://' index.html css/ js/` (via shell) |
| **Saída real** | *(vazio — zero URLs externas em `index.html`, `css/` e `js/`)* |
| **Evidência npm/CDN** | `git ls-files` → **não existe `package.json` nem lockfile** (`Test-Path package.json` → `False`; `Test-Path package-lock.json` → `False`) → `npm audit`/`pip-audit` **N/A** |
| **Links externos em docs** | apenas em Markdown de documentação (aceitável, não são carregados pelo runtime): `CHANGELOG.md:5-6` (keepachangelog.com, semver.org), `scripts/serve.*` (python.org em **mensagem de texto**, não executado) |
| **Fontes** | `css/styles.css:57` → `/* Tipografia — apenas fonte do sistema (sem CDN, RNF-04) */`; nenhum `@import` real (só comentário em `styles.css:3`) |
| **Classificação** | **OK** — zero dependências = superfície de supply chain nula |

### 2.5 `localStorage` isolado e defensivo — **OK**

| | |
|---|---|
| **Evidência (comando)** | `rg -n 'localStorage' js/` |
| **Saída real** | 5 matches, **todos em `js/theme.js`** (linhas 1, 28, 48, 61, 87) — zero em `app/state/filters/render/utils` ✅ (regra ARCHITECTURE §6.3.5) |
| **try/catch** | escrita: `theme.js:47-51` (`try { localStorage.setItem(...) } catch { warnStorageFailure }`) · leitura: `theme.js:60-66` (`try { getItem } catch { return null }`) ✅ |
| **Validação de enum** | `theme.js:62`: `return value === 'light' \|\| value === 'dark' ? value : null;` — valor fora do enum → `null` → fallback `matchMedia` ✅ (RNF-08) |
| **Fail Fast na borda** | `theme.js:75-79 assertTheme` lança `TypeError` para tema inválido vindo do app (D-14) |
| **Classificação** | **OK** |

### 2.6 Segredos no repositório — **OK**

| | |
|---|---|
| **Evidência (comando)** | `rg -n 'password\|secret\|api[_-]?key\|token\|BEGIN (RSA\|PRIVATE)'` no repo |
| **Saída real** | 13 matches — **todos falso positivo/documentação**: `.gitignore:24` (regra preventiva), `css/styles.css:5` (`tokens` = tokens CSS), `tests/utils.test.mjs:47` (`token` de comparação de string), `docs/*.md` (texto: "nenhum segredo", `:token:` de emote), `validate_data.py:149/674` (variável `token` = emote Discord) |
| **Nenhum valor real** | nenhum match com padrão de chave privada, credencial ou URL com credencial |
| **Segredos em logs/erros** | erros vão para `console.error` com detalhe técnico do `fetch`/`JSON.parse` — **sem token/credencial possível** (não existem) |
| **Classificação** | **OK** |

### 2.7 Arquivos sensíveis / `.gitignore` — **OK**

| | |
|---|---|
| **Evidência (comando)** | leitura de `.gitignore` + `git ls-files` |
| **Saída real `.gitignore`** | `.env` (l.25), `.env.*` (l.26), `!.env.example` (l.27), `node_modules/`, `__pycache__/`, `*.log`, `*.tmp`, `*.bak` ✅ cobre `.env*` |
| **Saída real `git ls-files`** | 27 arquivos rastreados — **nenhum `.env`** (`git ls-files --cached \| findstr /I ".env"` → sem saída, exit 1) ✅ |
| **Observação** | `.vscode/settings.json` está rastreado — só `files.exclude` (sem credencial); inócuo |
| **Classificação** | **OK** |

### 2.8 Scripts de manutenção (`serve.ps1`, `serve.sh`, `validate_data.py`) — **OK** (m1 FECHADO)

| Verificação | Evidência / saída real | Class. |
|---|---|---|
| Command injection no `serve.ps1` | `param([ValidateRange(1,65535)][int]$Port = 8000)` (l.39) → **inteiro tipado**, não string; invocação por array de argumentos `& $nome @argumentos` (l.114) com `Argumentos = @('-m','http.server',$Port)` (l.91) → **nunca interpola em shell** ✅ | **OK** |
| Command injection no `serve.sh` | l.39: `if ! printf '%s' "$PORTA" \| grep -Eq '^[0-9]+$' \|\| [ "$PORTA" -lt 1 ] ...` → **allowlist numérica** antes de uso; l.82: `"$cmd" -m http.server "$PORTA"` **aspas + sem eval** ✅ | **OK** |
| Download remoto nos scripts | `rg -n 'Invoke-WebRequest\|curl \|wget \|Invoke-RestMethod\|urlopen\|requests' scripts/` → **zero**. `npx serve` aparece apenas em **mensagem de texto de ajuda**, nunca é executado pelos wrappers ✅ | **OK** |
| `validate_data.py` — stdlib only | imports (l.35-39): `argparse, json, re, sys, pathlib.Path` — **zero** `subprocess`, `os.system`, `socket`, `urllib` ✅ | **OK** |
| `validate_data.py` — Path seguro | l.45 `ROOT = Path(__file__).resolve().parents[1]`; l.641 `target = Path(args.path) if args.path else DEFAULT_PATH` — caminho vem de **CLI local do próprio mantenedor** (não de input de rede); leitura via `target.read_bytes()` com `try/except FileNotFoundError/OSError` (l.647-654) → falha vira lista de erros, **nunca exceção propagada** ✅ | **OK** |
| **OK (m1 FECHADO) — heredoc QUOTADO no `serve.sh`** | **Evidência:** `grep "<<'EOF'" scripts/serve.sh` → `l.49: # Heredoc QUOTADO (<<'EOF') para nao expandir $RAIZ/$(...) no corpo` + `l.55: cat <<'EOF'` — aspas simples impedem expansão de `$RAIZ`/`$(...)` no corpo; `PORTA` validada (l.39) e `RAIZ` vem de `pwd` | **OK** |

### 2.9 Headers HTTP do servidor local — **RISCO ACEITO** (ver §5)

`python -m http.server` é servidor de arquivos simples: **não permite definir** `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` nem `Content-Security-Policy` por header. A CSP existe como **`<meta>`** (§2.3), que cobre script/style/connect mas **não aceita `frame-ancestors`**. Detalhes e mitigação em §5.

### 2.10 Denial of service / robustez de JSON — **OK**

| | |
|---|---|
| **Evidência (comando)** | leitura de `js/app.js` (`loadItems`, l.239-288) |
| **Saída real** | `file:` → `createLoadError('FILE_PROTOCOL')` (l.241-246) · `fetch` rejeita → `NETWORK` (l.251-253) · `!response.ok` → `NOT_FOUND` (l.255-257) · `JSON.parse` falha → `PARSE` (l.267-271) · envelope errado (`version!==1` / `!Array.isArray`) → `SCHEMA` (l.275-285) · `boot()` tem `try/catch` → `enterErrorState` (l.203-228) → `renderError` com mensagem PT-BR + botão *Tentar novamente* |
| **JSON grande** | sem recursão perigosa: parse é nativo; render usa `DocumentFragment` + `replaceChildren` (1 inserção); sem `innerHTML`. Falha de memória/trava com arquivo gigante é limitada pelo próprio browser e exige arquivo local gigante → **risco aceito e irrelevante** (§5) |
| **Dado corrompido parcial** | `normalizeText` devolve `''` para não-string (utils.js:12-14); `render.js` guarda `typeof` em `name`/`effectText`/`label`/`restrictions`/`modifiers` → card degrada, **nunca lança tela branca**; `parsePrice` (app.js:106-118) descarta não-numérico/negativo |
| **Classificação** | **OK** (RNF-09 satisfeito) |

### 2.11 Clickjacking / `X-Frame-Options` — **RISCO ACEITO** (ver §5)

Sem controle de headers no servidor estático local e `frame-ancestors` indisponível em meta CSP. Um iframe malicioso pode enquadrar a página — **impacto nulo** porque a página não tem ações de valor (sem auth, sem escrita, sem PII, sem formulário submetível: `form-action 'none'`).

### 2.12 Acessibilidade como segurança — **fora do escopo** (conforme instrução da tarefa). Referência apenas: RNF-02 é requisito de produto, tratado pelo frontend/QA.

### 2.13 Auditoria `js/boot-guard.js` (novo, 2026-11-04 — re-check pós-correção) — **OK**

| Verificação | Evidência real (comando → saída) | Class. |
|---|---|---|
| Script **clássico externo** (CSP ok) | `grep '<script' index.html` → `l.11: <script src="js/boot-guard.js"></script>` — **sem `type="module"`, sem inline**; `src` relativo `'self'` → coberto por `script-src 'self'` (§4) | **OK** |
| **Zero `innerHTML`/DOM injection** | `grep 'innerHTML\|outerHTML\|eval\|Function\|document\.write\|insertAdjacent' js/boot-guard.js` → único match é **comentario de proibição** (l.11 `// nenhum inline, nenhum innerHTML/eval`). Escrita real: `l.45 message.textContent = MESSAGE` (texto literal do arquivo) + `setAttribute/removeAttribute('hidden')` (l.34/41/52) | **OK** |
| **Null-tolerante** | leitura integral (64 linhas): `loading !== null` (l.33), `errorBox === null → return` (l.38-40), `message !== null` (l.44), `retry !== null` (l.51) — **nunca lança exceção** com DOM parcial | **OK** |
| **Early-return em não-`file:`** | l.17-19: `if (location.protocol !== 'file:') { return; }` — em `http(s)://` o guard é **no-op** (zero overhead, não disputa com `app.js`) | **OK** |
| **Sem superfície nova** | `grep 'fetch\|XMLHttpRequest\|localStorage\|sessionStorage\|https\?://\|import ' js/boot-guard.js` → só l.11 (comentário) e l.23 (`'...abrir http://localhost:8000'` = **string literal de mensagem**, não URL carregada). **Zero** rede/storage/eval/import | **OK** |
| Semântica do texto | `MESSAGE` (l.21-23) é constante literal no código-fonte; escrita via `textContent` em nó existente (`#state-error p`) → **não é dado de entrada** | **OK** |
| Interação com CSP | nenhum `on*` inline no `index.html`; guard não injeta handler — apenas `hidden` (atributo booleano inócuo) | **OK** |
| **Classificação** | **OK** — 0 achados novos | **OK** |

---

## 3. Teste de XSS (RNF-07) — procedimento de verificação

**Requisito:** RNF-07 — *"renderização escapa HTML dos campos do JSON; item com `<script>` no nome exibe como texto"*.

> O procedimento abaixo foi **transposto para `tests/manual-checklist.md` §12 (RNF-07, itens 12.1–12.7)** pelo `qa-engineer` — achado **m2 FECHADO** (2026-11-04). Este documento permanece como referência de segurança; o checklist é a casa operacional do QA. Verificação: `grep 'RNF-07\|CSP' tests/manual-checklist.md` → l.152 (§12 XSS), l.160 (critério `alert(1)` não executa + CSP sem erro), l.192 (§16 CSP), l.234 (matriz RNF-07 → itens 12.1–12.7).

### 3.1 Procedimento (executar a cada alteração em `render.js` ou no schema)

1. **Backup:** `Copy-Item data/items.json data/items.json.bak`
2. **Injetar payload** no campo `name` do primeiro item do envelope (edição manual, mantendo JSON válido):
   ```json
   { "id": "teste-xss", "name": "<script>window.__xss=1<\/script><img src=x onerror=\"window.__xss=2\">", "category": "bebidas", "subcategory": null, "price": 1, "unit": null, "weightKg": null, "damage": null, "armorClass": null, "strengthReq": null, "effectText": "<b>negrito?</b> & <svg onload=\"window.__xss=3\">", "tags": [] }
   ```
3. **Rodar o validador:** `python scripts/validate_data.py` (espera: falhe ou avise — **isso é desejável**: a regra de dados diz que `name` nunca contém HTML; o validador é a 1ª linha, o render é a 2ª).
4. **Abrir o site** (`.\scripts\serve.ps1` → `http://localhost:8000`) e recarregar (Ctrl+F5).
5. **Critérios de ACEITAÇÃO (todos obrigatórios):**
   - O texto `<script>...` aparece **literal na tela** dentro do `<h3>` (não executa);
   - Nenhum elemento `<script>`/`<img>`/`<svg>` novo existe no DOM (DevTools → Elements);
   - `window.__xss` é `undefined` no Console;
   - `document.querySelectorAll('script').length === 1` (só o `js/app.js`);
   - O mesmo vale para `effectText`, `modifiers[].label`, `restrictions[]`, `tags[]` (repetir injetando em cada campo).
6. **CSP como defesa adicional:** mesmo que algum dia um `innerHTML` fosse introduzido por engano, `script-src 'self'` sem `'unsafe-inline'` bloqueia execução de script injetado → verificar no Console: `Refused to execute inline script...` (violação de CSP).
7. **Restaurar:** `Move-Item -Force data/items.json.bak data/items.json` → recarregar → 50 itens normais.

### 3.2 Verificação estática (roda em qualquer revisão)

```
rg -n 'innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function' js/
→ 2 matches, AMBOS comentários de proibição:
  js/render.js:4 (comentário) · js/boot-guard.js:11 (comentário)  →  VERDE
```

---

## 4. CSP documentada (real, do `index.html`)

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self';
               img-src 'self';
               connect-src 'self';
               object-src 'none';
               base-uri 'none';
               form-action 'none'">
```

| Diretriz | Cobertura no projeto |
|---|---|
| `default-src 'self'` | baseline: nada de origem externa |
| `script-src 'self'` | `<script src="js/boot-guard.js">` (clássico, §2.13) + `<script type="module" src="js/app.js">` + imports ES relativos; **bloqueia inline e `eval`** |
| `style-src 'self'` | único `css/styles.css`; proíbe atributo `style="..."` inline (usar CSSOM/classe) |
| `img-src 'self'` | emojis são **texto** (não `<img>`); qualquer imagem futura deve vir do repo |
| `connect-src 'self'` | `fetch('data/items.json')` (app.js:250) |
| `object-src 'none'` | elimina `<object>/<embed>/<applet>` |
| `base-uri 'none'` | elimina sequestro de `<base>` |
| `form-action 'none'` | não há formulário com submit (RF: página de leitura) |

**Posicionamento:** a meta CSP é a **linha 6 do `index.html`**, antes do `<link>` e do `<script>` — aplicada desde o início do parse. ✅

**Proibido em qualquer evolução:** `'unsafe-inline'`, `'unsafe-eval'`, `data:`/`http:`/`https:` em `script-src`.

### 4.1 Trade-off do flash de tema (ARCHITECTURE §9)

Sem script de boot **inline**, `theme.js` (módulo ES, carrega depois do CSS) aplica `data-theme` após o primeiro paint → o tema salvo pode **piscar** brevemente quando difere do `prefers-color-scheme`. **Mitigação atual:** o CSS padrão segue o tema do sistema, então o flash só ocorre se o usuário **trocou** o tema manualmente antes. **Aceito para o MVP.** Solução futura sem quebrar CSP: `js/theme-boot.js` como `<script>` **clássico e bloqueante** (arquivo externo → continua `'self'`, sem `'unsafe-inline'`). **NUNCA** resolver o flash com inline script — isso anularia a proteção contra injeção (§2.3).

---

## 5. Riscos aceitos (registrados, com justificativa)

| # | Risco | Por que é aceito | Mitigação/alternativa futura | Status |
|---|---|---|---|---|
| A1 | **Sem headers HTTP de segurança** (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `HSTS`, `frame-ancestors`) — `python -m http.server` não os expõe | Uso é **local e single-user**; sem HTTPS não há HSTS; sem ações de valor o impacto de clickjacking/sniffing é nulo | Se um dia expor em rede: servidor com headers custom (ex.: Python com handler que adiciona headers) ou reverse proxy; CSP meta cobre o essencial hoje | ACEITO |
| A2 | **Clickjacking** (iframe da página) | `frame-ancestors` não funciona em meta CSP; **impacto nulo**: sem auth, sem escrita, sem PII, `form-action 'none'` | Header `X-Frame-Options: DENY` quando houver servidor com headers (junto com A1) | ACEITO |
| A3 | **Sem rate limiting** | irrelevante: não há endpoint caro, nem login, nem escrita — tudo roda no browser do próprio usuário | N/A até existir backend (§7.3) | ACEITO |
| A4 | **Servidor local escuta em todas as interfaces por padrão** (`0.0.0.0`) e serve a **raiz do repositório** (incl. `.git/`) | ~~OPEN (MAJOR)~~ → **CORRIGIDO em 2026-11-04 (M1 CLOSED, §8)**: `--bind 127.0.0.1` em `serve.ps1:96-97` e `serve.sh:90` + risco `.git/` documentado em `DEPLOYMENT.md` §8 | Risco residual **aceito**: exposição deliberada fora do loopback (com `--bind 0.0.0.0` de propósito) segue desaconselhada — mitigação alternativa documentada no `DEPLOYMENT.md` §8 (servir de outro diretório) | **MITIGADO (M1 CLOSED)** |
| A5 | **JSON de tamanho absurdo** pode travar parse/render | arquivo é versionado e validado antes do commit; só o mantenedor o altera | validador + revisão; limite de tamanho só faria sentido com servidor público | ACEITO |
| A6 | **Flash de tema** (§4.1) | custo cosmético × benefício de CSP estrita | `theme-boot.js` clássico externo no futuro | ACEITO |

---

## 6. Dependências: **ZERO** (verificação de supply chain)

| Verificação | Comando | Resultado real (2026-11-04) |
|---|---|---|
| Manifestos/lockfiles npm | `Test-Path package.json; Test-Path package-lock.json` | `False` / `False` → **`npm audit` N/A** |
| Arquivos rastreados | `git ls-files` | 27 arquivos — nenhum de lockfile/manifesto |
| URLs externas no runtime | `rg -n 'https?://' index.html css/ js/` | **vazio** |
| CDN/fontes externas | `rg -n 'cdn\|@import\|fonts.googleapis\|unpkg\|jsdelivr\|cdnjs'` | só comentários/documentação (`styles.css:3`, `styles.css:57`, docs) |
| `pip`/Python | `validate_data.py` imports | `argparse, json, re, sys, pathlib` → **stdlib pura** |
| Instalação de dependência | scripts `serve.*` | nenhum `pip install`/`npm install` executado |

**Conclusão:** a melhor mitigação de supply chain está implementada por construção — **não há o que auditar**. Re-auditar apenas se alguém introduzir `package.json`, CDN, `@import` remoto ou fonte web.

---

## 7. Práticas de manutenção segura

### 7.1 Rotina do mantenedor (pré-commit)

1. `python scripts/validate_data.py` — schema, enums, ids únicos, `price ≥ 0`, emotes residuais (**linha de defesa 1**).
2. Testes: `node --test`.
3. **Nunca commitar segredo** — `.env*` já está no `.gitignore`; se um dia existir segredo real, ele vive fora do git (secret manager/variável de ambiente) e é rotacionado.
4. Revisão por grep de segurança antes do merge (§3.2 + `rg -n 'localStorage' js/` → só `theme.js`).

### 7.2 Regras ao adicionar funcionalidade (obrigatórias)

- **Dado do JSON (ou de input) sempre vira texto:** `textContent` / `createElement` / `classList.add`. **Proibido:** `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, template string injetada em HTML, `eval`, `new Function`, `setTimeout("string")`, atributo `style="..."` inline, `href`/`src` montado com dado livre, `javascript:` em qualquer lugar.
- **`localStorage` só em `theme.js`**, com `try/catch` em leitura **e** escrita e validação do valor contra o enum.
- **Sem CDN, sem npm, sem `@import` remoto, sem fonte web** — só arquivo local do repo (RNF-04/offline).
- **CSP intacta:** nenhuma diretiva `'unsafe-inline'`/`'unsafe-eval'`; nenhum `<script>` inline nem atributo `on*` no HTML.
- **Novo script executável:** input validado com allowlist (número/caminho resolvido), sem interpolação em shell, sem download remoto — mesmo padrão de `serve.sh:39`.
- **Novo campo no JSON:** entrar no `validate_data.py` **e** no render com guard de tipo (`typeof`), nunca direto no HTML.

### 7.3 Gatilhos que exigem NOVA revisão de segurança (não coberta por este documento)

- Qualquer **backend/API/framework**, mesmo local;
- **Deploy fora de localhost** (GitHub Pages, nuvem, LAN) → headers por servidor, HTTPS/HSTS, revisão de A1/A2;
- **Auth, formulários com submit, upload de arquivo, `postMessage`, `iframe` de origem externa, Web Workers com import remoto**;
- Introdução de **`package.json`/build/CDN** → auditoria de dependências (`npm audit`) obrigatória.

---

## 8. Achados da auditoria T-21 (2026-11-04)

> Classificação: `BLOQUEANTE | MAJOR | MINOR | OK`. **Nenhum BLOQUEANTE** → desenvolvimento não foi interrompido.

### `[MAJOR]` Servidor local publica a raiz do repositório (incl. `.git/`) em todas as interfaces
- **Local:** `scripts/serve.ps1:91` · `scripts/serve.sh:82` · `docs/DEPLOYMENT.md:138`
- **Cenário de exploração:** `python -m http.server` (sem `--bind`) escuta em `0.0.0.0` e serve **todo o repositório**. Na mesma LAN, um atacante acessa `http://<ip-da-vítima>:8000/.git/` e baixa histórico/objetos git; via **DNS rebinding**, uma página visitada pelo mantenedor resolve para `127.0.0.1` e lê os mesmos arquivos same-origin. O `DEPLOYMENT.md:138` já documenta o risco de LAN, mas **não** a exposição de `.git/` nem a correção por `--bind`.
- **Remediação:** adicionar `--bind 127.0.0.1` ao `python -m http.server $Port --bind 127.0.0.1` em `serve.ps1` e `serve.sh` (e documentar no `DEPLOYMENT.md` a alternativa `npx serve --listen 127.0.0.1:3000`); alternativa adicional: servir apenas os diretórios públicos (`index.html`, `css`, `js`, `data`).
- **Dono:** `devops-engineer` (eu não altero arquivos de outros donos — regra da tarefa).
- **Status:** **CLOSED (2026-11-04)** — evidência do re-check:
  - `grep --bind 127.0.0.1 scripts/` → **10 matches nos 2 arquivos**: `serve.sh:90` (`"$cmd" -m http.server "$PORTA" --bind 127.0.0.1` — execução real) e `serve.ps1:96-97` (`Argumentos = @('-m','http.server',$Port,'--bind','127.0.0.1')` em **ambos** os candidatos `python`/`py`).
  - `docs/DEPLOYMENT.md` **§8 "Segurança operacional"** → l.203 documenta o risco `.git/` (LAN + DNS rebinding) + **"Recomendação: não expor"**; l.204-207 lista as alternativas (`--bind 0.0.0.0` deliberado / servir de outro diretório / firewall); l.202 registra a correção; l.193 no smoke test exige banner com `--bind`.
  - Smoke real registrado no `DEPLOYMENT.md` §4.2 (2026-11-04): subida Windows (`serve.ps1 -Port 8124`) e Git Bash (`serve.sh 8125`) com log `--bind 127.0.0.1`.

### `[MINOR]` `serve.sh` usa heredoc não-quotado (`cat <<EOF`) expandindo `$RAIZ`
- **Local:** `scripts/serve.sh:48-59`
- **Cenário:** nome de diretório contendo `$(...)`/`` ` `` no caminho do repo seria executado na expansão do heredoc. Porta já é validada (l.39); exige path malicioso local → probabilidade muito baixa.
- **Remediação:** citar o heredoc (`cat <<'EOF'`) e passar valores por variáveis já validadas fora dele, ou usar `printf`.
- **Dono:** `devops-engineer` · **Status:** **CLOSED (2026-11-04)** — evidência: `grep "<<'EOF'" scripts/serve.sh` → `l.49` (comentário de intenção) + `l.55: cat <<'EOF'` (heredoc **quotado**, sem expansão de `$RAIZ`/`$(...)`).

### `[MINOR]` Procedimento de teste RNF-07 (XSS) sem casa no checklist de QA
- **Local:** `tests/manual-checklist.md` (**arquivo inexistente** — previsto em ARCHITECTURE §4)
- **Cenário:** sem passos de teste de XSS/CSP no checklist, uma regressão em `render.js` poderia passar despercebida em revisões manuais.
- **Remediação:** incorporar o procedimento da §3 deste documento ao `tests/manual-checklist.md` (item "Segurança: XSS via JSON + CSP ativa sem erros de console").
- **Dono:** `qa-engineer` · **Status:** **CLOSED (2026-11-04)** — evidência: `tests/manual-checklist.md` **existe**; `grep 'RNF-07\|CSP'` → l.152 **§12 RNF-07 — Segurança / XSS via JSON** (itens 12.1–12.7 com backup/reversão e critério `alert(1)` NÃO executa + CSP sem erro no console, l.160), l.192 **§16 CSP** (4 itens: zero violação, meta presente sem `'unsafe-inline'`, sem atributo inline, zero requisições externas), l.234 matriz `RNF-07 | 12.1–12.7`.

### `[MINOR]` Meta CSP não cobre `frame-ancestors` → clickjacking sem defesa de header
- **Local:** `index.html:6`
- **Cenário:** iframing da página possível; impacto nulo hoje (§5 A2) porque não há ações sensíveis.
- **Remediação:** manter como risco aceito até h servidor com headers; ao adotar servidor custom, emitir `X-Frame-Options: DENY` + `frame-ancestors 'none'`.
- **Dono:** `devops-engineer` (quando aplicável) · **Status:** **ACEITO (mantido)** — registrado em §5 A1/A2; sem mudança nesta rodada (servidor segue sem headers custom; impacto nulo por não haver ações sensíveis)

### Achados `OK` (verificados com evidência na §2)
`OK` XSS via JSON (§2.1) · `OK` injeção de código/`javascript:` (§2.2) · `OK` CSP conforme ARCHITECTURE §9 (§2.3) · `OK` supply chain zero dependências (§2.4/§6) · `OK` `localStorage` isolado+try/catch+enum (§2.5) · `OK` segredos ausentes (§2.6) · `OK` `.gitignore .env*` + nenhum `.env` rastreado (§2.7) · `OK` scripts sem command injection/download remoto/Path seguro + heredoc quotado (§2.8) · `OK` robustez JSON → estado de erro, nunca tela branca (§2.10) · `OK` `boot-guard.js` sem superfície nova (§2.13).

### Resumo do re-check pós-correção (2026-11-04)

| Achado | Antes | Depois | Evidência do fechamento |
|---|---|---|---|
| **M1** bind `0.0.0.0` + `.git/` exposto | MAJOR OPEN | **CLOSED** | `grep --bind 127.0.0.1 scripts/` → 10 matches nos 2 wrappers (`serve.ps1:96-97`, `serve.sh:90`); `DEPLOYMENT.md` §8 l.203 documenta `.git/` + "não expor" |
| **m1** heredoc não-quotado | MINOR OPEN | **CLOSED** | `serve.sh:55 cat <<'EOF'` |
| **m2** checklist RNF-07 inexistente | MINOR OPEN | **CLOSED** | `tests/manual-checklist.md` §12 (l.152-164) + §16 CSP (l.192-199) |
| **m3** clickjacking (meta CSP sem `frame-ancestors`) | MINOR aceito | **ACEITO (mantido)** | §5 A1/A2 — risco aceito com justificativa |
| **Novo:** `js/boot-guard.js` | — | **OK (0 achados)** | auditoria §2.13 — textContent, null-tolerante, early-return, sem rede/storage/eval |

---

## 9. Registro de auditorias

### 9.1 Auditoria inicial (T-21 + T-22) — 2026-11-04

| Campo | Valor |
|---|---|
| **Data** | 2026-11-04 |
| **Auditor** | Senior Application Security Engineer (T-21 + T-22) |
| **Escopo** | `index.html`, `js/*.js` (6 módulos), `css/styles.css`, `data/items.json`, `scripts/*.ps1`, `scripts/*.sh`, `scripts/validate_data.py`, `.gitignore`, superfície de rede local |
| **Método** | Revisão estática com greps/literais + leitura de código + verificação de rastreamento git (evidências reais na §2/§8) |
| **Achados** | **0 BLOQUEANTE · 1 MAJOR (M1) · 3 MINOR (m1/m2/m3) · 10 OK** |
| **Resultado** | **APROVADO COM RESSALVAS** — nenhum bloqueio de desenvolvimento; o MAJOR (bind do servidor) foi para o `devops-engineer` |

### 9.2 Re-check pós-correção + auditoria de arquivos novos — 2026-11-04

| Campo | Valor |
|---|---|
| **Data** | 2026-11-04 |
| **Auditor** | Senior Application Security Engineer (re-check) |
| **Gatilho** | Correções de `devops-engineer` (M1/m1), `qa-engineer` (m2), `frontend-engineer` (novo `js/boot-guard.js` + `index.html`) |
| **Escopo novo** | `js/boot-guard.js` (64 linhas, leitura integral), `index.html` atualizado, `tests/manual-checklist.md`, `scripts/serve.ps1`, `scripts/serve.sh`, `docs/DEPLOYMENT.md` §8 |
| **Método** | Greps de evidência + leitura de código arquivo a arquivo + comparação da CSP com ARCHITECTURE §9 |
| **Achados** | **0 BLOQUEANTE · 0 MAJOR aberto (M1 FECHADO) · 0 MINOR aberto (m1/m2 FECHADOS, m3 aceito) · 11 OK** |
| **Resultado** | **APROVADO COM RESSALVAS** — ressalva única: riscos aceitos A1/A2/A3/A5/A6 da §5 (clickjacking/headers/rate-limit/JSON grande/flash de tema), todos documentados com justificativa |

**Evidências do re-check (comandos → saída real):**

| # | Verificação | Comando | Saída |
|---|---|---|---|
| 1 | M1: bind nos 2 wrappers | `grep --bind 127.0.0.1 scripts/` | 10 matches — `serve.ps1:96/97` (array de args nos 2 candidatos) + `serve.sh:90` (execução) |
| 2 | M1: `.git/` documentado | `grep '\.git/\|bind' docs/DEPLOYMENT.md` | §8 l.202-207: risco `.git/`, "Recomendação: não expor", alternativas; smoke §4.2 l.124-136 |
| 3 | m1: heredoc quotado | `grep "<<'EOF'" scripts/serve.sh` | l.49 comentário + l.55 `cat <<'EOF'` |
| 4 | m2: checklist existe | `grep 'RNF-07\|CSP' tests/manual-checklist.md` | l.152 §12 XSS (12.1–12.7), l.160 critério `alert(1)`, l.192 §16 CSP, l.234 matriz |
| 5 | boot-guard: superfície | `grep 'innerHTML\|eval\|fetch\|localStorage\|https?://' js/boot-guard.js` | só l.11 (comentário de proibição) + l.23 (string literal da mensagem) |
| 6 | index.html: scripts | `grep '<script' index.html` | l.11 guard **antes** do l.12 module; ambos com `src`, zero inline |
| 7 | index.html: handlers inline | `grep 'on[a-z]+=\|style=\|javascript:' index.html` | 0 handlers reais (só falso positivo em `content=` dos `<meta>`) |
| 8 | CSP intacta vs ARCHITECTURE §9 | leitura `index.html:6` × `ARCHITECTURE.md:473-481` | **idêntica**: 8 diretivas, `'self'` nas 5 de origem, sem `'unsafe-inline'`/`'unsafe-eval'` |

**Conclusão do re-check:** nenhum achado novo; M1/m1/m2 fechados com evidência; m3 permanece aceito; `boot-guard.js` e `index.html` aprovados (§2.13).
