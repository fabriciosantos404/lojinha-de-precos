# manual-checklist.md — Checklist manual de validação (T-19)

> **Projeto:** `lojinha-de-precos` · **Dono do arquivo:** `qa-engineer` · **Fase:** 9 (validação cruzada, ARCHITECTURE §12.2)
> **Base:** `docs/REQUIREMENTS.md` (RF-01..RF-15, RNF-01..RNF-09, US-01..US-08) · `docs/ARCHITECTURE.md` (§9 segurança, D-5..D-19) · `docs/PLAN_EXECUCAO.md` §4 DoD Tests
> **Complemento:** resultados da suíte automatizada e das checagens estáticas → `tests/REGRESSION.md`

---

## Pré-requisitos (antes de começar)

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| P1 | Na raiz do projeto, subir o servidor: `py scripts\serve.ps1` | Servidor ativo e URL `http://localhost:8000` exibida | [ ] |
| P2 | (Alternativas — RF-15) `python -m http.server 8000` ou `npx serve` | Site abre sem etapa de build (`npx serve` → `http://localhost:3000`) | [ ] |
| P3 | Abrir `http://localhost:8000` no navegador (últimas 2 versões de Chrome/Edge/Firefox/Safari — RNF-06) | Página carrega sem erros no Console (F12 → aba Console) | [ ] |
| P4 | Deixar o Console do DevTools aberto durante todo o checklist | Console limpo (só mensagens do próprio teste) | [ ] |
| P5 | Antes de testar, confirmar a base verde: `node --test` e `py scripts/validate_data.py` | `pass 68 / fail 0` e `OK: 50 itens validados, 0 erros` (ver `tests/REGRESSION.md`) | [ ] |

---

## 1. Boot e estados (RF-01, RF-13, D-5, D-17)

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 1.1 | Abrir `http://localhost:8000` e observar o carregamento | Estado **loading** visível ("Carregando itens…") antes da lista aparecer | [ ] |
| 1.2 | Aguardar o carregamento terminar | **50 cards** renderizados; loading some; nenhum erro no Console | [ ] |
| 1.3 | Ler a região de contagem | Texto exato: **"50 itens encontrados"** (`#result-count`, `aria-live`) | [ ] |
| 1.4 | Verificar o modo agrupado (padrão, D-5) | **6 grupos** de título (`h2.group__title`) nesta ordem: **Bebidas, Refeições, Pousada, Poções de Vida, Armas, Armaduras & Escudo** | [ ] |
| 1.5 | Conferir a quantidade de itens por grupo | Bebidas **12** · Refeições **6** · Pousada **5** · Poções de Vida **10** · Armas **8** · Armaduras & Escudo **9** (D-13) | [ ] |
| 1.6 | Conferir que não há subgrupos no modo "Todas as categorias" | Só os 6 grupos top-level; **sem** cabeçalhos Simples/Marciais/… (D-17) | [ ] |

## 2. RF-01 / RF-02 — Categorias e subcategorias (RF-06, D-13)

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 2.1 | No select **Categoria**, escolher cada uma em sequência: Bebidas, Refeições, Pousada, Poções de Vida, Armas, Armaduras & Escudo | Contagens respectivas: **12, 6, 5, 10, 8, 9** — sempre "N itens encontrados" | [ ] |
| 2.2 | Escolher categoria **Armas** → olhar o select **Subcategoria** | Opções: **Todas, Simples, Marciais, Versáteis** (ordem fixa) | [ ] |
| 2.3 | Escolher categoria **Armaduras & Escudo** → olhar o select **Subcategoria** | Opções: **Todas, Leves, Médias, Pesadas, Escudo** (ordem fixa) | [ ] |
| 2.4 | Escolher categoria **Bebidas** (ou Refeições/Pousada/Poções) → olhar o select **Subcategoria** | Apenas a opção **Todas** (categorias sem subcategoria) | [ ] |
| 2.5 | Categoria **Armas** + Subcategoria **Marciais** | **Exatamente 4 itens** (D-13) e contagem "4 itens encontrados" | [ ] |
| 2.6 | Armas + **Simples** / Armas + **Versáteis** | **2 itens** em cada | [ ] |
| 2.7 | Armaduras + **Leves** / **Médias** / **Pesadas** / **Escudo** | **3 / 2 / 3 / 1** itens respectivamente | [ ] |
| 2.8 | Com categoria **Armas** e ordenação padrão | **3 grupos** (Simples, Marciais, Versáteis) na ordem fixa (D-17) | [ ] |
| 2.9 | Voltar categoria para **Todas as categorias** | Subcategoria volta para **Todas**; 6 grupos e 50 itens restaurados | [ ] |

## 3. RF-03 — Busca por nome (US-02, D-13)

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 3.1 | Digitar `sko` no campo **Buscar item** | Apenas **Skooma**; contagem **"1 item encontrado"** | [ ] |
| 3.2 | Digitar `pocao` (sem acento) | **9 itens** — todas as Poções de Cura + Poção de Slot; **Elixir da Vida NÃO aparece** (não casa com "pocao", D-13) | [ ] |
| 3.3 | Digitar `POÇÃO` / `Skooma` (caixa alta e com acento) | Mesmos resultados das buscas equivalentes (normalização NFD — RF-03) | [ ] |
| 3.4 | Apagar o campo (deixar `""`) | **50 itens** restaurados; contagem "50 itens encontrados" | [ ] |
| 3.5 | Digitar rápido (ex.: `skooma` de uma vez) e cronometrar até a contagem mudar | Atualização acontece **~200 ms** após parar de digitar (debounce; limite RF-03 = 300 ms) — **não** atualiza a cada tecla | [ ] |
| 3.6 | Buscar `xyz` | Estado vazio (ver seção 8) | [ ] |

## 4. RF-04 — Faixa de preço (US-03, RB-10)

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 4.1 | Mínimo `5` e Máximo `15` (demais filtros no padrão) | **20 itens** ("20 itens encontrados") | [ ] |
| 4.2 | Mínimo `20` e Máximo `5` (mín > máx) | **Estado vazio** — "Nenhum item encontrado" + botão "Limpar filtros" | [ ] |
| 4.3 | Deixar os dois campos **vazios** | Sem limite de preço → **50 itens** | [ ] |
| 4.4 | Digitar `0` no mínimo (aceita `min="0"` do input) | Campo aceita 0; como o catálogo não tem item de preço 0 (menor preço = 1 PO), o filtro **não restringe** → 50 itens | [ ] |
| 4.5 | Tentar digitar valor negativo no mínimo/máximo | Input com `min="0"` bloqueia; se aceito temporariamente, a defesa do parser ignora o limite (lista inalterada) | [ ] |
| 4.6 | Busca `pocao` + faixa 5–15 (AND — RB-10) | **3 itens**: Cura Menor (5), Cura Básica (10), Cura Comum (15) | [ ] |
| 4.7 | Só máximo `20` | Poções ≤ 20 PO: Cura Menor, Básica, Comum, Aumentada (interseção busca ∩ faixa) | [ ] |

## 5. RF-05 — Ordenação (US-04, RB-11, D-5)

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 5.1 | Abrir o select **Ordenação** | **5 opções**: Categoria (padrão) · Preço: menor → maior · Preço: maior → menor · Nome: A → Z · Nome: Z → A | [ ] |
| 5.2 | Escolher **Preço: menor → maior** | Lista vira **plana** (sem grupos — D-5); os **5 primeiros têm 1 PO** em ordem alfabética: **Cerveja Comum, Chá Gelado de Ervas, Copo de Leite, Refeição Simples, Suco de Fruta Fresca** (empate por nome — RB-11) | [ ] |
| 5.3 | Continuar na mesma ordenação e olhar o final da lista | Último item = **Armadura de Placas (150 PO)**; contagem **inalterada** (50) | [ ] |
| 5.4 | Conferir o critério do RF-05 | **Cura Menor (5 PO)** aparece **antes** de **Cura Básica (10 PO)** | [ ] |
| 5.5 | Escolher **Preço: maior → menor** | Ordem exatamente espelhada (primeiro 150 PO, últimos os de 1 PO); contagem inalterada | [ ] |
| 5.6 | Escolher **Nome: A → Z** / **Nome: Z → A** | Primeiro = **Arma Marcial 1d10** / último = **Vinho de Boa Qualidade** (e o inverso em Z→A) | [ ] |
| 5.7 | Voltar para **Categoria (padrão)** | Lista volta ao **modo agrupado** com os 6 grupos e 50 itens | [ ] |
| 5.8 | Ordenar por preço e depois aplicar um filtro (ex.: Bebidas) | Ordenação é mantida e a contagem reflete só o filtro (RB-10: ordenação não altera o conjunto) | [ ] |

## 6. RF-07 — Modo escuro/claro (US-05)

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 6.1 | Clicar no botão de tema (canto superior direito) | Tema alterna **imediatamente**; `<html data-theme="dark">` (ou `light`) muda na aba Elements | [ ] |
| 6.2 | Recarregar a página (F5) | Tema escolhido **permanece** (persistência em `localStorage["theme"]`) | [ ] |
| 6.3 | Inspecionar o botão de tema em cada estado | `aria-label` = **"Ativar modo escuro"** (tema claro) / **"Ativar modo claro"** (tema escuro) e `aria-pressed` = `false` / `true` | [ ] |
| 6.4 | Limpar o storage (DevTools → Application → Local Storage → apagar chave `theme`) e recarregar | Tema segue a **preferência do sistema** (`prefers-color-scheme`) — padrão RF-07 | [ ] |
| 6.5 | Alternar o tema **durante o carregamento** (logo após abrir a página) | Botão funciona desde o loading (estado `loading` já carrega o tema) e o tema não se perde após o fetch | [ ] |
| 6.6 | Alternar o tema com a lista aberta | **Nenhum re-render da lista** (foco/scroll preservados — §7.2) | [ ] |

## 7. RF-08 / RF-09 — Badges de atributos e efeitos (US-06, D-6, D-15, D-19)

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 7.1 | Filtrar **Poções de Vida** e abrir o card da **Poção de Cura Básica** | O efeito de cura (**2d4+2**) aparece no **texto de descrição** do card (`effectText`) — **não** existe badge de cura dedicada (D-19) | [ ] |
| 7.2 | Buscar **Skooma** e olhar as badges | Badge **verde** `+1 For/Dex/Con` e badge **vermelha** `-1 Int/Sab/Car`, **ambas com sinal** (não dependem só da cor — risco #11) | [ ] |
| 7.3 | Mesmo card da Skooma | Badge de tag **`droga`** e badge de duração **`[Descanso Curto]`** | [ ] |
| 7.4 | Buscar **Placas** (Armadura de Placas) | Badges **`CA 18`**, **`FOR 15`** e **`50 kg`** | [ ] |
| 7.5 | Filtrar **Pousada** (5 itens) | Cada card exibe preço no formato **`N PO / noite`** + badge **`por noite`** (RB-02) | [ ] |
| 7.6 | Buscar **Elixir** | Badges de restrição **`não acumulativo`** e **`cura total`** + duração **`[Descanso Longo]`** | [ ] |
| 7.7 | Buscar **Tônica dos Magos** | Badge de bônus **`+1 Concentração/Percepção`** (verde) + duração **`[Descanso Curto]`** | [ ] |
| 7.8 | Filtrar **Armas** | Cada card exibe badge de **dano** (ex.: `1d8`; versáteis `1d6/1d8`) e de **peso** (`N kg`) | [ ] |
| 7.9 | Filtrar **Armaduras** e checar Escudo e armaduras pesadas | Escudo → badge `CA +2`; pesadas → badge `FOR …`; todas com peso | [ ] |
| 7.10 | Conferir que **todo** card tem preço em **PO** (RB-01) | Badge/preço sempre visível no cabeçalho do card, sem conversão para outras moedas | [ ] |

## 8. RF-10 / RF-11 — Contagem e estado vazio (US-07)

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 8.1 | Trocar filtros e observar a contagem | Atualiza **a cada** mudança: 50 → 12 (Bebidas) → 4 (Marciais) → 1 (Skooma) → 0 | [ ] |
| 8.2 | Buscar `skooma` | Singular correto: **"1 item encontrado"** | [ ] |
| 8.3 | Buscar `xyz` | Contagem **"Nenhum item encontrado"** + painel **"Nenhum item encontrado."** com botão **"Limpar filtros"** | [ ] |
| 8.4 | Clicar em **"Limpar filtros"** (tanto o da barra de filtros quanto o do estado vazio) | **50 itens** restaurados e todos os controles resetados: busca vazia, faixa vazia, categoria "Todas as categorias", subcategoria "Todas", ordenação "Categoria (padrão)" | [ ] |
| 8.5 | Combinar busca impossível + faixa estreita (Fluxo 5) | Estado vazio com ambos; "Limpar filtros" restaura tudo | [ ] |

## 9. RF-15 / RNF-04 — Servidor local e offline

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 9.1 | **Variante 1:** `py scripts\serve.ps1` (Windows) — ou `./scripts/serve.sh` (macOS/Linux) | Servidor sobe em `http://localhost:8000` e o site funciona | [ ] |
| 9.2 | **Variante 2:** `python -m http.server 8000` (na raiz do projeto) | Mesmo resultado em `http://localhost:8000` | [ ] |
| 9.3 | **Variante 3:** `npx serve` | Site funciona em `http://localhost:3000` (baixa sob demanda, sem `npm install` do projeto) | [ ] |
| 9.4 | Com o site aberto, **desabilitar a rede** (Wi-Fi/ethernet) e recarregar com **Ctrl+Shift+R** | 50 itens renderizam normalmente (RNF-04); aba **Network** sem requisições a domínios externos | [ ] |
| 9.5 | Reativar a rede | Nada muda (o site já funcionava offline) | [ ] |
| 9.6 | Com o wrapper em execução, abrir o **IP da LAN** na porta — ex.: `http://192.168.x.x:8000` (achar o IP com `ipconfig`/`ifconfig`) | **Conexão RECUSADA** (connection refused / timeout) — os wrappers sobem com `--bind 127.0.0.1` (SECURITY.md **M1**, DEPLOYMENT §8); `http://localhost:8000` segue **200** | [ ] |
| 9.7 | Com o site aberto em `http://localhost:8000`, inspecionar a região de estados no Elements (e o Console) | `js/boot-guard.js` é **neutro em `http://`** (early-return): `#state-loading` visível, `#state-error` oculto com o texto padrão do HTML — **nenhuma alteração de UI** causada pelo guard e nenhum aviso no Console | [ ] |

## 10. RNF-02 — Acessibilidade

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 10.1 | Pressionar **Tab** repetidamente desde o topo | Todos os controles são alcançáveis **por teclado**: tema → busca → preço mín → preço máx → categoria → subcategoria → ordenação → Limpar filtros (e "Limpar filtros"/"Tentar novamente" quando visíveis) | [ ] |
| 10.2 | Navegar com **Tab** e observar cada foco | **Foco visível** em todos os elementos interativos (estilo `:focus-visible`) | [ ] |
| 10.3 | Acionar selects/botões com **Enter/Espaço** | Ações disparam corretamente sem mouse | [ ] |
| 10.4 | Com **leitor de tela** ativo (NVDA/VoiceOver), aplicar um filtro | A região de contagem **anuncia** a mudança ("50 itens encontrados" → "12 itens encontrados") via `aria-live="polite"` + `role="status"` | [ ] |
| 10.5 | Verificar os alvos de toque (DevTools → medir botões/inputs) | Altura mínima **≥ 44 px** (`--control-min-h: 44px`) | [ ] |
| 10.6 | Inspecionar contraste de texto/badges nos **dois temas** (DevTools ou extensão de contraste) | **WCAG AA (4.5:1)** em tema claro e escuro | [ ] |
| 10.7 | Checar badges de bônus/malus | Comunicação **não só por cor**: sinal `+`/`−` presente (risco #11) | [ ] |
| 10.8 | Conferir HTML dos cards | Emoji do card com `aria-hidden="true"`; HTML semântico (`button`, `label for`, `fieldset/legend`, `ul/li`) | [ ] |

## 11. RNF-03 — Responsividade

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 11.1 | Redimensionar para **320 px** | **Sem scroll horizontal**; conteúdo legível | [ ] |
| 11.2 | A 320 px, olhar a área de filtros | Campos **empilhados em 1 coluna** (grid single-column abaixo de 600 px) | [ ] |
| 11.3 | **640 px** | Cards em 2 colunas; filtros em 2 colunas; sem scroll horizontal | [ ] |
| 11.4 | **1000 px** | Cards em 3 colunas; filtros em 3 colunas; sem scroll horizontal | [ ] |
| 11.5 | **1440 px** | Layout completo, filtros em 4 colunas; sem scroll horizontal | [ ] |
| 11.6 | Em viewport mobile (DevTools device mode), tocar em botões/inputs | Alvos de toque utilizáveis (≥ 44 px) | [ ] |

## 12. RNF-07 — Segurança / XSS via JSON ⚠️ requer reversão

> ⚠️ **Procedimento com reversão obrigatória.** Edite `data/items.json` (arquivo de `database-engineer` — aqui é apenas **teste temporário**) e **reverta ao final**.

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 12.1 | Fazer backup de `data/items.json` | Backup guardado (ex.: cópia em `%TEMP%`) | [ ] |
| 12.2 | Adicionar um item temporário no array `items` com `"name": "<script>alert(1)</script>"` (e `id` único, `category` válida, `price` ≥ 0) | JSON permanece sintaticamente válido | [ ] |
| 12.3 | Recarregar o site | O `<script>` aparece **como TEXTO no card**; **`alert(1)` NÃO executa**; nenhum erro de CSP no Console | [ ] |
| 12.4 | Inspecionar o card no Elements | Nó de texto (nó `<script>` inexistente no DOM) — `textContent` aplicado (§9) | [ ] |
| 12.5 | **REVERTER** o `data/items.json` para o estado original | Arquivo idêntico ao backup (`git status` limpo) | [ ] |
| 12.6 | Rodar `py scripts/validate_data.py` e `node --test` após reverter | Exit 0 e `pass 68 / fail 0` | [ ] |
| 12.7 | Recarregar o site | 50 itens normais restaurados | [ ] |

## 13. RNF-08 — `localStorage` indisponível (aba privada)

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 13.1 | Abrir o site em uma **aba anônima/privada** (ou bloqueie o storage via DevTools) | Site carrega normalmente com os 50 itens | [ ] |
| 13.2 | Alternar o tema 2–3 vezes | Tema alterna **sem erro no Console** (apenas **1** `console.warn` de falha de storage é aceitável — RNF-08) | [ ] |
| 13.3 | Recarregar na aba privada | Tema volta ao padrão (não persistiu) — comportamento esperado, **sem quebra** | [ ] |

## 14. RNF-09 — Falha de carregamento do JSON

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 14.1 | Com o servidor rodando, **renomear** `data/items.json` (ex.: `items.json.bak`) | — | [ ] |
| 14.2 | Recarregar o site | **Estado de erro amigável** (mensagem PT-BR) + botão **"Tentar novamente"** — **não** tela branca; detalhe técnico só no Console (`NOT_FOUND`) | [ ] |
| 14.3 | Clicar em **"Tentar novamente"** com o arquivo ainda ausente | Erro reaparece; **nenhum erro de JS não tratado**; listeners não duplicam (filtro continua reagindo 1×) | [ ] |
| 14.4 | **Restaurar** o arquivo e clicar em "Tentar novamente" (ou recarregar) | **50 itens** voltam; contagem "50 itens encontrados" | [ ] |
| 14.5 | (Opcional) Quebrar a sintaxe do JSON (vírgula sobrando) e recarregar | Estado de erro do tipo **`PARSE`** com mensagem amigável; restaurar depois | [ ] |

## 15. `file://` — abertura sem servidor (D-2, RF-15)

> **Guard (2026-11-04):** `js/boot-guard.js` (script **clássico**, antes do módulo) assume em `file://`: troca `#state-loading` pela orientação em `#state-error` e esconde `#retry` (não há handler — `app.js` é módulo e não roda). Em `http://` ele **não faz nada** (ver 9.7). O passo 15.2 reflete esse comportamento novo e cobre o achado "FILE_PROTOCOL inalcançável" do T-19.

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 15.1 | **Fechar o servidor** e abrir `index.html` por **duplo clique** no Explorer | O site **não** fica em tela branca nem preso em "Carregando itens…": aparece a orientação PT-BR do guard (`FILE_PROTOCOL` de `js/render.js` é a alternativa — ver 15.4) | [ ] |
| 15.2 | Duplo-clique em `index.html` → observar a região de estados (`#results`) | `#state-error` **visível** com a mensagem do guard (cita `py scripts/serve.ps1` **e** `http://localhost:8000`), `#state-loading` e `#retry` **ocultos**, sem "Carregando itens…" eterno | [ ] |
| 15.3 | Olhar o Console do DevTools durante o 15.2 | **Zero** recusa de CSP (`Refused to load the script` / `script-src 'self'`) — se aparecer, o guard não roda em `file://` → **registrar como achado** (não é falha silenciosa aceitável) | [ ] |
| 15.4 | (Defesa) Se a orientação vier com outro texto ou com botão "Tentar novamente" | Navegador que **permite** módulo ES em `file://` → `app.js` assume e mostra a mensagem `FILE_PROTOCOL` de `render.js` (com `#retry` funcional) — **aceitável**; registrar **qual** das duas mensagens apareceu | [ ] |
| 15.5 | Se ainda assim aparecer "Carregando itens…" eterno com erro de CORS no Console (guard não executou) | **Registrar como achado** no relatório e reabrir via servidor — **não** alterar código neste teste | [ ] |
| 15.6 | Voltar a subir o servidor e recarregar | Site normal de novo; "Carregando itens…" volta a aparecer antes da lista (guard neutro — 9.7) | [ ] |

## 16. CSP — Content-Security-Policy

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 16.1 | Carregar a página e ler o Console | **Zero** mensagens `Refused to violate the Content Security Policy` | [ ] |
| 16.2 | Verificar no Elements a `<meta http-equiv="Content-Security-Policy">` | Presente com `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'` — **sem `'unsafe-inline'`** | [ ] |
| 16.3 | Conferir o HTML | Nenhum atributo `style=`/`onclick=` inline; **2** tags `<script>` (guard clássico + módulo), **ambas com `src` relativo** — nenhum script inline | [ ] |
| 16.4 | (DevTools) Network → filtrar por domínios externos | Nenhuma requisição fora de `localhost` (zero CDN/fontes externas) | [ ] |

## 17. Sincronia filtros × render

| # | Passo | Resultado esperado | Status |
|---|---|---|---|
| 17.1 | Trocar de **Todas** → **Armas** | Subselect **repopulado** com Simples/Marciais/Versáteis e resetado para **Todas**; lista = 8 itens em 3 grupos | [ ] |
| 17.2 | Escolher **Marciais** e depois trocar a categoria para **Armaduras & Escudo** | Subcategoria **repopulada** (Leves/Médias/Pesadas/Escudo) e voltada para **Todas**; lista = 9 itens | [ ] |
| 17.3 | Escolher **Pesadas** e depois voltar a categoria para **Todas as categorias** | Subselect só com **Todas**; 50 itens e 6 grupos restaurados | [ ] |
| 17.4 | Aplicar filtro + busca + ordenação e clicar em **Limpar filtros** | Subselect e todos os controles em sincronia com o estado padrão (nenhum valor "fantasma") | [ ] |
| 17.5 | Trocar categoria durante a digitação na busca | Nenhum estado inconsistente: contagem sempre reflete a **interseção** atual (RB-10) | [ ] |

---

## Resumo por RF (preencher na execução)

| Requisito | Escopo do checklist | Status |
|---|---|---|
| RF-01 | 1.2–1.6, 2.1 | [ ] |
| RF-02 | 2.2–2.8 | [ ] |
| RF-03 | 3.1–3.6 | [ ] |
| RF-04 | 4.1–4.7 | [ ] |
| RF-05 | 5.1–5.8 | [ ] |
| RF-06 | 2.1–2.9, 17.1–17.5 | [ ] |
| RF-07 | 6.1–6.6 | [ ] |
| RF-08 | 7.1, 7.4–7.10 | [ ] |
| RF-09 | 7.2, 7.3, 7.7 | [ ] |
| RF-10 | 1.3, 8.1, 8.2 | [ ] |
| RF-11 | 8.3–8.5 | [ ] |
| RF-13 | 1.2, 12.x | [ ] |
| RF-15 | 9.1–9.7, 15.x | [ ] |
| RNF-02 | 10.1–10.8 | [ ] |
| RNF-03 | 11.1–11.6 | [ ] |
| RNF-04 | 9.4, 9.5, 16.4 | [ ] |
| RNF-06 | P3, P4 | [ ] |
| RNF-07 | 12.1–12.7 | [ ] |
| RNF-08 | 13.1–13.3 | [ ] |
| RNF-09 | 14.1–14.5 | [ ] |

> **Verificações novas em 2026-11-04:** **9.6** = exposição em LAN bloqueada por `--bind 127.0.0.1` (SECURITY.md **M1**) · **9.7 + 15.1–15.6** = comportamento do guard `js/boot-guard.js` (correção do achado "FILE_PROTOCOL inalcançável" do T-19). Ambas sem cobertura automatizada (exigem navegador/rede) → só aqui.

**Não coberto por este checklist (automatizado em `tests/`):** normalização de acentos, AND dos filtros, desempate RB-11, agrupamento D-5, imutabilidade do `setState`, `formatPrice` — ver `tests/REGRESSION.md`.
