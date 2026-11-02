# PLANO DE EXECUÇÃO — Fase 3 (Planejamento)
**Projeto:** `lojinha-de-precos` · **Autor:** Tech Lead · **Base:** `docs/REQUIREMENTS.md` (Fase 1) + `docs/ARCHITECTURE.md` (Fase 2, D-1..D-12) · **Status:** Aprovado para execução por subagentes

> **Nota de papel:** o projeto é 100% estático. Os papéis `ai-engineer` e `mobile-engineer` **não são acionados** (regra: só se o projeto exigir). O papel "backend" é mapeado para a **camada de lógica pura em JS** (`utils/state/filters/app`); o papel "database" é mapeado para o **schema do JSON** (`data/items.json` + docs de dados).

---

## 0. Mapa de papéis neste contexto estático

| Papel (dos 12) | Papel no projeto estático |
|---|---|
| `product-manager` | Consultor de requisitos (RF/RB/US) — só em caso de dúvida de escopo |
| `architect` | Dono do contrato (D-1..D-12, §6) — só em caso de divergência de contrato |
| `database-engineer` | **Data**: `data/items.json`, `docs/EMOTES.md`, `docs/DATA.md` |
| `data-engineer` | **Scripts de dados**: `scripts/validate_data.py` |
| `backend-engineer` | **JS Core + Orquestração**: `js/utils.js`, `js/state.js`, `js/filters.js`, `js/app.js` |
| `frontend-engineer` | **HTML/CSS/Render/Tema**: `index.html`, `css/styles.css`, `js/render.js`, `js/theme.js` |
| `qa-engineer` | **Tests**: `tests/*.test.mjs`, `tests/manual-checklist.md` |
| `security-engineer` | **Security**: `docs/SECURITY.md` + auditoria (não escreve código sem dono) |
| `devops-engineer` | **DevOps/Docs**: `scripts/serve.*`, `README.md`, `DEPLOYMENT.md`, `CHANGELOG.md`, `.gitignore` |
| `tech-lead` (eu) | Plano, gate final, resolução de bloqueios |

---

## 1. Árvore de tarefas

```
PROJECT (lojinha-de-precos — MVP v0.1.0)
│
├── DATA ──────────────────────────────────────────────────────────
│   ├── T-01  [database-engineer] data/items.json (50 itens, envelope v1, modifiers/restrictions)
│   │         deps: — · entrega: JSON válido + conferência §7 dos requisitos (12+6+5+10+8+9=50)
│   ├── T-02  [database-engineer] docs/EMOTES.md (mapeamento :emote: → emoji, RF-14)
│   │         deps: T-01 · entrega: nenhum :emote: residual no JSON + tabela de rastreabilidade
│   ├── T-03  [database-engineer] docs/DATA.md (schema, enums, como editar/adicionar item)
│   │         deps: T-01, T-09 · entrega: doc de manutenção do mantenedor (RF-13/RNF-05)
│   └── T-04  [data-engineer] scripts/validate_data.py (schema, enums, ids únicos, contagens, emotes, modifiers)
│             deps: T-01 · entrega: `python scripts/validate_data.py` → exit 0
│
├── SCRIPTS / DEVOPS ─────────────────────────────────────────────
│   ├── T-05  [devops-engineer] scripts/serve.ps1 + scripts/serve.sh
│   │         deps: — · entrega: um comando sobe o servidor (RF-15, D-2)
│   ├── T-06  [devops-engineer] README.md (2 comandos, editar JSON, estrutura, 3 variantes de servidor)
│   │         deps: T-05, T-18 · entrega: onboarding em ≤ 2 comandos
│   ├── T-07  [devops-engineer] docs/DEPLOYMENT.md + CHANGELOG.md v0.1.0 + .gitignore
│   │         deps: T-18 · entrega: runbook local + release notes
│   └── T-08  [devops-engineer] smoke de infraestrutura (servidor sobe, offline RNF-04, 3 comandos)
│             deps: T-05, T-18 · entrega: evidência de execução local
│
├── FRONTEND (HTML/CSS) ──────────────────────────────────────────
│   ├── T-09  [frontend-engineer] index.html (estrutura semântica, filtros, aria-live, estados loading/vazio/erro, meta CSP)
│   │         deps: — (contratos §6 congelados) · entrega: DOM estático completo, a11y estrutural
│   └── T-10  [frontend-engineer] css/styles.css (tokens claro/escuro, mobile-first 320–1440, badges, estados)
│             deps: T-09 · entrega: layout estático sem scroll horizontal, contraste WCAG AA
│
├── JS CORE (lógica pura) ────────────────────────────────────────
│   ├── T-11  [backend-engineer] js/utils.js (normalizeText, debounce, formatPrice, labels, CATEGORY_ORDER)
│   │         deps: — · entrega: folha DOM-free, JSDoc no contrato §6.2
│   ├── T-12  [backend-engineer] js/state.js (createInitialState, setState imutável, initialFilters, isValidSort)
│   │         deps: — · entrega: folha DOM-free, imutabilidade garantida
│   └── T-13  [backend-engineer] js/filters.js (filterItems AND, sortItems+RB-11, groupItems D-5, getSubcategories, enrichItems)
│             deps: T-11 · entrega: RB-10/RB-11/D-5 implementados, retorna cópias
│
├── RENDER / THEME / APP ─────────────────────────────────────────
│   ├── T-14  [frontend-engineer] js/render.js (renderList/Count/Empty/Error/SubcategoryOptions — textContent sempre)
│   │         deps: T-09, T-11 · entrega: render com mock, zero innerHTML
│   ├── T-15  [frontend-engineer] js/theme.js (initTheme/toggleTheme/applyTheme, try/catch, enum validado)
│   │         deps: T-09 · entrega: RF-07 + RNF-08
│   └── T-16  [backend-engineer] js/app.js (boot, loadItems+erros, applyFilters, debounce, bindEvents, file: check)
│             deps: T-01, T-13, T-14, T-15 · entrega: fluxo end-to-end com os 50 itens
│
├── TESTS ────────────────────────────────────────────────────────
│   ├── T-17  [qa-engineer] tests/utils.test.mjs + tests/state.test.mjs
│   │         deps: contrato §6.2 (escrita em paralelo; execução após T-11/T-12) · entrega: `node --test` verde
│   ├── T-18  [qa-engineer] tests/filters.test.mjs (AND, faixa, desempate, "pocao"→Poção, agrupamento, D-5)
│   │         deps: T-13 · entrega: testes verdes cobrindo RB-10/RB-11/US-02..US-04
│   ├── T-19  [qa-engineer] tests/manual-checklist.md (RF-01..RF-15, a11y, CSP, erros, mobile)
│   │         deps: T-16 · entrega: checklist executável item a item
│   └── T-20  [qa-engineer] Execução do checklist + regressão (`node --test` + manual + validador)
│             deps: T-16, T-19, T-04 · entrega: relatório verde/vermelho por RF
│
├── SECURITY ─────────────────────────────────────────────────────
│   ├── T-21  [security-engineer] Auditoria (grep: innerHTML/eval/Function(string)/localStorage fora de theme.js/CSP/inputs)
│   │         deps: T-16 · entrega: lista de achados com severidade + arquivo-alvo
│   ├── T-22  [security-engineer] docs/SECURITY.md (ameaças, mitigações, evidências)
│   │         deps: T-21 · entrega: doc aprovado (RNF-07)
│   └── T-23  [security-engineer → dono aplica] Correções de achados (se houver)
│             deps: T-21 · regra: **o dono do arquivo escreve; security pede** (ver §6)
│
└── GATE / DOCS FINAIS ───────────────────────────────────────────
    ├── T-24  [tech-lead] Code review arquitetural (DAG §12.1, 6 módulos, contratos §6.2, D-4..D-6)
    │          deps: T-16 · entrega: aprovação ou retorno com achados
    └── T-25  [tech-lead] Gate final (10 perguntas do processo) + release v0.1.0
               deps: T-04, T-08, T-20, T-22, T-06, T-07 · entrega: declaração de done
```

---

## 2. Matriz de donos de arquivos (um arquivo = um dono)

| Arquivo | Dono (escrita) | Quem pode pedir mudança |
|---|---|---|
| `data/items.json` | `database-engineer` | Tech Lead, security (via pedido) |
| `docs/EMOTES.md` | `database-engineer` | — |
| `docs/DATA.md` | `database-engineer` | tech-lead |
| `scripts/validate_data.py` | `data-engineer` | qa, database-engineer |
| `scripts/serve.ps1`, `scripts/serve.sh` | `devops-engineer` | tech-lead |
| `index.html` | `frontend-engineer` | security (pedido de CSP), qa (pedido de a11y) |
| `css/styles.css` | `frontend-engineer` | qa (pedido de contraste) |
| `js/utils.js`, `js/state.js`, `js/filters.js`, `js/app.js` | `backend-engineer` | qa (bug), security (XSS/erros) |
| `js/render.js`, `js/theme.js` | `frontend-engineer` | backend (contrato), security (textContent) |
| `tests/*.test.mjs`, `tests/manual-checklist.md` | `qa-engineer` | tech-lead |
| `docs/SECURITY.md` | `security-engineer` | tech-lead |
| `README.md`, `docs/DEPLOYMENT.md`, `CHANGELOG.md`, `.gitignore` | `devops-engineer` | tech-lead, qa |
| `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/PLAN_EXECUCAO.md` | `tech-lead` (somente leitura para os demais) | — |
| `LICENSE` | intocável (existente) | — |

**Regra de conflito:** nenhum subagente escreve em arquivo de outro dono. Se precisar de alteração, **abre achado no relatório de entrega** → Tech Lead encaminha ao dono.

---

## 3. Ordem de execução em rodadas (paralelismo seguro)

| Rodada | Tarefas em PARALELO (sem sobreposição de arquivos) | Sequencial dentro da rodada |
|---|---|---|
| **R1** | `T-01+T-02` (Data) ∥ `T-09` (HTML) ∥ `T-11+T-12` (JS core folhas) ∥ `T-05` (serve scripts) ∥ `T-17` (testes escritos contra contrato) | — |
| **R2** | `T-04` (validador, depende de T-01) ∥ `T-13` (filters, depende T-11) ∥ `T-10` (CSS, depende T-09) ∥ `T-15` (theme, depende T-09) ∥ `T-18` (testes filters) | T-02 antes de T-03 |
| **R3** | `T-14` (render, depende T-09/T-11) ∥ `T-03` (DATA.md) ∥ `T-06` (README) | `T-16` (app.js) **sequencial por último** — depende de T-01, T-13, T-14, T-15 |
| **R4** | `T-19` (checklist) ∥ `T-21` (auditoria) ∥ `T-08` (smoke infra) | `T-20` (QA executa) e `T-22` (SECURITY.md) após T-16 |
| **R5** | Correções de achados (por dono, um por vez no mesmo arquivo) | `T-24` (review tech-lead) → `T-25` (gate) → `T-07` (docs finais) |

**Justificativa do paralelismo:** os contratos de módulo (§6.2) e o schema (§5.2) estão **congelados** — testes, HTML e folhas JS podem ser escritos em paralelo sem esperar implementação; só a *execução* dos testes e o `app.js` são sequenciais.

**Barreiras de sincronização (não paralelizar além destas):**
1. `T-04` exige `T-01` concluído (validador precisa de dado real).
2. `T-16` exige `T-01, T-13, T-14, T-15` concluídos (orquestração acopla tudo).
3. `T-20/T-21` exigem `T-16` concluído.
4. `T-25` exige todas as demais + correções aplicadas.

---

## 4. Definição de pronto (DoD) por área

### Data (`data/items.json`, `EMOTES.md`, `DATA.md`)
- [ ] Envelope `{ "version": 1, "items": [...] }` presente.
- [ ] 50 itens; contagens por categoria conferem com §7 do REQUIREMENTS (12/6/5/10/8/9).
- [ ] Schema §5.2 completo: todos os obrigatórios, tipos corretos, `id` slug único e estável.
- [ ] `modifiers[]`/`restrictions[]` preenchidos onde a RF-09/RB-05 exige (Skooma, Tônica, Elixir, Poção de Slot…).
- [ ] Nenhum `:Emote:` residual (RF-14) — mapeamento registrado em `EMOTES.md`.
- [ ] Armas com nomes derivados D-11; "Caipirinha de Abrasil" intacta (D-12); Skooma em Bebidas (RB-08).
- [ ] `python scripts/validate_data.py` → exit 0, sem erros (warnings de contagem aceitos).

### Frontend (`index.html`, `css/styles.css`, `render.js`, `theme.js`)
- [ ] HTML semântico (`header/main/section/footer`, `ul/li`, `button`, `label for`, `fieldset/legend`).
- [ ] Estados loading / vazio (botão "Limpar filtros") / erro (botão "Tentar novamente") no DOM.
- [ ] Região `aria-live="polite"` + `role="status"` na contagem; `aria-label` no botão de tema.
- [ ] Layout 320–1440 px sem scroll horizontal; alvos ≥ 44 px; foco visível.
- [ ] Tokens `[data-theme]` claros/escuros; contraste WCAG AA nos dois temas; bônus com sinal `+`/`−` além de cor.
- [ ] `render.js`: **zero `innerHTML`** — só `createElement` + `textContent`.
- [ ] `theme.js`: `try/catch` em leitura e escrita de `localStorage`; valor lido validado contra `'light'|'dark'`.

### JS (`utils.js`, `state.js`, `filters.js`, `app.js`)
- [ ] Assinaturas públicas **idênticas** ao §6.2; JSDoc nas folhas.
- [ ] DAG §12.1 respeitada: `utils/state/theme` não importam nada; `filters/render` só importam `utils`; ninguém importa `app.js`.
- [ ] `setState` imutável; `filterItems`/`sortItems` retornam cópias (nunca mutam `items`).
- [ ] RB-10 (AND), RB-11 (desempate), D-5 (agrupado padrão × plano), enum de 5 sorts (D-4).
- [ ] `normalizeText` NFD: `"pocao"` → "Poção", `"sko"` → "Skooma".
- [ ] `app.js`: debounce 200 ms só na busca; erros NOT_FOUND/PARSE/SCHEMA → `status:'error'`; detecta `file:` e orienta; nenhum `catch` vazio.

### Tests
- [ ] `node --test` roda **sem npm install** e passa 100%.
- [ ] Cobrem: normalização, formatPrice, imutabilidade, AND dos 4 filtros, faixa (mín>máx → vazio), desempate RB-11, agrupamento/plano D-5, pluralização PT-BR.
- [ ] `manual-checklist.md` cobre RF-01..RF-15 + RNF-02/03/04/07/08/09 com passos reprodutíveis.
- [ ] Checklist executado e relatório com evidência por RF.

### Security
- [ ] Grep verde: `innerHTML`, `eval`, `new Function`, `setTimeout(string)`, `localStorage` fora de `theme.js`.
- [ ] CSP meta presente e sem violação no console; sem inline script/style.
- [ ] Teste RNF-07 executado: item com `<script>` no nome renderiza como texto.
- [ ] `docs/SECURITY.md` publicado com ameaça → vetor → mitigação → evidência.

### Docs / DevOps
- [ ] README: 2 comandos para rodar (3 variantes: `python`, `py`, `npx serve`), como editar o JSON, aviso `file://`.
- [ ] `DEPLOYMENT.md`, `CHANGELOG.md v0.1.0`, `.gitignore` completos.
- [ ] Servidor sobe e o site funciona offline após servir (RNF-04).

---

## 5. Revisão cruzada planejada (adaptação estática do processo)

| Entrega | Revisor | O que verifica |
|---|---|---|
| `index.html` + `css/styles.css` + `render.js`/`theme.js` (Frontend) | **backend-engineer** | Contratos §6.2, sem `innerHTML`, controles nunca re-renderizados, aria-live, foco preservado |
| `utils/state/filters/app` (JS Core/lógica) | **security-engineer** | XSS por dado do JSON, erros sem `catch` vazio, validação de envelope, debounce, CSP |
| `data/items.json` + `EMOTES.md` (Data/Database) | **qa-engineer** | Conferência item a item vs §7, enums, unicidade de `id`, fidelidade RB-12/D-11/D-12 |
| `validate_data.py` (Data scripts) | **backend-engineer** | Schema do validador ≡ schema do front (§5.2) — mesma regra nos dois lados |
| `tests/*` (QA) | **backend-engineer** | Testes não testam implementation detail, sim comportamento (RB/US) |
| `scripts/serve.*`, `README`, `DEPLOYMENT` (DevOps) | **security-engineer** | Sem segredos, sem dependência oculta (zero npm/CDN), comandos reproduzíveis |
| `app.js` (orquestração) | **frontend-engineer** + **tech-lead** | Wiring de eventos, estados, sem ciclo de import, ordem do boot §2.1 |

**Rodada de revisão obrigatória:** após R4, cada revisor emite achados `BLOQUEANTE | MAJOR | MINOR` apontando **arquivo + dono**. Achados `BLOQUEANTE`/`MAJOR` voltam ao dono antes do gate.

---

## 6. Regra de bloqueio aplicada

**Disparador:** qualquer agente encontrar divergência entre entregas — ex.: JSON não bate com schema §5.2, validador rejeita enum, teste vermelho em função de contrato, `render` esperando campo que `filters` não retorna, contagem ≠ 50.

**Procedimento literal:**
1. **PARAR** — não improvisar correção "por cima", não contornar, não alterar arquivo de outro dono.
2. **IDENTIFICAR** — classificar a divergência: (a) dado × schema, (b) módulo × contrato §6.2, (c) código × requisito RF/RB, (d) implementação × decisão D-*.
3. **NOTIFICAR** — abrir achado `BLOQUEANTE` no relatório: arquivos envolvidos, evidência (comando/saída esperada × real), hipótese.
4. **Tech Lead decide** a correção de origem:
   - (a)/(b) → correção no **dono do dado/módulo** (raramente no contrato);
   - (c)/(d) → Tech Lead decide; se a decisão exigir mudança de arquitetura, devolve ao `architect` e **reaplica a Fase 2 antes de retomar**.
5. **TESTAR** — reexecutar `node --test` (D-18) + `py scripts/validate_data.py` + trecho afetado do checklist.
6. **CONTINUAR** — só então a rodada seguinte é liberada.

> Exemplo concreto: validador acusa `id` duplicado em `items.json` → T-04 para, `database-engineer` corrige, validador verde → retoma. Ninguém "ignora o erro" para fechar rodada.

---

## 7. Riscos do plano + mitigação

| # | Risco | Prob. × Impacto | Mitigação no plano |
|---|---|---|---|
| 1 | Dois subagentes escrevem no mesmo arquivo (perda de trabalho) | Alta × Alta | Matriz de donos (§2) + paralelismo só por rodada (§3); correções sempre pelo dono |
| 2 | Testes escritos em paralelo não batem com a implementação final | Média × Alta | Contratos §6.2 congelados; `qa` escreve contra contrato, não contra código; revisão de testes pelo dono do módulo |
| 3 | `items.json` divergente (contagem, enum, emote) trava o front inteiro | Média × Alta | T-01 é a 1ª barreira; `validate_data.py` (T-04) roda antes do gate; bloqueio §6 |
| 4 | `app.js` acopla tudo e vira gargalo (só roda em R3/R4) | Alta × Média | Ordem da §12.2 respeitada; render testado com mock antes; app por último |
| 5 | Escopo "Should" (persistir filtros, colapsáveis) vazar e atrasar o MVP | Média × Média | Escopo Must-only no plano; Should entra só após T-25, como v0.2.0 |
| 6 | Achado de segurança pedido a tempo de não reabrir tudo | Média × Média | Auditoria T-21 em R4 com `app.js` pronto; correções em R5 antes do gate |
| 7 | Agente "ajuda" alterando `ARCHITECTURE.md`/`REQUIREMENTS.md` | Baixa × Alta | Docs de fase só-escrita pelo Tech Lead (§2); demais são somente-leitura |
| 8 | Falso "done" (compileu = pronto) | Média × Alta | DoD por área (§4) obrigatório no relatório de entrega + gate T-25 com as 10 perguntas |
| 9 | Servidor/python indisponível no Windows do mantenedor | Média × Média | README com 3 variantes (`python`, `py`, `npx serve`); T-08 faz smoke das 3 |
| 10 | Regressão silenciosa após correção de achado | Média × Média | Toda correção reexecuta `node --test` + validador + trecho do checklist (§6, passo 5) |

---

**Próximo passo:** Tech Lead dispara **R1** com subagentes paralelos (`database-engineer` T-01/T-02, `frontend-engineer` T-09, `backend-engineer` T-11/T-12, `devops-engineer` T-05) + `qa-engineer` (T-17, contrato).
