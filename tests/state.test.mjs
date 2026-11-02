// tests/state.test.mjs — T-17 (Senior QA Automation Engineer)
// Testes de comportamento de js/state.js contra o contrato CONGELADO (ARCHITECTURE §6.1/§6.2).
// Protege: imutabilidade do estado (§7.2), forma inicial dos filtros (RF-11/US-07),
//          enum de ordenação de 5 valores (D-4), estados de carregamento/erro (RNF-09).
// Execução: node --test  (D-8: zero dependências, stdlib do Node; D-18: sem caminho de diretório).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  initialFilters,
  createInitialState,
  setState,
  isValidSort,
  createErrorState,
  createLoadingState,
  SORT_KEYS,
} from '../js/state.js';

// Dados de teste independentes por teste — nenhum estado mutável compartilhado entre casos.
function sampleItems() {
  return [
    {
      id: 'pocao-cura-basica',
      name: 'Cura Básica',
      category: 'pocoes',
      subcategory: null,
      price: 10,
      unit: null,
      tags: ['cura'],
    },
    {
      id: 'skooma',
      name: 'Skooma',
      category: 'bebidas',
      subcategory: null,
      price: 20,
      unit: null,
      tags: ['droga'],
    },
  ];
}

// Deep-freeze: se setState mutar algo do estado atual, o JavaScript (modo estrito dos
// ES modules) lança TypeError — falha explícita de imutabilidade, sem falsos positivos.
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
    Object.freeze(value);
  }
  return value;
}

// ---------------------------------------------------------------------------
// initialFilters — forma padrão dos filtros (RF-04, RF-06, RF-11 / US-07)
// ---------------------------------------------------------------------------

test('initialFilters: retorna exatamente os filtros padrão', () => {
  // deepStrictEqual também falha se surgirem chaves extras no objeto.
  assert.deepEqual(initialFilters(), {
    query: '',
    priceMin: null,
    priceMax: null,
    category: 'all',
    subcategory: 'all',
  });
});

test('initialFilters: cada chamada retorna objeto independente (sem estado compartilhado)', () => {
  const first = initialFilters();
  const second = initialFilters();
  assert.notStrictEqual(first, second);

  // Mutação acidental em um resultado não pode vazar para chamadas seguintes.
  first.query = 'mutado-por-teste';
  assert.equal(initialFilters().query, '');
});

// ---------------------------------------------------------------------------
// createInitialState — boot do app (RF-05 estado inicial por categoria, RF-07 tema padrão)
// ---------------------------------------------------------------------------

test('createInitialState: estado ready com sort "category" e tema "light" (RF-05, RF-07)', () => {
  const items = sampleItems();
  const state = createInitialState(items);

  assert.equal(state.status, 'ready');
  assert.equal(state.sort, 'category');
  assert.equal(state.theme, 'light');
  assert.deepEqual(state.filters, initialFilters());
});

// DECISÃO D-16 (Tech Lead): itens são copiados com .slice() no boot (copia rasa,
// defesa em profundidade da imutabilidade §7.2) — NÃO são mantidos por referência.
// setState preserva state.items por referência interna (cópia uma única vez).
test('createInitialState: state.items é cópia rasa do array original (D-16)', () => {
  const items = sampleItems();
  const state = createInitialState(items);

  assert.notStrictEqual(state.items, items, 'array deve ser copiado (não referenciado)');
  assert.deepStrictEqual(state.items, items, 'cópia rasa deve conter os mesmos itens');
});

// ---------------------------------------------------------------------------
// setState — imutabilidade (ARCHITECTURE §6.2 regra 4 e §7.2)
// ---------------------------------------------------------------------------

test('setState: nunca muta o estado atual e retorna novo objeto (imutabilidade)', () => {
  const items = sampleItems();
  const current = deepFreeze(createInitialState(items)); // mutação → TypeError

  const next = setState(current, { filters: { ...initialFilters(), query: 'pocao' } });

  assert.notStrictEqual(next, current, 'setState deve retornar um novo objeto');
  // Original permanece idêntico a um estado recém-criado (sem cópia manual, sem armadilha de undefined).
  assert.deepEqual(current, createInitialState(items));
});

test('setState: partial altera só o campo pedido, sem vazar para os demais (RB-10)', () => {
  const items = sampleItems();
  const current = createInitialState(items);

  const next = setState(current, {
    filters: { ...initialFilters(), query: 'pocao', priceMax: 15 },
  });

  // Campo parcial aplicado
  assert.equal(next.filters.query, 'pocao');
  assert.equal(next.filters.priceMax, 15);
  // Demais filtros preservados dentro do objeto de filtros
  assert.equal(next.filters.priceMin, null);
  assert.equal(next.filters.category, 'all');
  assert.equal(next.filters.subcategory, 'all');
  // Demais campos do estado intactos (nenhum vazamento do partial)
  assert.equal(next.sort, current.sort);
  assert.equal(next.theme, current.theme);
  assert.equal(next.status, current.status);
  assert.strictEqual(next.items, current.items);
});

test('setState: trocar sort não altera filters e vice-versa', () => {
  const current = createInitialState(sampleItems());

  const next = setState(current, { sort: 'price-asc' });
  assert.equal(next.sort, 'price-asc');
  assert.deepEqual(next.filters, initialFilters());

  const backToCategory = setState(next, { sort: 'category' });
  assert.equal(backToCategory.sort, 'category');
});

// DECISÃO D-14 (Tech Lead): Fail Fast — sort inválido é bug de programação
// (a UI só emite valores do enum D-4); silenciar mascararia erro de wiring no app.js.
test('setState: sort inválido LANÇA TypeError (Fail Fast, D-14)', () => {
  const current = createInitialState(sampleItems());
  const withValid = setState(current, { sort: 'price-asc' });

  assert.throws(
    () => setState(withValid, { sort: 'price' }),
    TypeError,
    'setState deve falhar rápido com sort fora do enum',
  );

  // Estados pré-existentes permanecem intactos após a exceção.
  assert.equal(withValid.sort, 'price-asc');
  assert.equal(current.sort, 'category');
});

// ---------------------------------------------------------------------------
// isValidSort / SORT_KEYS — enum de 5 valores (D-4, §6.1)
// ---------------------------------------------------------------------------

test('SORT_KEYS: contém exatamente os 5 valores do contrato (D-4)', () => {
  assert.equal(SORT_KEYS.length, 5);
  assert.equal(new Set(SORT_KEYS).size, 5, 'SORT_KEYS não pode ter duplicatas');
  for (const value of ['category', 'price-asc', 'price-desc', 'name-asc', 'name-desc']) {
    assert.ok(SORT_KEYS.includes(value), `SORT_KEYS deve conter "${value}"`);
  }
});

test('isValidSort: aceita todos os valores de SORT_KEYS', () => {
  for (const value of SORT_KEYS) {
    assert.equal(isValidSort(value), true, `esperado válido: ${value}`);
  }
});

test('isValidSort: rejeita entradas inválidas (defesa na borda da UI)', () => {
  const invalid = ['price', '', null, {}, 'PRICE-ASC', undefined, 'Price-Asc', 'name', 0];
  for (const value of invalid) {
    assert.equal(isValidSort(value), false, `esperado inválido: ${String(value)}`);
  }
});

// ---------------------------------------------------------------------------
// Estados auxiliares — RNF-09 (erro amigável) e boot (loading)
// ---------------------------------------------------------------------------

test('createErrorState: status error, código/mensagem propagados e items [] (RNF-09)', () => {
  const state = createErrorState('PARSE', 'JSON inválido');
  assert.equal(state.status, 'error');
  assert.equal(state.errorCode, 'PARSE');
  assert.equal(state.errorMessage, 'JSON inválido');
  assert.deepEqual(state.items, []);
});

test('createErrorState: outro código também propaga corretamente', () => {
  const state = createErrorState('NOT_FOUND', 'Arquivo ausente');
  assert.equal(state.status, 'error');
  assert.equal(state.errorCode, 'NOT_FOUND');
  assert.equal(state.errorMessage, 'Arquivo ausente');
  assert.deepEqual(state.items, []);
});

test('createLoadingState: status loading (boot antes do fetch)', () => {
  const state = createLoadingState();
  assert.equal(state.status, 'loading');
});
