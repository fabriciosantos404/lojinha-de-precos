// tests/utils.test.mjs — T-17 (Senior QA Automation Engineer)
// Testes de comportamento de js/utils.js contra o contrato CONGELADO (ARCHITECTURE §6.2).
// Protege: RF-03/US-02 (busca sem acento e sem caixa), RB-01/RB-02 (formato de preço em PO),
//          RF-01/RF-02/RF-06 (ordem de exibição e labels PT-BR de categorias/subcategorias).
// Execução: node --test  (D-8: zero dependências, stdlib do Node; D-18: sem caminho de diretório).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeText,
  debounce,
  formatPrice,
  CATEGORY_LABELS,
  SUBCATEGORY_LABELS,
  CATEGORY_ORDER,
} from '../js/utils.js';

// Helper de espera — folga generosa para não ser afetada por timer resolution em CI/Windows.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// normalizeText — RF-03 / US-02: "pocao" encontra "Poção", "sko" encontra "Skooma"
// ---------------------------------------------------------------------------

test('normalizeText: remove acentos e padroniza caixa (RF-03, US-02)', () => {
  assert.equal(normalizeText('POÇÃO'), 'pocao');
  assert.equal(normalizeText('pocão'), 'pocao');
  assert.equal(normalizeText('Skooma'), 'skooma');
  assert.equal(normalizeText('Chá Gelado'), 'cha gelado');
  assert.equal(normalizeText('Cidra da Terra dos Anões'), 'cidra da terra dos anoes');
});

test('normalizeText: string vazia permanece vazia (borda)', () => {
  assert.equal(normalizeText(''), '');
});

// Comportamento definido e documentado: entrada não-string retorna string vazia
// (evita TypeError na borda da UI quando o campo ainda não tem valor).
test('normalizeText: entrada não-string (null/undefined) retorna string vazia', () => {
  assert.equal(normalizeText(null), '');
  assert.equal(normalizeText(undefined), '');
});

test('normalizeText: busca digitada sem acento casa com o nome do item (critério US-02)', () => {
  // Garantia comportamental da busca: o termo do usuário e o nome do item
  // normalizados produzem o mesmo token de comparação.
  assert.equal(normalizeText('pocao'), normalizeText('Poção'));
  assert.equal(normalizeText('SKOOMA'), normalizeText('Skooma'));
});

// ---------------------------------------------------------------------------
// formatPrice — RB-01 (moeda única PO) e RB-02 (pousada "por noite")
// ---------------------------------------------------------------------------

test('formatPrice: sem unidade → "N PO" (RB-01, moeda única)', () => {
  assert.equal(formatPrice(10, null), '10 PO');
  assert.equal(formatPrice(0, null), '0 PO');
});

test('formatPrice: unidade "por noite" → "N PO / noite" (RB-02, Pousada)', () => {
  assert.equal(formatPrice(5, 'por noite'), '5 PO / noite');
});

test('formatPrice: unidade omitida (parâmetro opcional do contrato) → "N PO"', () => {
  assert.equal(formatPrice(5), '5 PO');
});

// ---------------------------------------------------------------------------
// CATEGORY_ORDER — RF-01: ordem fixa de exibição no modo agrupado
// ---------------------------------------------------------------------------

test('CATEGORY_ORDER: as 6 categorias na ordem de exibição (RF-01)', () => {
  // Cópia via spread: compara conteúdo, sem depender de o array ser mutável/frozen.
  assert.deepEqual([...CATEGORY_ORDER], [
    'bebidas',
    'refeicoes',
    'pousada',
    'pocoes',
    'armas',
    'armaduras',
  ]);
});

// ---------------------------------------------------------------------------
// CATEGORY_LABELS / SUBCATEGORY_LABELS — RF-01, RF-02, D-9 (labels PT-BR)
// ---------------------------------------------------------------------------

test('CATEGORY_LABELS: chaves do enum com labels PT-BR esperados (RF-01, D-9)', () => {
  assert.equal(CATEGORY_LABELS.bebidas, 'Bebidas');
  assert.equal(CATEGORY_LABELS.refeicoes, 'Refeições');
  assert.equal(CATEGORY_LABELS.pousada, 'Pousada');
  assert.equal(CATEGORY_LABELS.pocoes, 'Poções de Vida');
  assert.equal(CATEGORY_LABELS.armas, 'Armas');
  assert.equal(CATEGORY_LABELS.armaduras, 'Armaduras & Escudo');
});

test('SUBCATEGORY_LABELS: chaves do enum com labels PT-BR esperados (RF-02, D-9)', () => {
  // Armas → Simples / Marciais / Versáteis
  assert.equal(SUBCATEGORY_LABELS.simples, 'Simples');
  assert.equal(SUBCATEGORY_LABELS.marciais, 'Marciais');
  assert.equal(SUBCATEGORY_LABELS.versateis, 'Versáteis');
  // Armaduras → Leves / Médias / Pesadas / Escudo
  assert.equal(SUBCATEGORY_LABELS.leves, 'Leves');
  assert.equal(SUBCATEGORY_LABELS.medias, 'Médias');
  assert.equal(SUBCATEGORY_LABELS.pesadas, 'Pesadas');
  assert.equal(SUBCATEGORY_LABELS.escudo, 'Escudo');
});

// ---------------------------------------------------------------------------
// debounce — RF-03 (≤ 300 ms) / RNF-01 (sem travar a UI)
// ---------------------------------------------------------------------------

test('debounce: rajada rápida de chamadas agrupa em uma única execução (RF-03)', async () => {
  const DEBOUNCE_MS = 30;
  let calls = 0;
  const debounced = debounce(() => {
    calls += 1;
  }, DEBOUNCE_MS);

  assert.equal(typeof debounced, 'function', 'debounce deve retornar uma função');

  // Rajada síncrona (intervalo ~0 ms < 30 ms) → determinística, sem depender de timer resolution.
  for (let i = 0; i < 5; i += 1) {
    debounced(`termo-${i}`);
  }

  // Folga generosa: 30 ms de debounce + margem ampla para máquina lenta.
  await sleep(250);
  assert.equal(calls, 1, 'as 5 chamadas da rajada devem resultar em exatamente 1 execução');
});

test('debounce: executa de novo após novo período de silêncio (reutilizável)', async () => {
  const DEBOUNCE_MS = 30;
  let calls = 0;
  const debounced = debounce(() => {
    calls += 1;
  }, DEBOUNCE_MS);

  debounced('primeira');
  await sleep(250);
  assert.equal(calls, 1);

  debounced('segunda');
  await sleep(250);
  assert.equal(calls, 2, 'a função deve continuar funcionando após o primeiro disparo');
});
