# REGRESSION.md — Relatório de regressão automatizada (T-20 parcial)

> **Projeto:** `lojinha-de-precos` · **Dono do arquivo:** `qa-engineer` · **Data de execução:** 2026-11-04 (re-execução)
> **Ambiente:** Windows 11 · Node **v24.21.0** · Python **3.12.10** (`py` launcher) · navegador não disponível neste ambiente (testes de UI ficam no checklist manual)
> **Escopo:** apenas o que é executável sem browser — suíte `node --test`, validador de dados, checagens estáticas de segurança/front, smoke do servidor, verificação do guard em `node:vm` e teste de bind. **Nenhum arquivo de código/dado/doc foi alterado.**
> **Mudanças cobertas nesta rodada:** (1) **novo** `js/boot-guard.js` + tag `<script src="js/boot-guard.js">` em `index.html` antes do módulo; (2) wrappers `scripts/serve.ps1` / `serve.sh` agora com `--bind 127.0.0.1` (**SECURITY.md M1**).

---

## 1. Resumo executivo

```
TESTS
━━━━━━━━━━━━━━━━━━━━
Unit:        68 pass / 0 fail   (node --test — módulos puros utils/state/filters + fixtures)
Integration:  0 pass / 0 fail   (não aplicável: sem backend/BD — camada de dados é JSON estático)
API:          0 pass / 0 fail   (não aplicável: sem API — escopo Out, REQUIREMENTS §3)
E2E:          0 pass / 0 fail   (não executável aqui: sem browser → coberto por tests/manual-checklist.md)

Validador:   exit 0 — "OK: 50 itens validados, 0 erros, 0 avisos."
Estático:    9 verificações — 9 OK, 0 falha
Guard (vm):  5 cenários — 5 OK (file:// → estado de erro; http:// → neutro; null-tolerante)
Smoke HTTP:  6 requisições — 6 OK (200/200/200/200/200/404 esperado)
Bind M1:     localhost → 200 · 127.0.0.1 → 200 · IP da LAN (192.168.1.11) → RECUSADO
```

**Veredito: VERDE.** Nenhum achado BLOQUEANTE ou MAJOR nesta rodada.

---

## 2. Suíte automatizada — `node --test`

**Comando:** `node --test` (D-18: sem caminho de diretório)
**Exit code:** `0`

```
ℹ tests 68
ℹ suites 0
ℹ pass 68
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 912.2947
```

**68 pass / 0 fail — 100% verde.** Cobertura por arquivo (nomes reais dos testes):

| Arquivo | Testes | O que protege |
|---|---|---|
| `tests/filters.test.mjs` | **42** (3 são testes de fixtures) | fixtures sem estado compartilhado (6 categorias, empate de preço, `price 0`), RF-03 (normalização/`pocao`→Poção/`sko`→Skooma), RF-04 (faixa inclusiva, mín>máx → `[]`, `null` = sem limite, `priceMin 0`), RF-06, RB-10 (AND dos 4 filtros), RB-11 (desempate), D-5/D-17 (agrupado/plano), D-14 (Fail Fast), performance com 5.000 itens |
| `tests/state.test.mjs` | **14** | imutabilidade do `setState` (D-16), estado inicial/erro/loading, enum de 5 sorts (D-4), `isValidSort`, `initialFilters` independente |
| `tests/utils.test.mjs` | **12** | `normalizeText` (NFD, acento/caixa), `formatPrice` (RB-01/RB-02), `CATEGORY_ORDER`/labels PT-BR (D-9), `debounce` 200 ms |
| **Total** | **68** (12 + 14 + 42) | `tests/fixtures.mjs` só fornece dados — os testes dele rodam dentro de `filters.test.mjs` |

> Observação de cobertura: **não há teste automatizado de DOM** (render/theme/app) — decisão D-8: só funções DOM-free são testáveis no Node. A validação desses módulos é **manual** → `tests/manual-checklist.md` (seções 1, 6, 7, 8, 12–17). **Única exceção parcial:** `js/boot-guard.js` recebeu verificação lógica fora do navegador (execução real em `node:vm` com stub de DOM → §4.9) — mas **sem** a CSP nem o bloqueio de módulo reais do browser → checklist **15.x**.

## 3. Validador de dados — `py scripts/validate_data.py`

**Comando:** `py scripts/validate_data.py`
**Exit code:** `0`

```
OK: 50 itens validados, 0 erros, 0 avisos.
```

Confere com o §7 dos requisitos (12+6+5+10+8+9 = **50**, D-13).

## 4. Checagens estáticas do front (executadas agora)

| # | Verificação | Comando / método | Resultado REAL | Status |
|---|---|---|---|---|
| 4.1 | `innerHTML` / `eval(` / `new Function` / `insertAdjacentHTML` / `document.write` / `setTimeout(string)` em `js/` | regex sobre os **7** módulos (`utils/theme/state/render/filters/boot-guard/app`) | **Zero uso real.** **2** ocorrências textuais, ambas em **comentário** → aceitas: `js/render.js:4` (`// …innerHTML/insertAdjacentHTML/eval proibidos;`) e `js/boot-guard.js:11` (`// nenhum inline, nenhum innerHTML/eval (textContent/createElement apenas).`) | ✅ |
| 4.2 | `localStorage` fora de `theme.js` | regex em `js/*.js` | **Apenas `js/theme.js`** (5 linhas: 1 cabeçalho, 28 JSDoc, 48 `setItem`, 61 `getItem`, 87 `console.warn`). Zero `sessionStorage`/`indexedDB` no projeto · `boot-guard.js` **sem** storage | ✅ |
| 4.3 | Recursos externos (`https?://`, CDN, fontes, `url()`, `@import`) em `index.html`, `css/` e `js/` | regex nos 3 alvos | `index.html` → **0** · `css/*.css` → **0** (sem `url(...)`, sem `@import`) · `js/` → **1**: `js/boot-guard.js:23` `'Rode: py scripts/serve.ps1 — e abra http://localhost:8000'` — **string literal de mensagem** atribuída via `textContent`, **não** é recurso carregado (zero `fetch`/`link`/`@import` apontando para fora) → **aceito**. Único `fetch` do projeto: `js/app.js:250 fetch('data/items.json')` (**relativo**) | ✅ |
| 4.4 | Meta CSP presente e intacta | leitura de `index.html` (l.6) | **PRESENTE e IDÊNTICA ao esperado** — `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'` (**sem `'unsafe-inline'`**) | ✅ |
| 4.5 | Atributos inline (`style=`, `onclick=`, demais `on*=`) e `<script>` sem `src` em `index.html` | regex | **Zero** atributos event/style inline · **2** tags `<script>` — `l.11: <script src="js/boot-guard.js">` (clássico) e `l.12: <script type="module" src="js/app.js">` — **ambas com `src` relativo**, nenhuma inline | ✅ |
| 4.6 | IDs usados nos módulos existem no `index.html` | extração cruzada (`byId`/`getElementById`/`setVisible`/`setControlValue`/`querySelector('#…')`), comentários removidos antes de contar | 16 IDs no HTML · **15** referenciados no JS · **MISSING: (nenhum)** · não referenciado: apenas `#results` (contêiner estático esperado — sem ação). **Novo:** `boot-guard.js` → `state-loading`, `state-error` (ambos existem ✅); `render.js` → `item-list, result-count, state-empty, state-error, state-loading, subcategory`; `app.js` → 10 IDs de filtro/tema | ✅ |
| 4.7 | `theme.js` defensivo (RNF-08) | leitura de `js/theme.js` | `try/catch` em leitura (l.63) **e** escrita (l.49): **SIM** · validação do enum com `TypeError` (D-14, l.77): **SIM** · aviso único de storage (l.87): **SIM** | ✅ |
| 4.8 | Sem handlers/CSP-breaking em `css/styles.css` | varredura de `@media`, `:focus-visible`, `data-theme` | `:focus-visible` (l.635 e l.331/332) · `--control-min-h: 44px` (l.69, RNF-03) · tokens `[data-theme]` + `prefers-color-scheme` (l.94/102, RF-07) · `prefers-reduced-motion` (l.644) | ✅ |
| 4.9 | **Novo** `js/boot-guard.js`: superfície e comportamento | leitura + execução real em `node:vm` com mini-DOM stub (5 cenários) | **Superfície:** script **clássico** (sem `type="module"`, sem `import`), coberto por `script-src 'self'`; escrita só via `textContent`/`setAttribute('removeAttribute')('hidden')`; **null-tolerante**; sem rede/storage/eval. **Comportamento (saída real):** `file:` → `#state-error` visível com mensagem citando `py scripts/serve.ps1` **e** `http://localhost:8000`, `#state-loading` e `#retry` ocultos · `http:` → **early-return, zero toque no DOM** (0 listeners registrados) · caminho real `readyState='loading'` (script no `<head>`) → listener `DOMContentLoaded` registrado e dispara corretamente · sem `#state-error` / sem nenhum elemento → **não lança exceção**. `ASSERT GUARD: OK` (exit 0) | ✅ |

## 5. Smoke do servidor (RF-15 / RNF-04) + bind de segurança (M1)

**Comando:** `py -3 -m http.server <porta> --bind 127.0.0.1` na raiz do projeto (mesma linha de comando que os wrappers `scripts/serve.ps1`/`serve.sh` agora executam — `serve.ps1:96-97`, `serve.sh:90`). Portas usadas: 8137 (bind) e 8138 (requisições), para não conflitar com a porta 8000 do mantenedor.

| Requisição | Resultado REAL |
|---|---|
| `GET /index.html` | **HTTP 200** — **4.452 bytes** (subiu de 4.308: novo `<script src="js/boot-guard.js">` + comentário l.10) |
| `GET /data/items.json` | **HTTP 200** — 22.497 bytes · `version=1`, `itens=50` |
| `GET /js/boot-guard.js` | **HTTP 200** — 2.539 bytes (script clássico servido por HTTP ✅) |
| `GET /js/app.js` | **HTTP 200** — 15.090 bytes (módulo ES servido por HTTP ✅) |
| `GET /css/styles.css` | **HTTP 200** — 17.054 bytes |
| `GET /data/nao-existe.json` | **HTTP 404** esperado (base do teste RNF-09/14.x) |

### 5.1 Evidência do bind (`--bind 127.0.0.1` — SECURITY.md M1)

IP da LAN da máquina: **192.168.1.11** (testado em 2026-11-04).

| Alvo | Resultado REAL |
|---|---|
| `http://localhost:8137/index.html` | **HTTP 200** (4.452 bytes) ✅ |
| `http://127.0.0.1:8137/data/items.json` | **HTTP 200** ✅ |
| `http://192.168.1.11:8137/index.html` | **RECUSADO** — "Impossível conectar-se ao servidor remoto" ✅ (esperado M1) |
| TCP `127.0.0.1:8137` | `TcpTestSucceeded = True` |
| TCP `192.168.1.11:8137` | `TcpTestSucceeded = False` — **a porta não escuta na interface de LAN** |
| Liberação de porta após `Stop-Process` | Porta **livre** (`True`) — nenhum processo órfão |

**Conclusão M1:** a exposição via LAN está **fechada** na porta de teste. Regressão coberta: se alguém remover o `--bind 127.0.0.1` de um wrapper, a linha "Escuta: somente 127.0.0.1" do banner some e o TCP da LAN passa a dar `True` → o passo **9.6** do checklist manual detecta a regressão em navegador.

Log do servidor confirmado e processo encerrado ao final (porta liberada).

## 6. Conferência numérica dos dados usados no checklist (T-19)

Executada contra `data/items.json` real para garantir que os **números esperados do checklist manual não são inventados**:

| Verificação | Resultado REAL |
|---|---|
| Total e por categoria | 50 · bebidas 12 · refeições 6 · pousada 5 · poções 10 · armas 8 · armaduras 9 |
| Subcategorias de armas | simples 2 · **marciais 4** · versáteis 2 (D-13 ✅) |
| Subcategorias de armaduras | leves 3 · médias 2 · pesadas 3 · escudo 1 |
| Busca `sko` | 1 → `Skooma` |
| Busca `pocao` | **9** itens (Elixir da Vida não casa ✅) |
| Faixa 5–15 PO | **20 itens** ✅ |
| Busca `pocao` ∩ faixa 5–15 (RB-10) | **3** (Cura Menor 5, Básica 10, Comum 15) |
| Busca `xyz` | **0** → estado vazio |
| Itens com preço ≤ 0 | **0** (menor preço do catálogo = 1 PO) — ver achado MINOR §7 |
| Empate de 1 PO em `price-asc` | 5 itens → ordem por nome: Cerveja Comum, Chá Gelado de Ervas, Copo de Leite, Refeição Simples, Suco de Fruta Fresca |
| Maior preço | Armadura de Placas = 150 PO |
| Nome A→Z / Z→A | primeiro `Arma Marcial 1d10` / último `Vinho de Boa Qualidade` |
| Skooma | `modifiers` = `[{+1, For/Dex/Con}, {-1, Int/Sab/Car}]` · tags `droga, bonus, malus, descanso-curto` ✅ RF-09 |
| Armadura de Placas | CA 18 · FOR 15 · 50 kg ✅ RF-08/US-06 |
| Elixir da Vida | `restrictions` = `["não acumulativo", "cura total"]` · tag `descanso-longo` ✅ RB-05 |
| Pousada | 5/5 itens com `unit: "por noite"` ✅ RB-02 |
| Tônica dos Magos | `modifiers` = `[{+1, Concentração/Percepção}]` · tag `descanso-curto` ✅ |
| Emotes `:Emote:` residuais | **0** (RF-14 ✅) |

---

## 7. BUGS FOUND

```
BUGS FOUND
━━━━━━━━━━━━━━━━━━━━
(1 MINOR novo · 2 MINOR herdados · 2 PENDENTES de browser · nenhum BLOQUEANTE/MAJOR confirmado)
```

- **[MINOR] (novo) Mensagem do guard é Windows-only** — `js/boot-guard.js:21-23` (dono: responsável por `js/boot-guard.js` — **não mapeado explicitamente no plano** → rotear via Tech Lead; provável par `frontend-engineer`/`backend-engineer`, donos do achado FILE_PROTOCOL) — o texto cita **apenas** `py scripts/serve.ps1`, mas o projeto publica também `scripts/serve.sh` (macOS/Linux — checklist 9.1) e a alternativa `npx serve`. **Impacto:** usuário em macOS/Linux recebe um comando que não existe na máquina dele. **Mesmo texto** já existe em `js/render.js:55` (`FILE_PROTOCOL`) → é inconsistência **herdada, não regressão**. **Não corrigido aqui** (arquivo alheio); pedido: acrescentar `./scripts/serve.sh` como alternativa na string. Baixo esforço, zero risco de comportamento.
- **[MINOR]** *Teste de "preço 0 aceito" (RF-04) não tem item de preço 0 no catálogo* — `data/items.json` (dono: `database-engineer`) — o menor preço é 1 PO. **Impacto:** o caso de teste 4.4 do checklist só valida que o input aceita `0` e que o filtro não restringe; a borda "item de 0 PO aparece com `min=0`" é coberta **somente** pelos testes de unidade (`filters.test.mjs` usa fixtures com `price 0`). **Não é bug de código** — é lacuna de dado aceitável. Sem ação necessária; se algum dia existir item gratuito, o teste manual passa a valer.
- **[MINOR]** *ID `#results` do `index.html` não é referenciado por nenhum módulo* — `index.html` (dono: `frontend-engineer`) — contêiner estático dos 4 estados, manipulado indiretamente pelos filhos (`#state-loading`, `#state-empty`, `#state-error`, `#item-list`). **Comportamento esperado, sem efeito funcional.** Registrado apenas para rastreabilidade; **nenhuma correção pedida**.
- **[PENDENTE — verificação manual]** *Mensagem `FILE_PROTOCOL` pode ser inalcançável em `file://`* — `js/app.js` + `js/render.js` (dono: `backend-engineer`/`frontend-engineer`) — se o navegador bloquear o próprio `<script type="module">` via `file://` (CORS de origin `null`, Chrome/Firefox), `app.js` nunca executa e o usuário ficava preso em "Carregando itens…". **→ MITIGADO em 2026-11-04 pelo novo `js/boot-guard.js`** (script clássico no `<head>`, roda onde o módulo não roda; comportamento verificado de verdade em `node:vm` → §4.9: `file:` mostra `#state-error` com orientação e esconde `#retry`; `http:` é early-return). **Continua pendente de confirmação em navegador real** → checklist **15.1–15.6**. Se em navegador o usuário ainda ficar em "Carregando itens…" eterno → reclassificar como **MAJOR** e abrir achado para o dono de `js/boot-guard.js` (não alterar código aqui).
- **[PENDENTE — verificação manual]** *CSP `script-src 'self'` pode bloquear o próprio guard em `file://`* — `index.html` l.6 (dono: `frontend-engineer`) + `js/boot-guard.js` — hipótese **não confirmada** (sem browser nesta rodada; busca externa indisponível): em `file://` a origem é opaca e há relatos de implementações em que `'self'` **não** casa com URLs `file:`, o que produziria `Refused to load the script … script-src 'self'` — o guard não rodaria e o usuário voltaria ao loading eterno, anulando a correção acima. **Não é bug confirmado**; é a primeira coisa a olhar no Console. **Se confirmado → MAJOR** (o guard deixa de proteger exatamente o cenário para o qual foi criado); correção seria dono do `index.html`/`security-engineer` — avaliar `script-src 'self'` compatível com `file:` **sem** ceder `'unsafe-inline'`/`'unsafe-eval'`. Capturado pelo passo **15.3** do checklist.

## 8. COVERED SCENARIOS

- **Positivo:** boot com 50 itens, contagem, agrupamento D-5/D-17, AND dos filtros, faixa inclusiva, ordenação com desempate, labels PT-BR, tema, validador de dados, HTTP 200 (6 requisições incl. `boot-guard.js`).
- **Negativo:** busca sem match → `[]`; mín>máx → `[]`; entradas inválidas → `TypeError` (D-14); JSON/HTTP ausente → estados de erro (unitário + smoke 404); **guard em `file://` → estado de erro em vez de loading eterno**; **guard sem os elementos do DOM → não lança exceção** (null-tolerante).
- **Extremo:** `priceMin 0`, `null` como limite, string vazia na busca, 5.000 itens (performance), sort fora do enum, `modifiers`/`restrictions` malformados (fixtures), entrada não-array; guard com `readyState='loading'` (script no `<head>` → caminho `DOMContentLoaded`).
- **Segurança (estático):** zero `innerHTML`/`eval`/`new Function`/`setTimeout(string)`; `localStorage` isolado em `theme.js`; CSP meta sem `'unsafe-inline'` e **inalterada** após o novo `<script>`; zero recursos externos (o único `http://` do repo é **texto de mensagem** em `boot-guard.js:23`, via `textContent`); zero handlers inline; IDs consistentes (15/16, sem MISSING). **Segurança de rede (M1):** servidor responde só em loopback — **IP da LAN recusado** (TCP `False`).
- **Performance:** teste com 5.000 itens (< 8,1 ms) + debounce 200 ms testado; render real < 100 ms (RNF-01) **não medido aqui** → manual. Guard em `http://`: **zero trabalho** (early-return no topo do IIFE, 0 listeners registrados, 0 mutações de DOM — medido no cenário B do §4.9).

## 9. NOT COVERED

| Item | Motivo |
|---|---|
| E2E em navegador (render/theme/app.js, a11y, responsividade, CSP em runtime, XSS dinâmico, `file://`, offline) | Sem browser neste ambiente; dependência D-8 (DOM fora do `node:test`). Coberto por `tests/manual-checklist.md` (17 seções) |
| **Comportamento do `boot-guard.js` em navegador real (incl. recusa de CSP em `file://`)** | O `node:vm` prova a lógica, **não** a política de CSP do browser nem o bloqueio real de módulo ES em `file://` → checklist **15.1–15.6** (§7, 2 pendentes) |
| **Bind na prática a partir dos wrappers** (`serve.ps1`/`serve.sh` em execução) | Este relatório testou a **linha de comando equivalente** (`py -3 -m http.server --bind 127.0.0.1`); a passagem do `--bind` pelos wrappers foi confirmada por grep (`serve.ps1:96-97`, `serve.sh:90`) → checklist **9.1 + 9.6** para o caminho completo |
| Integração/API | Sem backend/API por decisão do escopo (REQUIREMENTS §3 Out) — não há o que testar nesses níveis |
| Compatibilidade de navegadores (RNF-06) | Exige execução em Chrome/Edge/Firefox/Safari → checklist P3 |
| Contraste WCAG AA real (RNF-02) | Ferramenta de medição de contraste exige render do browser → checklist 10.6 |
| Persistência do tema em runtime (RF-07) | `localStorage` só existe no browser → checklist 6.x |

## 10. RISKS

1. **Zero cobertura automatizada de DOM** — qualquer regressão em `render.js`/`app.js`/`theme.js`/`boot-guard.js` só aparece no checklist manual, que é lento e sujeito a omissão do executor. *Mitigação:* checklist com números exatos (§6) + rodada obrigatória antes do gate T-25. **Novo:** o guard ganhou verificação lógica em `node:vm` (§4.9), mas o **DOM real** continua sem automação.
2. **`file://` é o primeiro contato do usuário** e agora depende de **duas** hipóteses não confirmadas em navegador: (a) o guard executa de fato, (b) a CSP `script-src 'self'` não o bloqueia em origem opaca (§7, 2 pendentes → checklist 15.1–15.6). Se qualquer uma falhar, o usuário volta ao loading eterno.
3. **Guard × `app.js` podem disputar o mesmo estado em `file://`** — em navegadores que *permitem* módulo ES em `file://`, `renderError('FILE_PROTOCOL')` do `app.js` (async, pós-fetch) sobrescreve a mensagem do guard; o estado final continua sendo erro PT-BR (aceitável, checklist 15.4), mas o **texto exato** fica indefinido. *Mitigação:* 15.4 manda registrar qual apareceu.
4. **Teste XSS exige mutar `data/items.json` temporariamente** — se a execução for interrompida no meio, o JSON fica com item-lixo e o validador passa a falhar (a seção 12 exige backup + reversão + revalidação).
5. **Suíte verde ≠ produto verde:** 68 testes cobrem a lógica pura; os requisitos RF-07/RF-08/RF-09/RF-10/RF-11 na tela dependem 100% do manual.
6. **Ambiente único (Windows/Node 24):** não há evidência de execução em macOS/Linux (`serve.sh`) nem em outros runtimes de Node — o M1 foi validado apenas no IP IPv4 desta máquina (`192.168.1.11`); outros cenários (IPv6 `::1`, VPN, Docker) não testados.

## 11. Próximos passos (T-20 completo)

1. Executor humano roda `tests/manual-checklist.md` em navegador real e preenche as colunas de status — **prioridade: 15.1–15.6 (guard em `file://`), 9.6 (M1 na LAN) e 9.7 (guard neutro em `http://`)**.
2. Classificar os **2 pendentes** do §7 (FILE_PROTOCOL mitigado + CSP em `file://`) a partir dos passos 15.3/15.5.
3. Encaminhar o **[MINOR] mensagem Windows-only** do guard ao dono de `js/boot-guard.js` (+ o `render.js:55` homólogo).
4. Rodar a auditoria de segurança T-21 (`security-engineer`) e o smoke de infra T-08 (`devops-engineer`) — a re-verificação de M1 pós-correção já está registrada em `SECURITY.md` §8/§9.1.
5. Reexecutar **tudo** (`node --test` + validador + estáticos + checklist) após qualquer correção de achado (PLAN §6, passo 5).
