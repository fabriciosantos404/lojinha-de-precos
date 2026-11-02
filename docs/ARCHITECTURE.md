# ARCHITECTURE.md — lojinha-de-precos

> **Projeto:** lojinha-de-precos
> **Fase:** 2 — Arquitetura
> **Status:** Aprovado pelo Tech Lead (ver Anexo — Decisões arquiteturais)
> **Fonte de requisitos:** `docs/REQUIREMENTS.md` (RF-*, RNF-*, RB-*, US-*)
> **Restrições inquestionáveis:** HTML/CSS/JS puro (zero dependências, zero build, zero CDN), deploy somente local (um comando), dados em `data/items.json`, no máximo ~6 módulos JS.

---

## 1. Visão geral da arquitetura

**Padrão escolhido: camadas unidirecionais simplificadas ("Flux-lite") em vanilla JS com módulos ES.**

Não é MVC clássico (não há Controller separado nem View template-engine) e não é framework. É o menor desenho que satisfaz os requisitos:

- **Um estado único** (`appState`) mantido por `state.js` — fonte de verdade de filtros, ordenação, dados, status e tema.
- **Funções puras de dados** (`filters.js`, `utils.js`) — filtrar, ordenar, agrupar e normalizar são operações testáveis fora do browser.
- **Render dedicado** (`render.js`) — única camada que toca o DOM; recebe estado/derivados e pinta a tela.
- **Orquestrador único** (`app.js`) — busca o JSON, liga eventos, chama `setState` e dispara re-render.
- **Módulo isolado de tema** (`theme.js`) — única fronteira com `localStorage`.

**Por que evita complexidade desnecessária:**

- 50 itens e uma única tela não justificam router, store externo, template engine, virtual DOM ou build.
- O fluxo é linear: `evento → setState → derivar → render`. Sem ciclos, sem listeners em cadeia, sem "estado fantasma".
- Módulos ES dão separação real (escopo, dependências explícitas via `import`) **sem** bundler — o browser resolve o grafo.
- Toda a lógica de negócio (RB-10, RB-11, normalização de acentos) vive em funções puras → testáveis com `node:test`, sem framework de teste.

**Fora do escopo arquitetural (confirmado com requisitos):** backend, banco, API HTTP, auth, fila, cache, i18n genérico (apenas mapa de labels PT-BR), SSR.

---

## 2. Diagrama textual da solução

### 2.1 Carregamento (boot)

```
Browser (http://localhost:8000)
│
├─ GET /index.html
│    ├─ <link rel="stylesheet" href="css/styles.css">     (CSS bloqueante, 1 arquivo)
│    └─ <script type="module" src="js/app.js">           (módulo ES → exige HTTP, não file://)
│
▼
js/app.js  (entry point)
│
├─ 1. theme.js.initTheme()  ──► localStorage["theme"] (try/catch) ──► <html data-theme="dark|light">
│
├─ 2. fetch("data/items.json")            ◄── caminho relativo (funciona em qualquer raiz)
│       ├─ !res.ok            → status: "error" (NOT_FOUND)
│       ├─ JSON.parse falha   → status: "error" (PARSE)
│       ├─ envelope inválido  → status: "error" (SCHEMA)
│       └─ ok → items[] enriquecidos (_search = normalizeText(name))
│
├─ 3. state.js.createInitialState(items)  → appState (imutável)
│
├─ 4. render.js.render(appState)          → lista + contagem + controles
│
└─ 5. bindEvents()                        → input/change/click ──┐
                                                                 │
▼ fluxo contínuo ◄───────────────────────────────────────────────┘
evento → debounce (busca) → setState(partial) → filter/sort/group → render
```

### 2.2 Evento de filtro até re-render

```
[usuário digita "pocao" no campo de busca]
        │
        ▼
input event ──► debounce(200 ms, utils.js)
        │
        ▼
app.js: handleFilterChange({ query: "pocao" })
        │
        ▼
state.js: setState(appState, partial)  ──► NOVO objeto (spread, imutável)
        │
        ▼
app.js deriva:
  filters.filterItems(items, filters)     → itens que passam (AND: busca ∩ preço ∩ cat ∩ subcat)
  filters.sortItems(list, sort)           → cópia ordenada (nunca muta o original)
  filters.groupItems(list, mode)          → grupos (modo "agrupado") ou lista plana
        │
        ▼
render.js:
  renderList(groups|list)   → DocumentFragment substituído no <main> (textContent sempre)
  renderCount(n)            → região aria-live="polite": "1 item encontrado" / "N itens encontrados"
  renderEmpty() | renderError(msg)        → se aplicável
        │
        ▼
[controles (inputs/selects) NÃO são re-renderizados → foco do teclado preservado]
```

---

## 3. Stack tecnológica

| # | Tecnologia | DECISION | REASON | IMPACT | ALTERNATIVES | WHY NOT |
|---|---|---|---|---|---|---|
| a | **HTML/CSS/JS puro + módulos ES** (`<script type="module">`) | Usar 6 módulos ES nativos, sem bundler | Escopo do usuário; ES modules dão escopo isolado e dependências explícitas (`import`) de graça; sem build = `git clone` + servidor e pronto | Browser moderno obrigatório (últimas 2 versões, RNF-06 — ok); servidor local obrigatório (ver b) | Scripts clássicos com globals; IIFE única; framework (Vue/React) | Globals poluem namespace e criam acoplamento oculto por ordem de `<script>`; framework viola decisão do usuário e exige build/npm |
| b | **Servidor local** — primário `python -m http.server 8000`; alternativa `npx serve` (e `py -m http.server` no Windows sem `python` no PATH) | Um servidor estático mínimo, documentado no README + wrappers em `scripts/` | **Módulos ES NÃO carregam via `file://`** (bloqueio de CORS do browser): `fetch('data/items.json')` e `import` falham em arquivo local. Servidor é *obrigatório*, não opcional | Um comando (RF-15); offline após servir (RNF-04); funciona sem internet | `file://` com script clássico; Live Server (extensão VS Code); Browsersync | `file://` exige abandonar módulos ES; extensões VS Code são dependência de IDE e não "um comando" |
| c | **Dados em `data/items.json` (estático, com envelope)** | `fetch` de um JSON versionado no boot | Mantenedor edita só JSON (RNF-05); dados separados de código; envelope permite validação/migração de schema | Edição exige recarregar a página (aceitável); JSON inválido → estado de erro (RNF-09) | Inline no HTML; JS como `data.js` (globally); CSV; GraphQL | Inline mistura dados e apresentação; `data.js` global não tem validação e quebra CSP; CSV exige parser e não modela objetos aninhados |
| d | **Sem banco de dados** | Catálogo inteiro cabe em memória | 50 itens (e até ~5k itens) cabem num arquivo; nenhum requisito de escrita em runtime | Consulta é filtragem em memória (< 1 ms com pré-normalização) | SQLite (WASM); IndexedDB | Dados não mudam em runtime; banco adiciona migração, driver e estado sem necessidade (YAGNI) |
| e | **Sem backend / sem API** | Só arquivos estáticos servidos localmente | Escopo é leitura (Seção 3 "Out"); deploy somente local (decisão 3); zero auth/pagamento | Qualquer lógica server-side futura exigiria replanejamento (não previsto) | Cloud Functions; Node/Express estático | Nenhuma regra de negócio precisa de servidor; manter um processo é custo sem valor |

**Decisões complementares (mesmo formato):**

| # | DECISION | REASON | IMPACT | ALTERNATIVES | WHY NOT |
|---|---|---|---|---|---|
| f | **CSS único** (`css/styles.css`) | Uma página só; tema via `[data-theme]` + tokens CSS | Evita 3–4 requisições e ordem de import; se passar de ~1.200 linhas, dividir em `base/ components/ themes/` | Vários arquivos CSS; CSS modules | Split prematuro sem componente reutilizável é ruído |
| g | **Testes com `node:test` + `node:assert` (zero dependência)** | Módulos `utils/state/filters` são puros e DOM-free → importáveis no Node | `node --test` (auto-descoberta; D-18) sem npm install; `render/theme/app` validados por checklist manual | Jest/Vitest (npm); nenhum teste | Framework de teste exigiria `package.json` + `npm install`, violando "zero dependências" |
| h | **Validação de dados em script Python stdlib** (`scripts/validate_data.py`) | Mesmo toolchain do servidor primário; `json` + regras sem pip | Mantenedor roda 1 comando antes de commitar alterações no JSON | Validador em Node; validador no próprio front | Dois toolchains para a mesma tarefa; validação só no front chega tarde demais |

---

## 4. Estrutura de diretórios

```
lojinha-de-precos/
│
├── index.html                 # Única página: header, filtros, região aria-live, main, footer
├── css/
│   └── styles.css             # Tokens (claro/escuro), layout mobile-first, badges, estados
│
├── js/                        # Módulos ES — máx. 6 (regra do Tech Lead)
│   ├── app.js                 # Entry: boot, fetch, wiring de eventos, orquestração
│   ├── state.js               # Forma do appState, setState imutável, constantes de domínio
│   ├── filters.js             # Funções puras: filter / sort / group / subcategorias
│   ├── render.js              # Única camada DOM: lista, badges, contagem, vazio, erro
│   ├── theme.js               # Tema claro/escuro + localStorage defensivo
│   └── utils.js               # normalizeText, debounce, formatPrice, mapa de labels
│
├── data/
│   └── items.json             # Envelope versionado + 50 itens (fonte da verdade do catálogo)
│
├── scripts/
│   ├── serve.ps1              # Windows → python -m http.server 8000
│   ├── serve.sh               # macOS/Linux → python3 -m http.server 8000
│   └── validate_data.py       # Valida schema, enums, ids únicos, contagens, emotes residual
│
├── tests/
│   ├── utils.test.mjs         # normalizeText, formatPrice
│   ├── filters.test.mjs       # AND dos filtros, faixa, ordenação, desempate, agrupamento
│   ├── state.test.mjs         # imutabilidade do setState, estado inicial
│   └── manual-checklist.md    # render, tema, a11y, responsividade, erros (passos manuais)
│
├── docs/
│   ├── REQUIREMENTS.md        # Fase 1 (fonte da verdade de requisitos)
│   ├── ARCHITECTURE.md        # Este documento
│   ├── DATA.md                # Schema do JSON + como editar/adicionar itens
│   ├── EMOTES.md              # Mapeamento :emote: → emoji (rastreabilidade RF-14)
│   ├── SECURITY.md            # Revisão de segurança
│   └── DEPLOYMENT.md          # Como rodar local
│
├── .gitignore                 # node_modules/, __pycache__/, .DS_Store, Thumbs.db, *.log
├── CHANGELOG.md               # Keep a Changelog (v0.1.0 = MVP)
├── README.md                  # Como rodar (2 comandos), como editar o JSON, estrutura
└── LICENSE                    # (existente)
```

**Justificativa dos 6 módulos (limite respeitado):**

| Módulo | Responsabilidade única | Por que é módulo próprio |
|---|---|---|
| `app.js` | Orquestração e eventos | Entry point; único que conhece todos os outros |
| `state.js` | Estrutura e transição do estado | Precisa ser puro e testável no Node |
| `filters.js` | Derivação de dados (filtra/ordena/agrupa) | Núcleo da regra de negócio (RB-10, RB-11) |
| `render.js` | Pintura do DOM | Isolamento total da única camada perigosa (DOM) |
| `theme.js` | Tema + persistência defensiva | Fronteira única com `localStorage`; independente do catálogo |
| `utils.js` | Utilitários genéricos + labels | Folha compartilhada sem conhecimento de domínio |

**Não criamos:** `api.js` (não há API), `router.js` (uma página), `i18n.js` (só labels PT-BR em `utils.js`), `components/` (sem reuso real).

---

## 5. Contrato de dados

### 5.1 Envelope de `data/items.json`

```json
{
  "version": 1,
  "items": [ { "...": "Item" } ]
}
```

**DECISION:** envelope `{ version, items }`.
**REASON:** (1) o validador e o front podem recusar versões desconhecidas com mensagem clara; (2) migração futura de schema sem ambiguidade ("é uma lista?" × "é um objeto?"); (3) custo é zero (um nível de aninhamento).
**IMPACT:** `fetch` precisa de `data.items`; validação checa `version === 1`.
**ALTERNATIVES:** lista pura `[{...}]`; objeto com metadados (`generatedAt`, `source`).
**WHY NOT:** lista pura não tem espaço para versionamento sem heurística; metadados extras (data de geração etc.) são YAGNI agora — podem entrar em `version: 2` se um dia importarem.

### 5.2 Schema do `Item` (confirmação + refinamento do REQUIREMENTS §6.1)

Confirma todos os campos originais e **adiciona 2 campos opcionais** para satisfazer RF-09/RF-08 sem parsing de texto livre:

```json
{
  "id": "skooma",
  "name": "Skooma",
  "category": "bebidas",
  "subcategory": null,
  "price": 20,
  "unit": null,
  "weightKg": null,
  "damage": null,
  "armorClass": null,
  "strengthReq": null,
  "effectText": "+1 For/Dex/Con, -1 Int/Sab/Car. Dura: [Descanso Curto]",
  "modifiers": [
    { "value": 1,  "label": "For/Dex/Con" },
    { "value": -1, "label": "Int/Sab/Car" }
  ],
  "restrictions": [],
  "tags": ["droga", "bonus", "malus"]
}
```

| Campo | Tipo | Obrig. | Observação |
|---|---|---|---|
| `id` | string slug, única, estável | ✅ | Chave de key no render (DOM-free) |
| `name` | string (fiel à fonte) | ✅ | Nunca contém HTML (regra de dados) |
| `category` | enum §5.3 | ✅ | |
| `subcategory` | enum §5.3 \| `null` | ❌ | `null` fora de armas/armaduras |
| `price` | number inteiro ≥ 0 | ✅ | **PO** (RB-01) |
| `unit` | `"por noite"` \| `null` | ❌ | Só Pousada (RB-02) |
| `weightKg` | number \| `null` | ❌ | Armas/armaduras/escudo |
| `damage` | string \| `null` | ❌ | `"1d8"`, versáteis `"1d6/1d8"` (RB-03) |
| `armorClass` | string \| `null` | ❌ | `"14 + Dex máx +2"`, escudo `"+2"` (RB-04) |
| `strengthReq` | number \| `null` | ❌ | Armaduras pesadas |
| `effectText` | string \| `null` | ❌ | Texto fiel integral da fonte (RB-12) |
| **`modifiers`** | `[{ value: int ≠ 0, label: string }]` | ❌ (default `[]`) | **Aprovado (D-6).** Alimenta badges verdes (`value>0`) e vermelhas (`value<0`) da RF-09 |
| **`restrictions`** | `string[]` | ❌ (default `[]`) | **Aprovado (D-6).** Textos de badge: `não acumulativo`, `exige descanso antes de novo uso`, `cura total` (RB-05) |
| `tags` | `string[]` (conjunto documentado) | ✅ | Ver §5.4 |

> **✓ Aprovação do Tech Lead (D-6):** `modifiers` e `restrictions` são refinamentos oficiais do schema. Motivo: RF-09 exige bônus **positivos e negativos visualmente distintos** a partir do dado; extrair isso de `effectText` livre exigiria parsing frágil (ex.: "−1" × "-1" × "menos 1"), em conflito com RB-12 (texto fiel preservado). Com os campos estruturados, `effectText` continua intacto e a badge é derivada de dado tipado. **Sem eles, RF-09 fica não implementável de forma robusta.**

### 5.3 Enums (chaves de i18n — labels PT-BR no front)

**Categoria** (chave → label; ordem fixa = ordem de exibição no modo agrupado):

| Chave | Label PT-BR |
|---|---|
| `bebidas` | Bebidas |
| `refeicoes` | Refeições |
| `pousada` | Pousada |
| `pocoes` | Poções de Vida |
| `armas` | Armas |
| `armaduras` | Armaduras & Escudo |

**Subcategorias:**

| Chave | Label PT-BR | Pertence a |
|---|---|---|
| `simples` | Simples | `armas` |
| `marciais` | Marciais | `armas` |
| `versateis` | Versáteis | `armas` |
| `leves` | Leves | `armaduras` |
| `medias` | Médias | `armaduras` |
| `pesadas` | Pesadas | `armaduras` |
| `escudo` | Escudo | `armaduras` |

**DECISION:** chaves minúsculas sem acento no JSON (`marciais`, `medias`) + mapa `Record<chave, labelPTBR>` em `utils.js`.
**REASON:** chaves ASCII são seguras em URLs, selectors, comparações e arquivos; acentos ficam só onde o usuário vê. O mapa é o ponto único de tradução — trocar um label é mudar 1 linha.
**IMPACT:** validador rejeita chave fora do enum; front nunca exibe a crua.
**ALTERNATIVES:** label direto no JSON (comparações frágeis, duplicação); chaves numéricas (ilegíveis no JSON editado à mão).
**WHY NOT:** rótulo como chave quebra se alguém corrigir um typo de label; número esconde o domínio de quem edita o JSON.

**Tags (conjunto documentado — validador avisa em desconhecida):**
`cura`, `bonus`, `malus`, `droga`, `restricao`, `descanso-curto`, `descanso-longo`, `atributo`, `slot-magia`.
Badges de duração são derivadas da tag (`descanso-curto` → badge `[Descanso Curto]`), não de texto livre.

### 5.4 Regras derivadas do contrato

- **RB-10 (AND):** `filterItems` aplica busca ∩ preço ∩ categoria ∩ subcategoria sequencialmente sobre o MESMO array.
- **RB-11 (desempate):** ordenação por preço com empate → `name` asc; ordenação por nome com empate → `id` asc; modo padrão → ordem estável por índice original dentro do grupo.
- **Faixa:** `priceMin > priceMax` → resultado vazio + aviso (US-03); campo vazio = `null` = sem restrição; negativos não são aceitos (`min="0"` no input + validação).
- **Pluralização PT-BR:** `1 item encontrado` · `N itens encontrados` (US-02/RF-10).

---

## 6. Contrato entre módulos

### 6.1 Forma do estado único (`appState`)

```js
// typedefs em texto (JSDoc nos arquivos reais)
AppState = {
  status:      'loading' | 'ready' | 'error',
  errorCode:   'NETWORK' | 'NOT_FOUND' | 'PARSE' | 'SCHEMA' | null,
  errorMessage: string | null,          // detalhe p/ console + modo debug
  items:       Item[],                 // do JSON + _search pré-computado
  filters: {
    query:       string,               // texto cru do campo de busca
    priceMin:    number | null,
    priceMax:    number | null,
    category:    'all' | CategoryKey,
    subcategory: 'all' | SubcategoryKey   // 'all' quando category='all'
  },
  sort: 'category' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc',
  theme: 'light' | 'dark'
}

// derivado em app.js, nunca armazenado:
mode = (sort === 'category') ? 'grouped' : 'flat'
```

**DECISION:** `sort` como **enum de 5 valores** (não `{key, dir}`).
**REASON:** 1:1 com as opções do `<select>`, estado inválido impossível ("só key sem dir"), comparação trivial em `sortItems`.
**IMPACT:** UI mapeia opção → valor enum direto.
**ALTERNATIVES:** `{key, dir}` (mais estados inválidos); boolean `priceAsc` (não cobre nome+preço).
**WHY NOT:** pares key/dir duplicam informação que a UI já conhece.

### 6.2 Assinaturas públicas (API de cada módulo)

**`utils.js` — folha, DOM-free**

```js
normalizeText(s: string): string            // NFD + remove combining marks + toLowerCase
debounce(fn: Function, ms: number): Function
formatPrice(price: number, unit?: string|null): string   // "10 PO" | "5 PO / noite"
CATEGORY_LABELS: Record<string, string>
SUBCATEGORY_LABELS: Record<string, string>
CATEGORY_ORDER: CategoryKey[]               // ordem fixa do modo agrupado
```

**`state.js` — folha, DOM-free**

```js
createInitialState(items: Item[]): AppState
setState(current: AppState, partial: Partial<AppState>): AppState   // {...current, ...partial}, nunca muta
initialFilters(): { query:'', priceMin:null, priceMax:null, category:'all', subcategory:'all' }
isValidSort(v: any): boolean                // defesa extra na borda da UI
```

**`filters.js` → importa `utils.js` — DOM-free**

```js
filterItems(items: Item[], filters: Filters): Item[]     // AND (RB-10); retorna subarray
sortItems(items: Item[], sort: SortKey): Item[]          // retorna CÓPIA; desempate RB-11
groupItems(items: Item[], category: CategoryKey): Group[] // só no modo 'grouped'
getSubcategories(category: CategoryKey): SubcategoryKey[] // [] se categoria não tem subcategorias
enrichItems(raw: Item[]): Item[]                          // adiciona _search = normalizeText(name)

Group  = { key: string, label: string, items: Item[] }    // label já resolvido via CATEGORY_LABELS/SUBCATEGORY_LABELS
```

**`theme.js` — DOM + localStorage (try/catch obrigatório)**

```js
initTheme(): 'light' | 'dark'       // lê storage → aplica data-theme → fallback: matchMedia('prefers-color-scheme')
toggleTheme(current: 'light'|'dark'): 'light'|'dark'  // persiste (try/catch) + aplica
applyTheme(t: 'light'|'dark'): void  // document.documentElement.dataset.theme = t
```

**`render.js` — DOM-only; importa `utils.js` (labels/format)**

```js
renderList(groupsOrItems: Group[] | Item[]): void   // DocumentFragment; textContent SEMPRE
renderCount(count: number): void                    // aria-live="polite"
renderEmpty(): void                                 // "Nenhum item encontrado" + botão Limpar
renderError(code: ErrorCode): void                  // mensagem + botão "Tentar novamente"
renderSubcategoryOptions(category: CategoryKey): void // popula/restringe o <select> de subcategorias
```

> `render.js` **não** importa `filters.js` nem `state.js` como fonte de fluxo: recebe derivados prontos. Isso mantém a dependência unidirecional (§12).

**`app.js` — entry; importa TODOS**

```js
boot(): Promise<void>                    // initTheme → fetch → createInitialState → render → bind
loadItems(): Promise<Item[]>             // tratamento: NOT_FOUND / PARSE / SCHEMA
applyFilters(partial: Partial<Filters>): void   // setState → derive → render
handleSortChange(sort: SortKey): void
bindEvents(): void                       // input(debounce), change, click (limpar / tema / retry)
```

### 6.3 Regras de contrato

1. **Nenhum módulo importa `app.js`** (evita ciclos).
2. `render.js` e `theme.js` são os **únicos** que tocam DOM; os demais são puros → testáveis no Node.
3. `state.js` e `utils.js` são **folhas** (não importam módulos do projeto).
4. Estado só muda via `setState` (imutável). Nenhum módulo edita `appState` por referência.
5. `localStorage` é acessado **apenas** por `theme.js`.
6. `innerHTML` é **proibido** no projeto inteiro (§9).

---

## 7. Fluxo de dados

### 7.1 Pipeline de uma mudança de filtro

```
1. EVENTO        input/change em controle de filtro (DOM, fora do state)
2. DEBOUNCE      apenas no campo de busca (200 ms; RF-03 aceita ≤ 300 ms).
                 Selects e inputs de preço reagem no 'change' (sem debounce).
3. UPDATE        app.js: applyFilters(partial)
                 → novo appState = setState(atual, partial)   [imutável, sem mutação do original]
4. DERIVE        (a) enrichItems já aplicado no boot → itens com _search prontos
                 (b) list = filterItems(items, filters)          [AND]
                 (c) sorted = sortItems(list, sort)              [cópia]
                 (d) payload = mode==='grouped' ? groupItems(sorted, category) : sorted
5. RENDER        renderList(payload)   → substitui filhos do <main> via DocumentFragment
                 renderCount(n)        → região aria-live anuncia "N itens encontrados"
                 se n === 0            → renderEmpty() (com botão "Limpar filtros")
6. CONTROLES     <select>/<input> NÃO são re-renderizados → foco e posição do cursor preservados
```

### 7.2 Garantias do fluxo

- **Imutabilidade:** `setState` retorna objeto novo; `filterItems`/`sortItems` retornam novos arrays (spread/`slice`). O array `items` original nunca é mutado → re-renders consistentes e ordenação sem efeitos colaterais.
- **Render completo da lista (não incremental):** com 50 (ou até ~1.000) itens, reconstruir a lista inteira em `DocumentFragment` é mais rápido e mais simples que diff manual. Um render por evento (não um por campo derivado).
- **Anúncio acessível:** só a contagem é `aria-live="polite"`; a lista não (evitaria leitura caótica ao digitar).
- **Estado vazio vs. erro são distintos:** vazio = filtros válidos sem match (botão *Limpar filtros*); erro = fetch/JSON falhou (botão *Tentar novamente* reexecuta `loadItems`).
- **Tema fora do ciclo de lista:** `toggleTheme` faz `setState` + `applyTheme` **sem** re-render dos itens (nada na lista depende do tema — o CSS cuida disso).

---

## 8. Estratégia de performance e escalabilidade

### Hoje (50 itens) — orçamento

| Métrica | Alvo | Como se atinge |
|---|---|---|
| Render inicial | < 100 ms (RNF-01) | 1 `fetch` + 1 render em fragment; CSS único; zero dependências externas |
| Filtro/ordenação | < 50 ms | Funções puras sobre array em memória (µs para 50 itens) |
| Busca | sem travar a UI | `debounce(200 ms)` + `_search` pré-computado (normalizar 50 nomes por keystroke é desperdício) |

### Escala para 1.000+ itens (sem trocar de arquitetura)

1. **Normalização pré-computada (já no contrato):** `_search` calculado **uma vez** no boot (`enrichItems`). Busca vira `includes()` sobre string pronta — O(n) barata.
2. **Debounce fixo em 200 ms** já cobre 1.000 itens (nada de debounce adaptativo agora).
3. **`DocumentFragment`** (já previsto): 1 inserção no DOM por render, sem reflow por item.
4. **Agrupamento é `O(n)`** com um `Map` por chave — não é `O(n²)` (proibido aninhamento de `filter` por grupo).
5. **Ordenação:** `Array.prototype.sort` é estável (ES2019+) → desempate RB-11 sem index explícito.
6. **Gatilhos futuros (NÃO agora):**
   - **> 3.000 itens:** render paginado ("carregar mais") ou lista virtual — *gatilho: render medido > 150 ms*.
   - **> 10.000 itens ou filtragem > 30 ms:** mover `filter+sort` para Web Worker — *gatilho: medição, não estimativa*.
   - **JSON > ~1 MB:** considerar gzip no servidor — improvável com catálogo de itens.

### Quando valeria migrar para framework (gatilhos explícitos)

| Gatilho | Por quê |
|---|---|
| 2ª rota/página com estado compartilhado | Router + estado global deixa de ser 6 módulos |
| Filtros complexos (multisseleção, URLs compartilháveis, favoritos) | Reatividade declarativa evita orquestração manual |
| Time > 2 devs sem domínio de DOM imperativo | Curva de manutenção do vanilla passa a custar mais |
| Necessidade de SSR/SEO em produção web | Só frameworks maduros resolvem bem |

Nenhum gatilho está presente. **Migração prematura = YAGNI.**

---

## 9. Estratégia de segurança

Sem backend, a superfície é: **dados do JSON, o browser e o localStorage.**

| Ameaça | Vetor | Mitigação |
|---|---|---|
| **XSS via JSON editado** (principal) | Nome/efeito com `<script>` ou `<img onerror>` no `items.json` | **Regra nº 1: `textContent` sempre, `innerHTML` proibido no projeto inteiro** (revisão por grep no checklist). Badges e cards montados com `document.createElement` + `textContent`. Nenhum template string vira HTML. (RNF-07: item com `<script>` no nome exibe como texto) |
| XSS via `eval`/`new Function` | Dinamização desnecessária | **Proibido** `eval`, `setTimeout(string)`, `Function(string)` — não há caso de uso |
| **Supply chain** | CDN comprometido, dependência transitiva | **Zero dependências, zero CDN, zero npm install** — a melhor mitigação possível |
| CSP frágil | Inline script/style | Meta CSP (abaixo) com `script-src 'self'`; sem inline scripts |
| `localStorage` corrompido/indisponível | Modo privado, storage cheio | `theme.js` com `try/catch` em leitura e escrita; valor lido é validado contra enum `'light'|'dark'` (qualquer outro → fallback do sistema) (RNF-08) |
| JSON inválido / arquivo ausente | Edição manual com erro | `try/catch` em `JSON.parse` + validação de envelope → `status:'error'` com mensagem amigável e botão *Tentar novamente* (RNF-09). Nunca tela branca |
| Navegação a partir de `file://` | Usuário tenta abrir `index.html` duplo-clique | README destaca "use o servidor"; `loadItems` detecta `location.protocol === 'file:'` e mostra mensagem orientando o comando correto |

### CSP via meta tag (viabilidade avaliada)

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

- **Módulos ES ✅ compatível:** `<script type="module" src="js/app.js">` é script externo de origem própria → `script-src 'self'` basta. Nenhum inline script é usado.
- **`connect-src 'self'` ✅** cobre o `fetch('data/items.json')`.
- **`style-src 'self'` ✅** — CSS é arquivo único externo. **Regra:** não usar atributos `style="..."` inline no HTML montado (se um dia for preciso posicionamento dinâmico, usar CSSOM: `el.style.setProperty(...)` — permitido — ou classe CSS).
- **Trade-off aceito:** sem inline script de boot, o tema pode "piscar" ao carregar quando o tema salvo difere do sistema. **Mitigação:** CSS padrão segue `prefers-color-scheme` (flash só ocorre se o usuário trocou o tema manualmente) — aceitável para MVP; se incomodar, solução futura é um `js/theme-boot.js` clássico bloqueante (arquivo externo → continua sem `'unsafe-inline'`).
- **Não usar `'unsafe-inline'`** em `script-src`: anularia a proteção contra injeção.

---

## 10. Padrões de código

### 10.1 Idioma

| Onde | Idioma | Justificativa |
|---|---|---|
| **Identificadores** (variáveis, funções, chaves de enum, slugs) | **Inglês** | Compatível com MDN, erros de browser, Stack Overflow e convenções da linguagem; chaves de dado (`price`, `category`) não mudam com o idioma da UI |
| **Labels de UI, mensagens ao usuário, textos de estado** | **Português (pt-BR)** | Público é jogador/mestre brasileiro; todo texto visível é PT-BR ("N itens encontrados", "Limpar filtros") |
| **Comentários e docstrings** | **Português (pt-BR)**, termos técnicos em inglês | Mantenedor único é pt-BR e a documentação do projeto já é pt-BR; o comentário explica o **"porquê"** (ex.: `// desempate por nome: RB-11 exige resultado determinístico para teste`) |
| **Códigos de erro** | Inglês (`PARSE`, `NOT_FOUND`) | São valores de enum, não texto exibido |

### 10.2 Convenções

- **Formatação:** UTF-8, 2 espaços de indentação, ponto e vírgula, aspas simples; sem formatação automática obrigatória (zero tooling) — consistência por revisão.
- **Nomenclatura:** funções com verbo (`filterItems`, `renderList`); booleans `is/has/should`; sem abreviação exceto convenções (`id`, `msg`).
- **HTML semântico:** `<header> <main> <section> <footer>`; lista de itens em `<ul>/<li>`; ações em `<button>` (nunca `<div onclick>`); todo `<input>` com `<label for>`; `<fieldset>/<legend>` no bloco de filtros; `<select>` com `<optgroup>` para subcategorias.
- **Acessibilidade (RNF-02):**
  - Contagem em região `aria-live="polite"` + `role="status"`.
  - `aria-label` no botão de tema (`"Alternar modo escuro"`) refletindo o estado atual.
  - Estados vazio/erro anunciam via `role="status"`.
  - Foco visível (`:focus-visible`), navegação por teclado completa, alvos ≥ 44 px, contraste WCAG AA nos dois temas.
  - Bônus não comunicados só por cor: sempre sinal `+`/`−` (risco #11 dos requisitos).
- **Tratamento de erros:**
  - `loadItems` mapeia falha → `{ errorCode, status:'error' }`; detalhe vai para `console.error`, usuário vê mensagem PT-BR genérica + ação de retry.
  - `localStorage` sempre em `try/catch` (leitura e escrita).
  - **Nunca `catch` vazio.**
- **Logging:** apenas `console.error` em falhas reais (fetch/parse/storage). Sem logger, sem debug em produção.
- **Comentários:** JSDoc curto nas assinaturas públicas de `filters.js`, `state.js`, `utils.js` (contratos); cabeçalho de cada módulo com 1 linha de responsabilidade; comentários pontuais para regras de negócio (`RB-*`) e decisões não óbvias. Código autoexplicativo não é comentado.

---

## 11. Riscos técnicos

| # | Risco | Prob. × Impacto | Mitigação |
|---|---|---|---|
| 1 | **Módulos ES não carregam via `file://`** (CORS) → usuário duplo-clique no HTML e vê tela em branco | Alta × Alta | Servidor é obrigatório e documentado como **primeiro passo** do README; wrappers `scripts/serve.*`; `loadItems` detecta `file:` e exibe orientação; teste manual do fluxo "sem servidor" |
| 2 | **Servidor indisponível no Windows** (`python` fora do PATH → erro `'python' não é reconhecido`) | Média × Média | README documenta os 3 comandos: `python`, `py` (launcher Windows) e `npx serve`; nenhum exige instalação de dependência do projeto |
| 3 | **JSON inválido** após edição manual (vírgula, aspas) | Alta × Média | RNF-09: `try/catch` em `JSON.parse` + estado de erro com *Tentar novamente*; `scripts/validate_data.py` antes de commit; exemplo de item documentado no README |
| 4 | **Schema divergente do JSON** (campo faltando, enum errado, id duplicado) | Média × Média | Validador checa obrigatoriedade, enums, unicidade de `id`, `price ≥ 0`, tipos de `modifiers`; front valida envelope (`version`, `Array.isArray`) → `SCHEMA` |
| 5 | **`localStorage` indisponível** (aba privada, cota) | Média × Baixa | `try/catch` em leitura/escrita em `theme.js`; site segue funcionando sem persistir (RNF-08) |
| 6 | **Acentos na busca** ("pocao" ≠ "Poção") | Alta × Baixa | `normalizeText` com NFD + remoção de combining marks; testes automatizados: `"pocao"→"pocao"`, `"POÇÃO"→"pocao"`, `"Skooma"→"skooma"` |
| 7 | **XSS via JSON editado** | Baixa × Alta | `textContent` exclusivo; `innerHTML`/`eval` proibidos (grep no checklist); CSP `script-src 'self'` (§9) |
| 8 | **Ambiguidade: ordenação × agrupamento** (a ordenação por preço destrói agrupamento por categoria?) | Alta × Média | **Resolvido pela decisão D-5** (§5.4/§7): modo agrupado é o padrão; ordenação explícita por preço/nome ativa modo plano. *Aprovado pelo Tech Lead* |
| 9 | **Nomes das armas ausentes na fonte** (risco #3 dos requisitos) | Alta × Média | Resolvido: nomes derivados (`Arma Simples 1d4` etc.) — só `name`/`id` no JSON; nenhum código depende do formato do nome |
| 10 | **Foco perdido ao digitar** (se o render recriasse os controles) | Média × Média | Contrato: controles nunca são re-renderizados; só `<main>` é repintado (§7.1, passo 6) |
| 11 | **Debounce atrasa feedback da contagem** | Baixa × Baixa | 200 ms (limite RF-03 = 300 ms); selects/preço sem debounce (evento `change`) |
| 12 | **CSP meta quebra algo não previsto** | Baixa × Média | Checklist manual "CSP ativo: sem erros no console"; proibição de inline desde o dia 1 evita a surpresa |
| 13 | **Contagens do catálogo mudam** (50 → N ao adicionar itens) | Alta × Baixa | Validador emite *warning* de contagem (não erro) — o catálogo deve poder crescer sem quebrar (não há build, mas há confiança no dado) |

---

## 12. Dependências entre módulos e ordem de implementação

### 12.1 Grafo de dependências (DAG — sem ciclos)

```
                    ┌────────────┐
                    │  app.js    │  ← entry (importa todos abaixo)
                    └─────┬──────┘
          ┌───────────┬───┴────┬───────────┬──────────┐
          ▼           ▼        ▼           ▼          ▼
     ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
     │state.js │ │filters.js│ │render.js│ │theme.js │ │utils.js │
     └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
          │           │           │           │           ▲
          │           └───────────┴───────────┴───────────┘
          │                       (filters e render importam utils)
          ▼
        (folha: não importa módulos do projeto)
```

**Regras de dependência:**

| Módulo | Pode importar | NUNCA pode importar |
|---|---|---|
| `utils.js` | *(nada do projeto)* | qualquer módulo |
| `state.js` | *(nada do projeto)* | qualquer módulo |
| `theme.js` | *(nada do projeto)* | app/filters/render/state |
| `filters.js` | `utils.js` | render, theme, state, app |
| `render.js` | `utils.js` | filters, theme, state, app |
| `app.js` | todos | — (ninguém importa app.js) |

**Proibições transversais:** `localStorage` só em `theme.js` · DOM só em `render.js`, `theme.js`, `app.js` · `innerHTML` em lugar nenhum · dados do JSON nunca viram HTML.

### 12.2 Ordem de implementação recomendada (para o Tech Lead)

| Fase | Tarefa | Entregável | Depende de |
|---|---|---|---|
| **0** | Aprovar este doc + refinamento do schema (`modifiers`, `restrictions`) + decisão D-5 (agrupado × plano) | ARCHITECTURE.md aprovado | REQUIREMENTS aprovado |
| **1** | `data/items.json` completo (50 itens, envelope v1) + `docs/EMOTES.md` | JSON confere com §7 dos requisitos | Fase 0 |
| **2** | `scripts/validate_data.py` + `scripts/serve.*` | `python scripts/validate_data.py` passa | Fase 1 |
| **3** | `index.html` + `css/styles.css` (estrutura semântica, estados vazio/erro/loading no HTML, tokens de tema, badges CSS) | Layout mobile-first 320–1440 px estático | Fase 0 |
| **4** | `js/utils.js` + `js/state.js` + `tests/utils.test.mjs`, `tests/state.test.mjs` | `node --test` verde (núcleo puro) | Fase 0 |
| **5** | `js/filters.js` + `tests/filters.test.mjs` (AND, faixa, desempate RB-11, "pocao"→Poção, agrupamento) | Testes verdes | Fase 4 |
| **6** | `js/render.js` (lista, badges, contagem aria-live, vazio, erro) | Render manual com dados mock | Fase 3–4 |
| **7** | `js/theme.js` | RF-07 + RNF-08 manual | Fase 3 |
| **8** | `js/app.js` (boot, fetch, validação de envelope, wiring com debounce) | Fluxo end-to-end com os 50 itens | Fases 1–7 |
| **9** | Validação cruzada: RF-01…RF-15 contra `tests/manual-checklist.md` + a11y + CSP | Checklist completo | Fase 8 |
| **10** | `README.md` (comandos, edição do JSON) + `CHANGELOG.md` v0.1.0 | Primeira release local | Fase 9 |

**Justificativa da ordem:** dados e validação primeiro (o front é inútil sem contrato aprovado); núcleo puro (`utils/state/filters`) com testes antes do DOM (bugs baratos de corrigir); `render` antes do `app` (permite pintar com mock e isolar falhas de orquestração); `app.js` por último porque é o módulo que mais acopla.

---

## Anexo — Decisões arquiteturais (registro)

**D-1 — Módulos ES nativos como estrutura de código**
DECISION: 6 módulos ES via `<script type="module">`, sem bundler.
REASON: separação real de escopo e dependências explícitas com zero ferramenta.
IMPACT: exige servidor HTTP local (file:// proibido); browser moderno.
ALTERNATIVES: script clássico com globals; uma IIFE única.
WHY NOT: globals criam acoplamento oculto e ordem de carregamento frágil.

**D-2 — Servidor estático local como pré-requisito de execução**
DECISION: `python -m http.server 8000` (primário), `py`/`npx serve` (alternativas).
REASON: módulos ES e `fetch` não operam via file:// (CORS).
IMPACT: "um comando" antes de usar o site; offline a partir daí.
ALTERNATIVES: file:// com dados inline; extensão de IDE.
WHY NOT: abandonaria D-1 ou criaria dependência de plugin.

**D-3 — Envelope JSON versionado `{version, items}`**
DECISION: envelope de 2 campos.
REASON: validação e evolução de schema explícitas, custo zero.
IMPACT: `data.items` no fetch; checagem de `version === 1`.
ALTERNATIVES: lista pura; objeto com metadados.
WHY NOT: lista pura não versiona; metadados extras são YAGNI.

**D-4 — `sort` como enum de 5 valores**
DECISION: `'category' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc'`.
REASON: mapeia 1:1 para o `<select>`; impede estado inválido.
IMPACT: comparação trivial em `sortItems`.
ALTERNATIVES: `{key, dir}`; booleanos.
WHY NOT: pares duplicam informação e abrem estados inconsistentes.

**D-5 — Dois modos de apresentação**
DECISION: `sort === 'category'` (padrão) → lista **agrupada** por categoria/subcategoria; ordenação explícita por preço/nome → lista **plana**.
REASON: RF-05 define estado inicial "por categoria" (agrupado) e US-04 exige que o primeiro item seja o menor preço global (só faz sentido em lista plana).
IMPACT: `groupItems` só roda no modo agrupado; 1 flag derivada, não armazenada.
ALTERNATIVES: sempre agrupado (quebra US-04); sempre plano (quebra US-01/RF-01).
WHY NOT: nenhuma das alternativas satisfaz todos os critérios de aceitação. **APROVADO pelo Tech Lead.**

**D-6 — `modifiers[]` e `restrictions[]` no schema**
DECISION: campos estruturados opcionais (default `[]`) além de `effectText`.
REASON: RF-09 exige badges positivas/negativas tipadas; parsing de texto livre é frágil e arriscaria RB-12.
IMPACT: validador nova regra; 2 campos a preencher nas fontes relevantes (Skooma, Tônica, Elixir, Poção de Slot…).
ALTERNATIVES: parsear `effectText`; derivar só de tags.
WHY NOT: parsing viola o princípio "dado tipado > string mágica" e falha com variações de texto. **APROVADO pelo Tech Lead.**

**D-7 — CSS único**
DECISION: um `css/styles.css` com tokens `[data-theme]`.
REASON: página única; evitar ordem de import prematura.
IMPACT: se > ~1.200 linhas, dividir em base/components/themes.
ALTERNATIVES: múltiplos CSS; pré-processador.
WHY NOT: split prematuro sem reuso real.

**D-8 — Testes `node:test` sem framework**
DECISION: `utils/state/filters` DOM-free + testes com stdlib do Node.
REASON: testa a regra de negócio sem npm install.
IMPACT: restrição de design: esses módulos não podem tocar DOM.
ALTERNATIVES: Jest/Vitest; nenhum teste automatizado.
WHY NOT: npm install viola a restrição de zero dependências.

**D-9 — Labels PT-BR em mapa, chaves ASCII no dado**
DECISION: `CATEGORY_LABELS`/`SUBCATEGORY_LABELS` em `utils.js`.
REASON: dado estável e comparável; texto livre em 1 lugar editável.
IMPACT: trocar label = 1 linha; validador rejeita chave desconhecida.
ALTERNATIVES: label embutida no JSON; tradução dinâmica.
WHY NOT: label como chave quebra comparações; i18n framework é over-engineering.

**D-10 — Identificadores em inglês, UI e comentários em pt-BR**
DECISION: §10.1.
REASON: código compatível com o ecossistema; usuário e mantenedor são pt-BR.
IMPACT: consistência por revisão (sem linter).
ALTERNATIVES: tudo pt-BR (quebra convenções de API da linguagem); tudo EN (mantenedor lê menos natural).
WHY NOT: mistura sem regra é o pior dos mundos — por isso a regra é explícita.

**D-11 — Nomes derivados para armas (pendência do REQUIREMENTS risco #3)**
DECISION: `Arma Simples 1d4`, `Arma Simples 1d6`, `Arma Marcial 1d8`, `Arma Marcial 1d10`, `Arma Marcial 1d12`, `Arma Marcial 2d6`, `Arma Versátil 1d6/1d8`, `Arma Versátil 1d8/1d10`.
REASON: a fonte não dá nomes temáticos; inventar "Adaga"/"Espada Longa" seria dado falso (RB-12).
IMPACT: só `name`/`id` no JSON; nenhum código depende do formato. **APROVADO pelo Tech Lead.**

**D-12 — "Caipirinha de Abrasil" mantido fiel à fonte**
DECISION: manter "Abrasil" (typo da fonte).
REASON: RB-12/fidelidade textual ao Discord; correção seria alteração de conteúdo não solicitada.
IMPACT: se o usuário quiser corrigir, é 1 linha no JSON. **APROVADO pelo Tech Lead.**

**D-13 — Contagem corrigida: 50 itens (não 52)**
DECISION: catálogo oficial tem **50 itens** (Bebidas 12, Refeições 6, Pousada 5, Poções 10, Armas 8, Armaduras & Escudo 9).
REASON: a fonte original tem 4 armas marciais (1d8, 1d10, 1d12, 2d6) e 2 armaduras médias (Escamas, Cota de Malha); a contagem "52" da Fase 1 (2+5+2 / 3+3+3+1) estava aritméticamente errada. RB-12 (fidelidade) > contagem documental.
IMPACT: REQUIREMENTS §7/RF/US/Fluxos, PLAN_EXECUCAO e testes de QA corrigidos de 52→50; validador usa 12/6/5/10/8/9 (warning). Inventar 2 itens seria dado falso. **APROVADO pelo Tech Lead.**

**D-14 — `setState` com sort inválido LANÇA TypeError (Fail Fast)**
DECISION: `setState(current, { sort: invalido })` lança `TypeError` (comportamento do `state.js` mantido) em vez de ignorar silenciosamente.
REASON: princípio "Fail Fast" (processo da equipe): sort inválido é bug de programação, não entrada de usuário — a UI só emite valores do enum D-4 e `isValidSort` existe para a borda. Ignorar silenciosamente mascararia erro de wiring no `app.js`.
IMPACT: teste `state.test.mjs` ajustado para `assert.throws`; `app.js` deve garantir valores do `<select>` (fonte única do enum).
ALTERNATIVES: descartar silenciosamente (mascara bugs); validação só na UI (deixa a porta aberta).
WHY NOT: silêncio viola Fail Fast; validação só na UI não defende chamadas internas. **APROVADO pelo Tech Lead.**

**D-15 — `effectText` é o texto descritivo completo do card**
DECISION: `effectText` carrega a descrição + efeito fiel integral da fonte (ex.: bebidas/refeições/pousada/poções); `null` apenas em armas/armaduras (cujo atributo vive em `damage`/`armorClass`/`strengthReq`).
REASON: o schema §5.2 não possui campo `description`; descartar as descrições da fonte seria perda silenciosa de dados (RB-12/RF-13).
IMPACT: `render.js` exibe `effectText` como texto do card; badges derivam de `modifiers`/`restrictions`/`tags` (não do texto). **APROVADO pelo Tech Lead.**

**D-16 — `createInitialState` copia o array de itens (`.slice()`)**
DECISION: `state.items` é cópia rasa do array recebido (comportamento atual do `state.js`), não referência.
REASON: defesa em profundidade da imutabilidade (§7.2): o estado não depende de o chamador não mutar o array original; custo desprezível (1 array de 50 refs).
IMPACT: teste `state.test.mjs` usa `deepStrictEqual` + `notStrictEqual` em vez de `strictEqual`. `setState` preserva `state.items` por referência interna (cópia uma única vez no boot).
ALTERNATIVES: manter referência (decisão registrada no teste da Fase 1).
WHY NOT: a regra de imutabilidade distribuída em "todos os módulos nunca mutam" é mais frágil que uma cópia única na fronteira de entrada do estado. **APROVADO pelo Tech Lead (prevalece sobre a DECISION do teste).**

**D-17 — Modo agrupado com categoria 'all' → 6 grupos planos**
DECISION: `groupItems(items, 'all')` retorna 6 grupos top-level na `CATEGORY_ORDER`, sem subdivisão por subcategoria; a subdivisão por subcategoria só ocorre quando `filters.category` é específica (armas/armaduras). Grupos vazios NÃO são emitidos.
REASON: o contrato `Group[]` é plano (§6.2); subdivisão hierárquica exigiria tipo novo. Subgrupo detalhado só é útil quando o usuário já escolheu a categoria. Grupos vazios criariam cabeçalhos sem itens (ruído de leitura).
IMPACT: `render.js` pinta `Group[]` plano com `.group__title`/`.group__list`; para categoria específica de armas/armaduras, 3/4 grupos na ordem fixa (simples, marciais, versateis | leves, medias, pesadas, escudo). **APROVADO pelo Tech Lead.**

**D-18 — Comando oficial de testes: `node --test` (sem caminho de diretório)**
DECISION: o comando documentado em todos os docs é `node --test` (auto-descoberta) — `node --test tests/` falha no Node 24/Windows.
REASON: o runner trata `tests/` como módulo de entrada nessa combinação; a auto-descoberta cobre `tests/*.test.mjs`.
IMPACT: README/DEPLOYMENT/checklist usam `node --test`. **APROVADO pelo Tech Lead.**
