// tests/filters.test.mjs — T-18 (Senior QA Automation Engineer)
// Testes de comportamento de js/filters.js contra o contrato CONGELADO (ARCHITECTURE §5.4/§6.2).
// Protege: RB-10 (AND busca ∩ faixa ∩ categoria ∩ subcategoria), RB-11 (desempate determinístico),
//          RF-03/US-02 (busca sem acento/caixa), RF-04/US-03 (faixa inclusiva, min > max → []),
//          RF-06/US-01 (categorias/subcategorias), RF-02 (ordem das subcategorias),
//          D-5/D-17 (modo agrupado por categoria × modo plano), §7.2 (imutabilidade das entradas),
//          D-14 (fail fast: entradas fora do contrato lançam TypeError).
// Dados: tests/fixtures.mjs — fábricas por chamada, nenhum estado compartilhado.
// Execução: node --test tests/filters.test.mjs  (ou `node --test` p/ suíte inteira — D-18).
//   (o runner trata o diretório como módulo de entrada) — ver relatório T-18 (RISKS).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterItems,
  sortItems,
  groupItems,
  getSubcategories,
  enrichItems,
} from '../js/filters.js';
import { normalizeText, CATEGORY_ORDER } from '../js/utils.js';
import { sampleItems, filtersPadrao } from './fixtures.mjs';

// Helper: projeção de ids para asserções legíveis (ordem do array = ordem de entrada).
const ids = (items) => items.map((item) => item.id);

// Snapshot profundo da entrada — detecta qualquer mutação (§7.2).
const snapshotOf = (items) => JSON.parse(JSON.stringify(items));

// ---------------------------------------------------------------------------
// Fixtures — sanidade dos dados de teste (independência por teste)
// ---------------------------------------------------------------------------

test('fixtures: sampleItems devolve estruturas novas a cada chamada (sem estado compartilhado)', () => {
  const first = sampleItems();
  const second = sampleItems();

  assert.notStrictEqual(first, second, 'array deve ser novo por chamada');
  assert.notStrictEqual(first[0], second[0], 'itens devem ser novos por chamada');
  assert.deepEqual(first, second, 'conteúdo determinístico entre chamadas');

  // Mutação acidental em um resultado não pode vazar para chamadas seguintes.
  first[0].price = 9999;
  assert.equal(second[0].price, 3);
});

test('fixtures: sampleItems cobre as 6 categorias, empate de preço e price 0 (base dos testes)', () => {
  const items = sampleItems();
  const uniqueIds = new Set(items.map((item) => item.id));
  const categories = new Set(items.map((item) => item.category));

  assert.equal(uniqueIds.size, items.length, 'ids devem ser únicos');
  assert.deepEqual([...categories].sort(), [...CATEGORY_ORDER].sort(), 'as 6 categorias do enum §5.3');
  assert.ok(items.some((item) => item.price === 0), 'deve existir item com price 0 (borda US-03)');
  // Empate de preço com nomes diferentes → desempate RB-11 exercitável.
  const prices10 = items.filter((item) => item.price === 10);
  assert.equal(prices10.length, 2);
  assert.notEqual(prices10[0].name, prices10[1].name);
});

test('fixtures: filtersPadrao devolve a forma padrão do contrato e é independente por chamada', () => {
  assert.deepEqual(filtersPadrao(), {
    query: '',
    priceMin: null,
    priceMax: null,
    category: 'all',
    subcategory: 'all',
  });

  const first = filtersPadrao();
  const second = filtersPadrao();
  assert.notStrictEqual(first, second);
  first.query = 'mutado-por-teste';
  assert.equal(second.query, '');
});

// ---------------------------------------------------------------------------
// enrichItems — _search normalizado, imutabilidade (RF-03, §2.1/§7.1)
// ---------------------------------------------------------------------------

test('enrichItems: adiciona _search normalizado (sem acento e em minúsculas — RF-03)', () => {
  const enriched = enrichItems(sampleItems());

  const pocao = enriched.find((item) => item.id === 'pocao-de-cura');
  assert.equal(pocao._search, 'pocao de cura');
  assert.equal(pocao._search, normalizeText('Poção de Cura'));

  // Todo item ganha _search coerente com o próprio name (fonte única = name).
  for (const item of enriched) {
    assert.equal(item._search, normalizeText(item.name), `_search inconsistente em ${item.id}`);
  }
});

test('enrichItems: não muta a entrada e devolve objetos novos (§7.2)', () => {
  const raw = sampleItems();
  const before = snapshotOf(raw);

  const enriched = enrichItems(raw);

  assert.notStrictEqual(enriched, raw, 'array de saída deve ser novo');
  assert.notStrictEqual(enriched[0], raw[0], 'objeto de saída deve ser novo (spread, não referência)');
  assert.deepEqual(raw, before, 'entrada não pode ser mutada');
  assert.ok(!('_search' in raw[0]), 'objeto original não pode ganhar _search');
  assert.ok('_search' in enriched[0], 'objeto de saída deve ter _search');
});

test('enrichItems: entrada não-array lança TypeError (contrato §6.2)', () => {
  assert.throws(() => enrichItems(null), TypeError);
  assert.throws(() => enrichItems('items'), TypeError);
  assert.throws(() => enrichItems({}), TypeError);
});

// ---------------------------------------------------------------------------
// Busca — RF-03 / US-02 (pipeline real: enrichItems → filterItems)
// ---------------------------------------------------------------------------

test('filterItems: "pocao" encontra "Poção de Cura" sem acento/caixa (RF-03, US-02)', () => {
  const items = enrichItems(sampleItems());
  const result = filterItems(items, { ...filtersPadrao(), query: 'pocao' });

  // Só itens cujo name normalizado casa com "pocao" — as 2 poções, na ordem de entrada.
  assert.deepEqual(ids(result), ['pocao-de-cura', 'pocao-de-ensaio']);
  assert.ok(
    result.some((item) => item.name === 'Poção de Cura'),
    'o item com acento "Poção de Cura" deve ser encontrado pelo termo sem acento',
  );
  // Nenhum item fora de pocoes vaza para a busca (RB-10: busca ∩ resto).
  for (const item of result) {
    assert.equal(item.category, 'pocoes');
  }
});

test('filterItems: query vazia ou só espaços não filtra (US-02, padrão RF-04)', () => {
  const items = enrichItems(sampleItems());

  assert.equal(filterItems(items, filtersPadrao()).length, items.length, 'query "" = sem busca');
  assert.equal(
    filterItems(items, { ...filtersPadrao(), query: '   ' }).length,
    items.length,
    'query só whitespace = sem busca',
  );
  // Trim nos extremos: "  pocao  " equivale a "pocao".
  assert.equal(
    filterItems(items, { ...filtersPadrao(), query: '  pocao  ' }).length,
    2,
    'query com espaços nas pontas deve ser normalizada (trim)',
  );
});

test('filterItems: "sko" encontra apenas Skooma (prefixo parcial — US-02)', () => {
  const items = enrichItems(sampleItems());
  const result = filterItems(items, { ...filtersPadrao(), query: 'sko' });

  assert.deepEqual(ids(result), ['bebida-skooma']);
});

test('filterItems: termo sem correspondência retorna [] (US-02, borda negativa)', () => {
  const items = enrichItems(sampleItems());
  const result = filterItems(items, { ...filtersPadrao(), query: 'martelo-do-juizo-final' });

  assert.deepEqual(result, []);
});

test('filterItems: busca funciona sem _search (fallback defensivo de normalizeText — RF-03)', () => {
  // Entrada CRUA (sem enrichItems): o filtro não pode depender do enriquecimento.
  const raw = sampleItems();
  const result = filterItems(raw, { ...filtersPadrao(), query: 'pocao' });

  assert.ok(ids(result).includes('pocao-de-cura'));
  assert.ok(ids(result).includes('pocao-de-ensaio'));
});

// ---------------------------------------------------------------------------
// Faixa de preço — RF-04 / US-03 (inclusiva, limites nulos, min > max → [])
// ---------------------------------------------------------------------------

test('filterItems: priceMin só → apenas itens com preço >= min (RF-04, US-03)', () => {
  const items = sampleItems();
  const result = filterItems(items, { ...filtersPadrao(), priceMin: 100 });

  assert.deepEqual(ids(result), ['armadura-placas']);
});

test('filterItems: priceMax só → apenas itens com preço <= max (RF-04, US-03)', () => {
  const items = sampleItems();
  const result = filterItems(items, { ...filtersPadrao(), priceMax: 3 });

  // Limite superior NÃO exclui o item de preço 0 (Poção de Ensaio).
  assert.deepEqual(ids(result), ['bebida-hidromel', 'pocao-de-ensaio', 'arma-simples-adaga']);
});

test('filterItems: faixa inclusiva — preço == min e preço == max aparecem (RF-04, US-03)', () => {
  const items = sampleItems();
  const minOnly = ids(filterItems(items, { ...filtersPadrao(), priceMin: 10 }));
  const maxOnly = ids(filterItems(items, { ...filtersPadrao(), priceMax: 10 }));
  const exact = ids(filterItems(items, { ...filtersPadrao(), priceMin: 10, priceMax: 10 }));

  // Os 2 itens de 10 PO passam em qualquer um dos limites isolados (10 <= 10 e 10 >= 10).
  assert.ok(minOnly.includes('pocao-de-cura') && minOnly.includes('refeicao-luxuosa'));
  assert.ok(maxOnly.includes('pocao-de-cura') && maxOnly.includes('refeicao-luxuosa'));
  // min == max = faixa fechada [10, 10] → exatamente os 2 empatados (ordem de entrada).
  assert.deepEqual(exact, ['refeicao-luxuosa', 'pocao-de-cura']);
});

test('filterItems: priceMin > priceMax → [] (US-03: estado vazio + aviso)', () => {
  const items = sampleItems();
  const result = filterItems(items, { ...filtersPadrao(), priceMin: 20, priceMax: 10 });

  assert.deepEqual(result, []);
});

test('filterItems: limites null = sem restrição; null misturado com número funciona (US-03)', () => {
  const items = sampleItems();

  // Ambos null (padrão) → conjunto completo.
  assert.equal(filterItems(items, filtersPadrao()).length, items.length);
  // priceMin null + priceMax definido ≡ só priceMax.
  const withNullMin = ids(filterItems(items, { ...filtersPadrao(), priceMin: null, priceMax: 3 }));
  const onlyMax = ids(filterItems(items, { ...filtersPadrao(), priceMax: 3 }));
  assert.deepEqual(withNullMin, onlyMax);
  // priceMax null + priceMin definido ≡ só priceMin.
  const withNullMax = ids(filterItems(items, { ...filtersPadrao(), priceMin: 100, priceMax: null }));
  const onlyMin = ids(filterItems(items, { ...filtersPadrao(), priceMin: 100 }));
  assert.deepEqual(withNullMax, onlyMin);
});

test('filterItems: priceMin 0 mantém o item de preço 0 visível (borda US-03)', () => {
  const items = sampleItems();
  const result = filterItems(items, { ...filtersPadrao(), priceMin: 0 });

  assert.equal(result.length, items.length, 'todos os preços são >= 0 (schema §5.2)');
  assert.ok(ids(result).includes('pocao-de-ensaio'), 'item de 0 PO não pode sumir com min = 0');
});

// ---------------------------------------------------------------------------
// Combinação por E — RB-10 (busca ∩ faixa ∩ categoria ∩ subcategoria)
// ---------------------------------------------------------------------------

test('filterItems: busca ∩ faixa ∩ categoria produz interseção exata de 1 item (RB-10)', () => {
  const items = sampleItems();
  const result = filterItems(items, {
    ...filtersPadrao(),
    query: 'pocao',
    priceMin: 1,
    priceMax: 15,
    category: 'pocoes',
  });

  // Exatamente 1 resultado: a Poção de Ensaio (0 PO) cai fora da faixa [1, 15].
  assert.deepEqual(ids(result), ['pocao-de-cura']);

  // Prova de AND: sem a faixa, a busca retornaria 2 itens — cada critério exclui algo.
  const semFaixa = filterItems(items, { ...filtersPadrao(), query: 'pocao', category: 'pocoes' });
  assert.equal(semFaixa.length, 2);

  // E sem a categoria, itens de outras categorias voltariam a aparecer.
  const semCategoria = filterItems(items, { ...filtersPadrao(), query: 'pocao' });
  assert.equal(semCategoria.length, 2);
});

test('filterItems: subcategoria específica aplica mesmo com category "all" (AND puro — RB-10)', () => {
  // Defesa documentada em filters.js: subcategoria nunca é ignorada.
  const result = filterItems(sampleItems(), { ...filtersPadrao(), subcategory: 'marciais' });

  assert.deepEqual(ids(result), ['arma-marcial-espada-longa']);
});

// ---------------------------------------------------------------------------
// Categoria / subcategoria — RF-06 / US-01
// ---------------------------------------------------------------------------

test('filterItems: category "armas" retorna só armas (RF-06, US-01)', () => {
  const items = sampleItems();
  const result = filterItems(items, { ...filtersPadrao(), category: 'armas' });

  assert.equal(result.length, 3, 'as 3 armas das fixtures (simples, marciais, versateis)');
  for (const item of result) {
    assert.equal(item.category, 'armas');
  }
  // Ordem de entrada preservada (filter = map sobre o array original).
  assert.deepEqual(ids(result), ['arma-simples-adaga', 'arma-marcial-espada-longa', 'arma-versatil-lanca']);
});

test('filterItems: category "armas" + subcategory "marciais" → só marciais (RF-06, US-01)', () => {
  const items = sampleItems();
  const result = filterItems(items, {
    ...filtersPadrao(),
    category: 'armas',
    subcategory: 'marciais',
  });

  assert.deepEqual(ids(result), ['arma-marcial-espada-longa']);
});

test('filterItems: category "all" não filtra — as 6 categorias permanecem (padrão US-01)', () => {
  const items = sampleItems();
  const result = filterItems(items, { ...filtersPadrao(), category: 'all' });

  assert.equal(result.length, items.length);
  assert.equal(new Set(result.map((item) => item.category)).size, 6);
});

// ---------------------------------------------------------------------------
// sortItems — RB-11 / US-04 / D-4 (enum de 5 valores, imutabilidade §7.2)
// ---------------------------------------------------------------------------

test('sortItems: price-asc crescente com desempate por name asc (RB-11, US-04)', () => {
  const items = sampleItems();
  const sorted = sortItems(items, 'price-asc');

  // Ordem total esperada — determinística, com o empate de 10 PO resolvido por nome.
  assert.deepEqual(ids(sorted), [
    'pocao-de-ensaio', // 0
    'arma-simples-adaga', // 2
    'bebida-hidromel', // 3
    'armadura-couro-batido', // 8
    'pocao-de-cura', // 10 (empate → nome: "Poção de Cura" < "Refeição Luxuosa")
    'refeicao-luxuosa', // 10
    'pousada-suite-luxuosa', // 12
    'arma-marcial-espada-longa', // 15
    'arma-versatil-lanca', // 18
    'bebida-skooma', // 20
    'armadura-placas', // 150
  ]);

  // Invariante: sequência de preços não decrescente.
  const prices = sorted.map((item) => item.price);
  for (let i = 1; i < prices.length; i += 1) {
    assert.ok(prices[i - 1] <= prices[i], `preço fora de ordem no índice ${i}`);
  }
});

test('sortItems: price-desc inverte o preço mas mantém name asc no empate (RB-11)', () => {
  const items = sampleItems();
  const sorted = sortItems(items, 'price-desc');

  assert.deepEqual(ids(sorted), [
    'armadura-placas', // 150
    'bebida-skooma', // 20
    'arma-versatil-lanca', // 18
    'arma-marcial-espada-longa', // 15
    'pousada-suite-luxuosa', // 12
    'pocao-de-cura', // 10 (empate: só o preço inverte; o nome continua asc)
    'refeicao-luxuosa', // 10
    'armadura-couro-batido', // 8
    'bebida-hidromel', // 3
    'arma-simples-adaga', // 2
    'pocao-de-ensaio', // 0
  ]);

  // Empate de 10 PO continua em ordem de nome mesmo em price-desc.
  const tied = sorted.filter((item) => item.price === 10).map((item) => item.name);
  assert.deepEqual(tied, ['Poção de Cura', 'Refeição Luxuosa']);
});

test('sortItems: name-asc e name-desc com locale pt-BR (US-04, RB-11)', () => {
  const items = sampleItems();

  // Acento e caixa não atrapalham a ordem alfabética (sensitivity 'base').
  assert.deepEqual(ids(sortItems(items, 'name-asc')), [
    'arma-simples-adaga', // Adaga
    'armadura-couro-batido', // Couro Batido
    'arma-marcial-espada-longa', // Espada Longa
    'bebida-hidromel', // Hidromel
    'arma-versatil-lanca', // Lança
    'armadura-placas', // Placas
    'pocao-de-cura', // Poção de Cura
    'pocao-de-ensaio', // Poção de Ensaio
    'refeicao-luxuosa', // Refeição Luxuosa
    'bebida-skooma', // Skooma
    'pousada-suite-luxuosa', // Suíte Luxuosa
  ]);

  assert.deepEqual(ids(sortItems(items, 'name-desc')), [
    'pousada-suite-luxuosa', // Suíte Luxuosa
    'bebida-skooma', // Skooma
    'refeicao-luxuosa', // Refeição Luxuosa
    'pocao-de-ensaio', // Poção de Ensaio
    'pocao-de-cura', // Poção de Cura
    'armadura-placas', // Placas
    'arma-versatil-lanca', // Lança
    'bebida-hidromel', // Hidromel
    'arma-marcial-espada-longa', // Espada Longa
    'armadura-couro-batido', // Couro Batido
    'arma-simples-adaga', // Adaga
  ]);
});

test('sortItems: nome igual ignorando caixa/acentos não desempata — ordem de entrada preservada (RB-11)', () => {
  // compareNames usa sensitivity 'base': caixa/acentos nunca viram critério de
  // desempate; o sort estável (ES2019) mantém a ordem original nesses casos.
  const pair = [
    { id: 'b', name: 'HIDROMEL', price: 5 },
    { id: 'a', name: 'hidromel', price: 5 },
  ];

  assert.deepEqual(ids(sortItems(pair, 'price-asc')), ['b', 'a'], 'sort estável preserva a entrada');
  // Em name-asc o desempate por igualdade de nome é o id asc (RB-11) → 'a' antes de 'b'.
  assert.deepEqual(ids(sortItems(pair, 'name-asc')), ['a', 'b'], 'empate de nome → id asc');
});

test('sortItems: "category" preserva a ordem estável de entrada (D-5, modo agrupado)', () => {
  const items = sampleItems(); // ordem da fonte
  const sorted = sortItems(items, 'category');

  assert.deepEqual(ids(sorted), ids(items), 'sort "category" não reordena globalmente');
  assert.notStrictEqual(sorted, items, 'mesmo sem ordenar, deve devolver cópia nova');
});

test('sortItems: nunca muta o array de entrada (cópia antes do sort — §7.2)', () => {
  const items = sampleItems();
  const before = snapshotOf(items);

  const sorted = sortItems(items, 'price-asc');

  assert.notStrictEqual(sorted, items, 'resultado deve ser array novo');
  assert.deepEqual(items, before, 'array de entrada não pode ser mutado');
  // E a entrada preserva a ordem original (não foi "ordenada por referência").
  assert.deepEqual(ids(items), [
    'bebida-hidromel',
    'bebida-skooma',
    'refeicao-luxuosa',
    'pousada-suite-luxuosa',
    'pocao-de-cura',
    'pocao-de-ensaio',
    'arma-simples-adaga',
    'arma-marcial-espada-longa',
    'arma-versatil-lanca',
    'armadura-couro-batido',
    'armadura-placas',
  ]);
});

test('sortItems: sort fora do enum D-4 lança TypeError (Fail Fast — D-14)', () => {
  const items = sampleItems();

  assert.throws(() => sortItems(items, 'price'), TypeError, 'sort inválido deve falhar rápido');
  for (const invalid of ['', null, undefined, 'PRICE-ASC', 'name', 0]) {
    assert.throws(() => sortItems(items, invalid), TypeError, `esperado TypeError: ${String(invalid)}`);
  }

  // Estado pré-existente permanece intacto após a exceção (nenhuma mutação parcial).
  assert.equal(ids(items)[0], 'bebida-hidromel');
});

// ---------------------------------------------------------------------------
// groupItems — D-5 (dois modos) / D-17 (agrupado por categoria) / RF-02
// ---------------------------------------------------------------------------

test('groupItems: category "all" → 6 grupos na ordem exata de CATEGORY_ORDER (D-17, RF-01)', () => {
  const items = sampleItems();
  const groups = groupItems(items, 'all');

  assert.equal(groups.length, 6, 'modo agrupado: no máximo 6 grupos top-level');
  assert.deepEqual(
    groups.map((group) => group.key),
    CATEGORY_ORDER,
    'ordem dos grupos deve ser CATEGORY_ORDER (leitura fiel da fonte)',
  );
  assert.deepEqual(
    groups.map((group) => group.label),
    ['Bebidas', 'Refeições', 'Pousada', 'Poções de Vida', 'Armas', 'Armaduras & Escudo'],
    'labels PT-BR resolvidos (D-9)',
  );

  // Sem subdivisão por subcategoria quando category = 'all' (D-17).
  for (const group of groups) {
    for (const item of group.items) {
      assert.equal(item.category, group.key, `item ${item.id} fora do grupo ${group.key}`);
    }
  }
});

test('groupItems: category "armas" → 3 grupos (simples, marciais, versateis) na ordem (RF-02, D-5)', () => {
  const items = sampleItems();
  const armas = filterItems(items, { ...filtersPadrao(), category: 'armas' });
  const groups = groupItems(armas, 'armas');

  assert.deepEqual(
    groups.map((group) => group.key),
    ['simples', 'marciais', 'versateis'],
    'ordem fixa das subcategorias (RF-02)',
  );
  assert.deepEqual(groups.map((group) => group.label), ['Simples', 'Marciais', 'Versáteis']);
  assert.deepEqual(ids(groups[0].items), ['arma-simples-adaga']);
  assert.deepEqual(ids(groups[1].items), ['arma-marcial-espada-longa']);
  assert.deepEqual(ids(groups[2].items), ['arma-versatil-lanca']);
});

test('groupItems: category "bebidas" → 1 grupo com label "Bebidas" (D-5, categoria sem subcategoria)', () => {
  const items = sampleItems();
  const bebidas = filterItems(items, { ...filtersPadrao(), category: 'bebidas' });
  const groups = groupItems(bebidas, 'bebidas');

  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, 'bebidas');
  assert.equal(groups[0].label, 'Bebidas');
  assert.equal(groups[0].items.length, 2);
});

test('groupItems: cada item cai em exatamente 1 grupo; soma == total (D-5)', () => {
  const items = sampleItems();

  // Modo agrupado global.
  const allGroups = groupItems(items, 'all');
  const allIds = allGroups.flatMap((group) => group.items.map((item) => item.id));
  assert.equal(allIds.length, items.length, 'soma dos grupos deve bater com o total');
  assert.equal(new Set(allIds).size, items.length, 'cada item em exatamente 1 grupo (sem duplicatas)');

  // Escopo de categoria também particiona sem perda nem duplicação.
  const armas = filterItems(items, { ...filtersPadrao(), category: 'armas' });
  const armasGroups = groupItems(armas, 'armas');
  const armasIds = armasGroups.flatMap((group) => group.items.map((item) => item.id));
  assert.equal(armasIds.length, armas.length);
  assert.equal(new Set(armasIds).size, armas.length);
});

test('groupItems: itens vazios → [] e entrada nunca é mutada (§7.2, D-5)', () => {
  assert.deepEqual(groupItems([], 'all'), []);
  assert.deepEqual(groupItems([], 'armas'), []);

  const items = sampleItems();
  const before = snapshotOf(items);
  groupItems(items, 'all');
  groupItems(items, 'armas');
  assert.deepEqual(items, before, 'groupItems não pode mutar a entrada');
});

// ---------------------------------------------------------------------------
// getSubcategories — RF-02 (ordem fixa de exibição)
// ---------------------------------------------------------------------------

test('getSubcategories: "armas" → ordem fixa simples, marciais, versateis (RF-02)', () => {
  assert.deepEqual(getSubcategories('armas'), ['simples', 'marciais', 'versateis']);
});

test('getSubcategories: "armaduras" → ordem fixa leves, medias, pesadas, escudo (RF-02)', () => {
  assert.deepEqual(getSubcategories('armaduras'), ['leves', 'medias', 'pesadas', 'escudo']);
});

test('getSubcategories: "bebidas" e "all" → [] (categorias sem subcategoria)', () => {
  assert.deepEqual(getSubcategories('bebidas'), []);
  assert.deepEqual(getSubcategories('all'), []);
  assert.deepEqual(getSubcategories('pocoes'), []);
});

test('getSubcategories: retorna cópia — mutar o resultado não afeta chamadas seguintes', () => {
  const first = getSubcategories('armas');
  first.push('hack');

  assert.deepEqual(getSubcategories('armas'), ['simples', 'marciais', 'versateis']);
});

// ---------------------------------------------------------------------------
// Contrato de erros — §6.2 / D-14 (fail fast, bug de programação não é entrada)
// ---------------------------------------------------------------------------

test('filterItems: entradas inválidas lançam TypeError (contrato §6.2)', () => {
  assert.throws(() => filterItems(null, filtersPadrao()), TypeError);
  assert.throws(() => filterItems('items', filtersPadrao()), TypeError);
  assert.throws(() => filterItems({}, filtersPadrao()), TypeError);
  assert.throws(() => filterItems([], null), TypeError);
  assert.throws(() => filterItems([], []), TypeError);
});

test('filterItems: limite não numérico lança TypeError (fail fast — D-14)', () => {
  const items = sampleItems();

  assert.throws(() => filterItems(items, { ...filtersPadrao(), priceMin: 'abc' }), TypeError);
  assert.throws(() => filterItems(items, { ...filtersPadrao(), priceMax: Number.NaN }), TypeError);
  // String numérica é aceita (coerção documentada em normalizeLimit).
  assert.equal(
    filterItems(items, { ...filtersPadrao(), priceMin: '100' }).length,
    1,
    'priceMin "100" (string) deve ser coerido para 100',
  );
});

test('sortItems/groupItems: entradas inválidas lançam TypeError (contrato §6.2)', () => {
  assert.throws(() => sortItems(null, 'category'), TypeError);
  assert.throws(() => sortItems('items', 'price-asc'), TypeError);
  assert.throws(() => groupItems(null, 'all'), TypeError);
  assert.throws(() => groupItems([], null), TypeError, 'category deve ser string');
  assert.throws(() => groupItems([], 42), TypeError, 'category deve ser string');
});

// ---------------------------------------------------------------------------
// Carga — smoke determinístico de performance (sem asserção de tempo → sem flaky)
// ---------------------------------------------------------------------------

test('filterItems + sortItems + groupItems: 5.000 itens processados corretamente (performance)', () => {
  // Gerador local: 5.000 itens rotando as 6 categorias e preços 0..99.
  const big = Array.from({ length: 5000 }, (_, i) => ({
    id: `item-${i}`,
    name: `Item ${String(i).padStart(4, '0')}`,
    category: CATEGORY_ORDER[i % CATEGORY_ORDER.length],
    subcategory: null,
    price: i % 100,
    unit: null,
    weightKg: null,
    damage: null,
    armorClass: null,
    strengthReq: null,
    effectText: null,
    modifiers: [],
    restrictions: [],
    tags: [],
  }));

  // Oráculo ingênuo (mesma especificação, escrita de forma independente).
  const oracle = big.filter((item) => item.category === 'pocoes' && item.price <= 50);
  const filtered = filterItems(big, { ...filtersPadrao(), category: 'pocoes', priceMax: 50 });
  assert.deepEqual(ids(filtered), ids(oracle), 'filtro em carga deve bater com o oráculo');
  assert.ok(oracle.length > 300, 'o caso de carga precisa de volume real para valer');

  // Ordenação mantém a invariante de preço sob carga.
  const sorted = sortItems(filtered, 'price-asc');
  assert.equal(sorted.length, filtered.length);
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(sorted[i - 1].price <= sorted[i].price, `preço fora de ordem no índice ${i}`);
  }

  // Agrupamento sob carga: particiona tudo, sem perda.
  const groups = groupItems(filtered, 'all');
  const groupedIds = groups.flatMap((group) => group.items.map((item) => item.id));
  assert.equal(groupedIds.length, filtered.length);
  assert.equal(new Set(groupedIds).size, filtered.length);

  // Entrada intacta após o pipeline completo (§7.2).
  assert.equal(big.length, 5000);
  assert.equal(big[0].id, 'item-0');
  assert.ok(!('_search' in big[0]), 'filter/sort/group não podem enriquecer a entrada');
});
