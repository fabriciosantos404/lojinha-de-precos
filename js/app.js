// app.js — entry point: boot (fetch + validação do envelope), wiring de
// eventos e orquestração do fluxo setState → derive → render (§6.2/§7.1).
// Importa TODOS os módulos do projeto; ninguém importa app.js (§12.1).
// DOM aqui restrito a addEventListener e a ler/escrever `value` de controles
// estáticos — construir apresentação é papel exclusivo do render.js (§9/§6.3).

import {
  createErrorState,
  createInitialState,
  createLoadingState,
  initialFilters,
  isValidSort,
  setState,
} from './state.js';
import { enrichItems, filterItems, groupItems, sortItems } from './filters.js';
import {
  renderCount,
  renderEmpty,
  renderError,
  renderList,
  renderLoading,
  renderReady,
  renderSubcategoryOptions,
} from './render.js';
import { applyTheme, initTheme, toggleTheme } from './theme.js';
import { debounce } from './utils.js';

// ---------------------------------------------------------------------------
// Estado e flags de módulo
// ---------------------------------------------------------------------------

/**
 * Estado único da aplicação — só muda via `setState` (§6.3, regra 4).
 * Nasce no boot (estado `loading`) para que o botão de tema já funcione
 * antes do fetch responder (US-05); `null` apenas antes do 1º boot.
 * @type {Object|null}
 */
let appState = null;

/**
 * Flag de idempotência do bindEvents: o #retry reexecuta o ciclo de boot e
 * não pode duplicar listeners (senão cada filtro dispararia 2×).
 * @type {boolean}
 */
let eventsBound = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * getElementById defensivo: ausência vira console.error + null — o chamador
 * faz early-return e o wiring quebrado nunca lança exceção para o usuário.
 *
 * @param {string} id id estável do index.html
 * @returns {Element|null}
 */
function byId(id) {
  const element = document.getElementById(id);

  if (element === null) {
    console.error(`app.js: elemento #${id} ausente no DOM — ação ignorada`);
  }

  return element;
}

/**
 * Detalhe legível de qualquer valor lançado (não assume instanceof Error).
 *
 * @param {*} cause valor capturado no catch
 * @returns {string}
 */
function errorDetail(cause) {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Cria um erro de carregamento com o código enum do contrato
 * (FILE_PROTOCOL | NETWORK | NOT_FOUND | PARSE | SCHEMA — §2.1).
 *
 * @param {string} code código enum
 * @param {string} detail detalhe técnico (destinado SÓ ao console)
 * @param {*} [cause] erro original de origem (opcional)
 * @returns {Error} erro com `.code`
 */
function createLoadError(code, detail, cause) {
  const error = new Error(detail);
  error.code = code;

  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

/**
 * Converte o valor cru de um input de preço em `number | null` (§5.4/RF-04):
 * vazio ou não numérico → null; negativo → null (o input já tem `min="0"`,
 * aqui é defesa contra digitação manual); senão `Number(...)`.
 *
 * @param {string} raw valor do input
 * @returns {number|null} limite aplicável ou null (sem restrição)
 */
function parsePrice(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return null;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

/**
 * Grava o valor padrão num controle estático do index.html (reset de filtros).
 * Elemento ausente → console.error + no-op (nunca lança).
 *
 * @param {string} id id do input/select
 * @param {string} value valor padrão a aplicar
 */
function setControlValue(id, value) {
  const control = byId(id);

  if (control !== null) {
    control.value = value;
  }
}

// ---------------------------------------------------------------------------
// Pipeline derive + render (compartilhado por todos os handlers — §7.1)
// ---------------------------------------------------------------------------

/**
 * Derivação + render (§7.1 passos 4–5): filtra (RB-10), ordena (RB-11) e,
 * quando `sort === 'category'`, agrupa (D-5); depois pinta contagem e o
 * estado correspondente (lista/ready ou vazio). Nunca muta `state.items` —
 * filter/sort devolvem arrays novos (§7.2).
 */
function renderPipeline() {
  if (appState === null) {
    console.error('app.js: renderPipeline chamado sem estado — render ignorado');
    return;
  }

  const filtered = filterItems(appState.items, appState.filters);
  const sorted = sortItems(filtered, appState.sort);

  // D-5: modo agrupado é o padrão; ordenação explícita por preço/nome →
  // lista plana (o primeiro item passa a ser o menor preço global — US-04).
  const payload =
    appState.sort === 'category' ? groupItems(sorted, appState.filters.category) : sorted;

  renderCount(sorted.length); // RF-10: "N itens encontrados"

  if (sorted.length === 0) {
    renderEmpty(); // RF-11/US-03: filtros sem match → estado vazio + Limpar
  } else {
    renderList(payload);
    renderReady();
  }
}

// ---------------------------------------------------------------------------
// Boot (§2.1)
// ---------------------------------------------------------------------------

/**
 * Falha de carregamento (RNF-09): detalhe técnico vai só para o console;
 * o usuário vê a mensagem PT-BR do renderError + botão #retry.
 *
 * @param {*} error erro lançado por loadItems (ou bug inesperado no boot)
 */
function enterErrorState(error) {
  const hasCode = error !== null && typeof error === 'object' && typeof error.code === 'string';
  const code = hasCode ? error.code : 'NETWORK';
  const detail = errorDetail(error);

  if (hasCode) {
    console.error(`app.js: falha ao carregar data/items.json (${code}): ${detail}`, error);
  } else {
    console.error('app.js: falha inesperada no ciclo de boot — exibindo estado de erro genérico', error);
  }

  const theme = appState !== null ? appState.theme : 'light';
  appState = setState(createErrorState(code, detail), { theme });
  renderError(code);
}

/**
 * Ciclo de boot (§2.1): tema → loading → fetch/validação → estado pronto →
 * bind → render inicial. Reexecutável pelo #retry (RNF-09); bindEvents é
 * idempotente, então reexecuções não duplicam listeners.
 *
 * @returns {Promise<void>}
 */
export async function boot() {
  try {
    // 1. Tema (RF-07): no 1º boot resolve via storage/sistema — initTheme já
    //    aplica data-theme antes do fetch; em retry reaplica o tema do próprio
    //    estado (fonte da verdade desde o loading) para não perder um toggle
    //    feito com a persistência indisponível (RNF-08).
    if (appState === null) {
      appState = setState(createLoadingState(), { theme: initTheme() });
    } else {
      applyTheme(appState.theme);
    }

    renderLoading(); // placeholder de carregamento antes do fetch (RNF-09)

    // 2. Fetch + validação do envelope (D-3) + enrichItems (RF-03).
    const items = await loadItems();

    // 3. Estado pronto (D-16: cópia dos itens), preservando o tema já
    //    resolvido — um toggle durante o load continua válido.
    appState = setState(createInitialState(items), { theme: appState.theme });

    bindEvents(); // 4. idempotente (flag eventsBound)
    renderPipeline(); // 5. render inicial: contagem + lista agrupada (D-5)
    renderSubcategoryOptions('all'); // RF-06: subcategoria nasce em "Todas"
  } catch (error) {
    enterErrorState(error);
  }
}

/**
 * Busca e valida `data/items.json` (§5.1/§2.1), devolvendo os itens já
 * enriquecidos com `_search` (RF-03). Qualquer falha lança Error com `.code`
 * enum: FILE_PROTOCOL | NETWORK | NOT_FOUND | PARSE | SCHEMA.
 *
 * @returns {Promise<Object[]>} itens prontos para createInitialState
 * @throws {Error} erro com `.code` em qualquer falha
 */
export async function loadItems() {
  // Módulos ES e fetch não operam via file:// (D-1/D-2) — oriente o usuário.
  if (location.protocol === 'file:') {
    throw createLoadError(
      'FILE_PROTOCOL',
      'página aberta via file:// — módulos ES e fetch exigem o servidor local (RF-15)'
    );
  }

  let response;
  try {
    response = await fetch('data/items.json');
  } catch (cause) {
    throw createLoadError('NETWORK', `fetch de data/items.json rejeitou: ${errorDetail(cause)}`, cause);
  }

  if (!response.ok) {
    throw createLoadError('NOT_FOUND', `HTTP ${response.status} ao buscar data/items.json`);
  }

  let text;
  try {
    text = await response.text();
  } catch (cause) {
    throw createLoadError('NETWORK', `leitura do corpo de data/items.json falhou: ${errorDetail(cause)}`, cause);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (cause) {
    throw createLoadError('PARSE', `JSON.parse falhou em data/items.json: ${errorDetail(cause)}`, cause);
  }

  // Envelope D-3: {version: 1, items: []} — versão desconhecida ou forma
  // errada = SCHEMA (o scripts/validate_data.py é a outra linha de defesa).
  if (
    payload === null ||
    typeof payload !== 'object' ||
    payload.version !== 1 ||
    !Array.isArray(payload.items)
  ) {
    throw createLoadError(
      'SCHEMA',
      'envelope inválido em data/items.json — esperado {version: 1, items: []}'
    );
  }

  return enrichItems(payload.items);
}

// ---------------------------------------------------------------------------
// Atualização de estado (contrato §6.2)
// ---------------------------------------------------------------------------

/**
 * Pipeline §7.1 para mudança de filtro: setState → derive → render.
 *
 * @param {Object} partial filtros a mesclar (merge raso em state.filters)
 */
export function applyFilters(partial) {
  if (appState === null || appState.status !== 'ready') {
    console.error('app.js: applyFilters chamado sem estado pronto — ação ignorada');
    return;
  }

  appState = setState(appState, { filters: partial });
  renderPipeline();
}

/**
 * Mudança de ordenação (RF-05/D-4): a guarda `isValidSort` garante que um
 * valor fora do enum nunca faça o setState lançar por causa da UI (D-14) —
 * o Fail Fast continua valendo para chamadas internas.
 *
 * @param {string} sort valor vindo do select #sort
 */
export function handleSortChange(sort) {
  if (!isValidSort(sort)) {
    console.error(`app.js: ordenação inválida ignorada: "${String(sort)}" (enum D-4)`);
    return;
  }

  if (appState === null || appState.status !== 'ready') {
    console.error('app.js: handleSortChange chamado sem estado pronto — ação ignorada');
    return;
  }

  appState = setState(appState, { sort });
  renderPipeline();
}

// ---------------------------------------------------------------------------
// Handlers de evento
// ---------------------------------------------------------------------------

/**
 * RF-07/US-05: alterna o tema via theme.js (aplica + persiste) e só atualiza
 * o estado — SEM re-render da lista (§7.2: nada na lista depende do tema).
 */
function handleThemeToggle() {
  if (appState === null) {
    console.error('app.js: botão de tema acionado sem estado inicializado — ação ignorada');
    return;
  }

  appState = setState(appState, { theme: toggleTheme(appState.theme) });
}

/**
 * RF-11/US-07: "Limpar filtros" restaura o estado inicial (busca vazia,
 * faixa livre, todas as categorias, ordenação padrão), espelha o reset nos
 * controles do DOM (eles nunca são re-renderizados — §7.1, passo 6) e roda
 * o pipeline de novo.
 */
function resetFilters() {
  if (appState === null || appState.status !== 'ready') {
    console.error('app.js: reset de filtros sem estado pronto — ação ignorada');
    return;
  }

  appState = setState(appState, { filters: initialFilters(), sort: 'category' });

  // Espelho no DOM dos controles estáticos do index.html.
  setControlValue('search', '');
  setControlValue('price-min', '');
  setControlValue('price-max', '');
  setControlValue('category', 'all');
  setControlValue('sort', 'category');
  renderSubcategoryOptions('all'); // select de subcategoria volta para "Todas"

  renderPipeline();
}

/**
 * Liga todos os listeners do index.html (§6.2). Idempotente via flag
 * `eventsBound`: o #retry reexecuta o boot e não pode duplicar handlers.
 * Elemento ausente → console.error + skip (nunca lança — §6.3).
 */
export function bindEvents() {
  if (eventsBound) {
    return;
  }
  eventsBound = true;

  // RF-03: debounce de 200 ms (limite de 300 ms) só na busca; o valor é
  // lido no disparo (sempre o mais recente) e o trim/normalização fica no
  // filters.js. Selects e preço reagem em 'change' direto (§7.1, passo 2).
  const search = byId('search');
  if (search !== null) {
    const onSearchInput = debounce(() => applyFilters({ query: search.value }), 200);
    search.addEventListener('input', onSearchInput);
  }

  const priceMin = byId('price-min');
  if (priceMin !== null) {
    priceMin.addEventListener('change', () => applyFilters({ priceMin: parsePrice(priceMin.value) }));
  }

  const priceMax = byId('price-max');
  if (priceMax !== null) {
    priceMax.addEventListener('change', () => applyFilters({ priceMax: parsePrice(priceMax.value) }));
  }

  // RF-06: trocar categoria zera a subcategoria e repopula o select.
  const category = byId('category');
  if (category !== null) {
    category.addEventListener('change', () => {
      applyFilters({ category: category.value, subcategory: 'all' });
      renderSubcategoryOptions(category.value);
    });
  }

  const subcategory = byId('subcategory');
  if (subcategory !== null) {
    subcategory.addEventListener('change', () => applyFilters({ subcategory: subcategory.value }));
  }

  const sort = byId('sort');
  if (sort !== null) {
    sort.addEventListener('change', () => handleSortChange(sort.value));
  }

  // RF-11/US-07: os dois botões "Limpar filtros" (barra de filtros + estado vazio).
  const clearFilters = byId('clear-filters');
  if (clearFilters !== null) {
    clearFilters.addEventListener('click', resetFilters);
  }

  const clearFiltersEmpty = byId('clear-filters-empty');
  if (clearFiltersEmpty !== null) {
    clearFiltersEmpty.addEventListener('click', resetFilters);
  }

  const themeToggle = byId('theme-toggle');
  if (themeToggle !== null) {
    themeToggle.addEventListener('click', handleThemeToggle);
  }

  // RNF-09: reexecuta o ciclo de boot completo (bindEvents idempotente).
  const retry = byId('retry');
  if (retry !== null) {
    retry.addEventListener('click', () => {
      boot().catch((error) => {
        console.error('app.js: reexecução do boot falhou fora do tratamento interno', error);
      });
    });
  }
}

// Entry point: módulos ES são defer, então o DOM já está pronto quando este
// código executa (o <script type="module"> do index.html garante isso).
boot().catch((error) => {
  console.error('app.js: boot rejeitou fora do tratamento interno', error);
});
