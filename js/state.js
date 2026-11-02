// state.js — forma e transição do estado único (módulo folha: sem DOM, sem storage, sem imports do projeto).

/**
 * @typedef {'category'|'price-asc'|'price-desc'|'name-asc'|'name-desc'} SortKey
 */

/**
 * @typedef {'loading'|'ready'|'error'} AppStatus
 */

/**
 * @typedef {'NETWORK'|'NOT_FOUND'|'PARSE'|'SCHEMA'|null} ErrorCode
 */

/**
 * @typedef {Object} Filters
 * @property {string} query texto cru do campo de busca
 * @property {number|null} priceMin preço mínimo em PO (null = sem restrição)
 * @property {number|null} priceMax preço máximo em PO (null = sem restrição)
 * @property {'all'|string} category 'all' ou CategoryKey
 * @property {'all'|string} subcategory 'all' ou SubcategoryKey
 */

/**
 * @typedef {Object} AppState
 * @property {AppStatus} status
 * @property {ErrorCode} errorCode
 * @property {string|null} errorMessage detalhe p/ console + modo debug
 * @property {Array<Object>} items itens do JSON (com `_search` pré-computado no boot)
 * @property {Filters} filters
 * @property {SortKey} sort
 * @property {'light'|'dark'} theme
 */

/**
 * Os 5 valores válidos de `sort` (D-4): enum fechado mapeia 1:1 para as opções
 * do `<select>` e impede estado inválido (ex.: só key sem dir).
 *
 * @type {SortKey[]}
 */
export const SORT_KEYS = Object.freeze([
  'category',
  'price-asc',
  'price-desc',
  'name-asc',
  'name-desc',
]);

/**
 * Verifica se um valor é um `SortKey` válido — defesa extra na borda da UI
 * (select corrompido, partial vindo de fora do contrato).
 *
 * @param {*} v valor a testar
 * @returns {boolean} true se pertence ao enum SORT_KEYS
 */
export function isValidSort(v) {
  return SORT_KEYS.includes(v);
}

/**
 * Filtros no padrão (sem restrições): busca vazia, faixa livre, "Todas" as
 * categorias. Retorna objeto NOVO a cada chamada — nunca compartilhe referência.
 *
 * @returns {Filters}
 */
export function initialFilters() {
  return {
    query: '',
    priceMin: null,
    priceMax: null,
    category: 'all',
    subcategory: 'all',
  };
}

/**
 * Estado inicial de sucesso (status `ready`) com os itens carregados.
 * Os filtros/sort/tema partem do padrão (RF-05/RF-06).
 *
 * @param {Array<Object>} [items] itens enriquecidos do JSON
 * @returns {AppState}
 * @throws {TypeError} se `items` não for array — falha rápida p/ bug de contrato no app.js
 */
export function createInitialState(items = []) {
  if (!Array.isArray(items)) {
    throw new TypeError('createInitialState(items): items must be an array');
  }

  return {
    status: 'ready',
    errorCode: null,
    errorMessage: null,
    items: items.slice(),
    filters: initialFilters(),
    sort: 'category',
    theme: 'light',
  };
}

/**
 * Aplica um `partial` sobre o estado atual de forma IMUTÁVEL: `current` nunca
 * é mutado; o retorno é um novo objeto (e um novo objeto `filters`, quando
 * presente no partial) — garantia exigida pelo fluxo setState → derive → render.
 *
 * @param {AppState} current estado atual (não mutado)
 * @param {Partial<AppState>} partial campos a sobrescrever
 * @returns {AppState} novo estado
 * @throws {TypeError} se `partial` não for objeto ou se `partial.sort` for inválido (fail fast)
 */
export function setState(current, partial) {
  if (partial === null || typeof partial !== 'object' || Array.isArray(partial)) {
    throw new TypeError('setState(current, partial): partial must be an object');
  }

  // Validação antes de construir: sort fora do enum é estado inválido, não deve passar (fail fast).
  if ('sort' in partial && !isValidSort(partial.sort)) {
    throw new TypeError(`setState: invalid sort "${partial.sort}"`);
  }

  const next = { ...current, ...partial };

  // `filters` recebe um objeto NOVO (merge raso) para que alterar um filtro
  // nunca altere o objeto filters do estado anterior por referência.
  if (partial.filters !== undefined) {
    next.filters = { ...current.filters, ...partial.filters };
  }

  return next;
}

/**
 * Estado de erro de carregamento (RNF-09): fetch/JSON/envelope falhou.
 * Mantém filtros/sort/tema no padrão para que um retry possa reusar o mesmo estado.
 *
 * @param {string} code código enum (NETWORK|NOT_FOUND|PARSE|SCHEMA)
 * @param {string} message mensagem amigável exibida ao usuário
 * @returns {AppState}
 */
export function createErrorState(code, message) {
  return {
    ...createInitialState([]),
    status: 'error',
    errorCode: code,
    errorMessage: message,
    items: [],
  };
}

/**
 * Estado de carregamento inicial (antes do fetch responder): sem itens e sem
 * erro, para a UI mostrar o placeholder de loading em vez de lista vazia.
 *
 * @returns {AppState}
 */
export function createLoadingState() {
  return { ...createInitialState([]), status: 'loading' };
}
