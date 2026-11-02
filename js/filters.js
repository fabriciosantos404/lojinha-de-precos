// filters.js — derivação de dados pura: filtra (RB-10), ordena (RB-11), agrupa (D-5) e enriquece itens.
// Módulo DOM-free: importa APENAS utils.js (DAG §12.1: filters → utils; nada mais). Nunca muta arrays/objetos de entrada.

import { normalizeText, CATEGORY_LABELS, SUBCATEGORY_LABELS, CATEGORY_ORDER } from './utils.js';

/**
 * @typedef {{ key: string, label: string, items: Object[] }} Group
 */

/**
 * @typedef {'category'|'price-asc'|'price-desc'|'name-asc'|'name-desc'} SortKey
 */

// Ordem fixa das subcategorias por categoria (RF-02): mesma ordem da fonte.
// Só armas e armaduras têm subcategorias; é constante interna (não faz parte
// do contrato público — use getSubcategories para obter uma cópia).
const SUBCATEGORY_ORDER = Object.freeze({
  armas: Object.freeze(['simples', 'marciais', 'versateis']),
  armaduras: Object.freeze(['leves', 'medias', 'pesadas', 'escudo']),
});

/**
 * Compara nomes com locale pt-BR e sensitivity 'base' (RB-11): caixa e acento
 * não desempatam ("Poção" ≈ "pocao"), deixando o desempate real para o
 * próximo critério. Fallback sem locale se o runtime lançar (nunca propaga).
 *
 * @param {*} a valor do nome A
 * @param {*} b valor do nome B
 * @returns {number} negativo, 0 ou positivo
 */
function compareNames(a, b) {
  const sa = String(a === null || a === undefined ? '' : a);
  const sb = String(b === null || b === undefined ? '' : b);

  try {
    return sa.localeCompare(sb, 'pt-BR', { sensitivity: 'base' });
  } catch {
    // Intl indisponível/incompleto: comparação por code unit (determinística).
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  }
}

/**
 * Compara strings sem locale — usado para `id` (slug ASCII): ordem
 * determinística independente de locale do navegador (RB-11).
 *
 * @param {*} a valor A
 * @param {*} b valor B
 * @returns {number} negativo, 0 ou positivo
 */
function compareStrings(a, b) {
  const sa = String(a === null || a === undefined ? '' : a);
  const sb = String(b === null || b === undefined ? '' : b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * Normaliza um limite de faixa de preço (§5.4): `null`/`undefined`/'' (campo
 * vazio) = sem restrição; número ou string numérica é coerido com `Number()`;
 * valor não numérico lança TypeError — contrato `number | null` do state.js
 * violado é bug de programação, não entrada do usuário (fail fast, D-14).
 *
 * @param {*} value valor cru de filters.priceMin/priceMax
 * @param {string} field nome do campo (mensagem de erro)
 * @returns {number|null} limite numérico ou null
 * @throws {TypeError} se não for finito
 */
function normalizeLimit(value, field) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const n = Number(value);

  if (!Number.isFinite(n)) {
    throw new TypeError(`filterItems: ${field} must be a finite number or null`);
  }

  return n;
}

/**
 * Monta um Group (contrato §6.2) — fábrica única para manter a forma uniforme.
 *
 * @param {string} key chave do grupo (subcategoria ou categoria)
 * @param {string} label label PT-BR já resolvido
 * @param {Object[]} items itens do grupo (array novo)
 * @returns {Group}
 */
function buildGroup(key, label, items) {
  return { key, label, items };
}

/**
 * Agrupa por categoria na ordem CATEGORY_ORDER — modo agrupado com
 * category='all' (D-17): grupos top-level por categoria, SEM subdivisão por
 * subcategoria; itens mantêm a ordem de entrada dentro de cada grupo.
 *
 * @param {Object[]} items itens filtrados (não mutados)
 * @returns {Group[]} grupos na ordem fixa das categorias
 */
function groupByCategory(items) {
  const buckets = new Map();

  for (const item of items) {
    const key = item.category;
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(item);
  }

  const groups = [];
  const emitted = new Set();

  // Ordem fixa CATEGORY_ORDER primeiro — só categorias presentes nos dados
  // (grupo vazio não é emitido: header sem itens quebraria a leitura).
  for (const key of CATEGORY_ORDER) {
    const bucket = buckets.get(key);
    if (bucket && bucket.length > 0) {
      groups.push(buildGroup(key, CATEGORY_LABELS[key] ?? key, bucket));
      emitted.add(key);
    }
  }

  // Defesa: categoria fora do enum (dado corrompido) entra em ordem de primeira
  // aparição em vez de descartar item silenciosamente.
  for (const [key, bucket] of buckets) {
    if (!emitted.has(key)) {
      groups.push(buildGroup(key, CATEGORY_LABELS[key] ?? key, bucket));
    }
  }

  return groups;
}

/**
 * Agrupa por subcategoria na ordem fixa da categoria (RF-02) — usado quando
 * `filters.category` é específica e a categoria tem subcategorias.
 *
 * @param {Object[]} items itens filtrados (não mutados)
 * @param {string} category CategoryKey específica (armas/armaduras)
 * @param {string[]} order ordem fixa das subcategorias dessa categoria
 * @returns {Group[]} grupos na ordem fixa de subcategorias
 */
function groupBySubcategory(items, category, order) {
  const buckets = new Map();
  // Itens sem subcategoria válida (RB-03 garante subcategoria em armas e
  // armaduras; este balde é só para nunca descartar item por dado corrompido).
  const fallback = [];

  for (const item of items) {
    const key = item.subcategory;
    if (typeof key === 'string' && key !== '') {
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key).push(item);
    } else {
      fallback.push(item);
    }
  }

  const groups = [];
  const emitted = new Set();

  for (const key of order) {
    const bucket = buckets.get(key);
    if (bucket && bucket.length > 0) {
      groups.push(buildGroup(key, SUBCATEGORY_LABELS[key] ?? key, bucket));
      emitted.add(key);
    }
  }

  // Defesa: subcategoria fora do enum entra no fim, sem perder item.
  for (const [key, bucket] of buckets) {
    if (!emitted.has(key)) {
      groups.push(buildGroup(key, SUBCATEGORY_LABELS[key] ?? CATEGORY_LABELS[category] ?? key, bucket));
    }
  }

  // Rótulo do balde de retorno: SUBCATEGORY_LABELS[key] ?? CATEGORY_LABELS[category] (contrato §6.2).
  if (fallback.length > 0) {
    groups.push(buildGroup(category, CATEGORY_LABELS[category] ?? category, fallback));
  }

  return groups;
}

/**
 * Filtra itens combinando TODOS os critérios por E (RB-10): busca ∩ faixa de
 * preço ∩ categoria ∩ subcategoria. Retorna subarray NOVO (o array de entrada
 * nunca é mutado). Busca usa `_search` pré-computado (enrichItems) — fallback
 * defensivo: `normalizeText(item.name)` quando `_search` ausente (RF-03:
 * "pocao" encontra "Poção").
 *
 * Regras (§5.4): query vazia/whitespace = sem busca; `priceMin`/`priceMax`
 * `null` = sem limite; `priceMin > priceMax` → `[]` (US-03: estado vazio +
 * aviso); `category`/`subcategory` `'all'` = não filtram — mas subcategoria
 * específica é aplicada mesmo com `category='all'` (defesa, AND puro).
 *
 * @param {Object[]} items itens enriquecidos (com `_search`)
 * @param {Object} filters {query, priceMin, priceMax, category, subcategory}
 * @returns {Object[]} novo array com os itens que passam em todos os filtros
 * @throws {TypeError} se `items` não for array ou `filters` não for objeto
 */
export function filterItems(items, filters) {
  if (!Array.isArray(items)) {
    throw new TypeError('filterItems(items, filters): items must be an array');
  }
  if (filters === null || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new TypeError('filterItems(items, filters): filters must be an object');
  }

  // Busca: só filtra quando sobra texto após normalizar (NFD + minúsculas) e
  // trim — query vazia ou só espaços não restringe o conjunto.
  const query = typeof filters.query === 'string' ? normalizeText(filters.query).trim() : '';
  const min = normalizeLimit(filters.priceMin, 'priceMin');
  const max = normalizeLimit(filters.priceMax, 'priceMax');
  const category = typeof filters.category === 'string' ? filters.category : 'all';
  const subcategory = typeof filters.subcategory === 'string' ? filters.subcategory : 'all';

  // US-03: faixa invertida (mín > máx) = resultado vazio (o render exibe o aviso).
  if (min !== null && max !== null && min > max) {
    return [];
  }

  return items.filter((item) => {
    if (query !== '') {
      const haystack =
        item && typeof item._search === 'string' ? item._search : normalizeText(item && item.name);
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (min !== null || max !== null) {
      const price = Number(item && item.price); // preço sempre numérico (schema §5.2)
      if (min !== null && !(price >= min)) {
        return false;
      }
      if (max !== null && !(price <= max)) {
        return false;
      }
    }

    if (category !== 'all' && item.category !== category) {
      return false;
    }
    // Defesa: subcategoria filtrada mesmo com category='all' (AND — RB-10).
    if (subcategory !== 'all' && item.subcategory !== subcategory) {
      return false;
    }

    return true;
  });
}

/**
 * Retorna uma CÓPIA ordenada dos itens — nunca muta o array de entrada
 * (cópia com `.slice()` antes do sort, §7.2). Desempate determinístico
 * (RB-11/D-4):
 *
 * - `price-asc`: preço ↑, empate → nome ↑ (locale pt-BR, sensitivity base)
 * - `price-desc`: preço ↓, empate → nome ↑
 * - `name-asc`: nome ↑, empate → id ↑
 * - `name-desc`: nome ↓, empate → id ↑
 * - `category` (padrão, D-5): NÃO ordena globalmente — preserva a ordem
 *   estável do array de entrada (a reordenação por categoria é de groupItems;
 *   dentro do grupo mantém-se a ordem da fonte).
 *
 * @param {Object[]} items itens a ordenar (não mutado)
 * @param {SortKey} sort um dos 5 valores do enum (D-4)
 * @returns {Object[]} nova array ordenada
 * @throws {TypeError} se `items` não for array ou `sort` for inválido (fail fast — D-14)
 */
export function sortItems(items, sort) {
  if (!Array.isArray(items)) {
    throw new TypeError('sortItems(items, sort): items must be an array');
  }

  const copy = items.slice(); // cópia antes do sort — RB-11: entrada nunca é mutada

  switch (sort) {
    case 'category':
      return copy; // D-5: ordem de entrada preservada (sort estável do engine)
    case 'price-asc':
      // Empate de preço → nome ↑ (NaN cai no critério seguinte: NaN é falsy).
      return copy.sort((a, b) => Number(a.price) - Number(b.price) || compareNames(a.name, b.name));
    case 'price-desc':
      // Empate de preço → nome ↑ (RB-11: só o preço inverte; o nome continua ↑).
      return copy.sort((a, b) => Number(b.price) - Number(a.price) || compareNames(a.name, b.name));
    case 'name-asc':
      return copy.sort((a, b) => compareNames(a.name, b.name) || compareStrings(a.id, b.id));
    case 'name-desc':
      return copy.sort((a, b) => compareNames(b.name, a.name) || compareStrings(a.id, b.id));
    default:
      // Sort fora do enum D-4 é bug de programação, não entrada do usuário
      // (mesmo racional do D-14 em setState) — falha rápido, não degrada em silêncio.
      throw new TypeError(`sortItems: invalid sort "${sort}"`);
  }
}

/**
 * Agrupa itens para o modo agrupado (D-5) — só roda quando `sort === 'category'`.
 *
 * - `category === 'all'` → grupos por CATEGORIA na ordem CATEGORY_ORDER
 *   (D-17: 6 grupos no máximo, sem subdivisão por subcategoria; a subdivisão
 *   só ocorre com categoria específica, mantendo o contrato `Group[]` plano).
 * - `category` específica COM subcategorias (armas/armaduras) → grupos por
 *   SUBCATEGORIA na ordem fixa de SUBCATEGORY_ORDER (RF-02).
 * - `category` específica SEM subcategorias (bebidas/refeicoes/pousada/pocoes)
 *   → grupo único: `key` = própria categoria, `label` = CATEGORY_LABELS.
 *
 * Grupos vazios não são emitidos; itens mantêm a ordem do array de entrada
 * dentro de cada grupo (estável — quem precisa de outra ordem ordena antes,
 * via sortItems). Nunca muta a entrada.
 *
 * Defesa: com categoria específica, só itens `item.category === category`
 * entram nos grupos — a visão agrupada nunca mistura categorias, mesmo que o
 * chamador esqueça o `filterItems` (o qual continua dono do RB-10/contagem).
 *
 * @param {Object[]} items itens já filtrados (não mutados)
 * @param {string} category 'all' ou CategoryKey
 * @returns {Group[]} [{key, label, items}] — `[]` se `items` vazio
 * @throws {TypeError} se `items` não for array ou `category` não for string
 */
export function groupItems(items, category) {
  if (!Array.isArray(items)) {
    throw new TypeError('groupItems(items, category): items must be an array');
  }
  if (typeof category !== 'string') {
    throw new TypeError('groupItems(items, category): category must be a string');
  }

  if (items.length === 0) {
    return [];
  }

  if (category === 'all') {
    return groupByCategory(items); // D-17: grupos por categoria (CATEGORY_ORDER)
  }

  // Defesa: escopo da categoria antes de agrupar (subcategorias só fazem
  // sentido dentro da própria categoria).
  const scoped = items.filter((item) => item.category === category);

  if (scoped.length === 0) {
    return [];
  }

  const order = SUBCATEGORY_ORDER[category]; // undefined p/ categorias sem subcategorias

  if (!order) {
    // Grupo único: key = categoria, label = SUBCATEGORY_LABELS[key] ?? CATEGORY_LABELS[category].
    return [buildGroup(category, CATEGORY_LABELS[category] ?? category, scoped)];
  }

  return groupBySubcategory(scoped, category, order);
}

/**
 * Subcategorias de uma categoria na ordem fixa de exibição (RF-02).
 *
 * @param {string} category 'all' ou CategoryKey
 * @returns {string[]} cópia das chaves de subcategoria; `[]` para 'all' e para
 *   categorias sem subcategorias (bebidas/refeicoes/pousada/pocoes)
 */
export function getSubcategories(category) {
  const order = SUBCATEGORY_ORDER[category];
  return order ? order.slice() : [];
}

/**
 * Adiciona `_search` (busca sem acento/caixa — RF-03) a cada item, retornando
 * NOVOS objetos: o array e os objetos de entrada nunca são mutados (§7.2).
 * É chamado uma única vez no boot (enriquecimento §2.1/§7.1).
 *
 * @param {Object[]} raw itens crus do JSON (envelope `data.items`)
 * @returns {Object[]} novo array com `{...item, _search: normalizeText(name)}`
 * @throws {TypeError} se `raw` não for array
 */
export function enrichItems(raw) {
  if (!Array.isArray(raw)) {
    throw new TypeError('enrichItems(raw): raw must be an array');
  }

  return raw.map((item) => ({ ...item, _search: normalizeText(item && item.name) }));
}
