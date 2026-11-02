// tests/fixtures.mjs — T-18 (Senior QA Automation Engineer)
// Fábricas de dados de teste para js/filters.js (D-8: stdlib, sem dependências).
// Cada export é uma FUNÇÃO que devolve objetos novos a cada chamada — nenhum
// estado mutável compartilhado entre testes (regra de independência de dados).
//
// `sampleItems()` cobre o cenário mínimo das regras de negócio:
// - mesmos preços com nomes diferentes → desempate RB-11 é exercitável;
// - as 6 categorias do enum §5.3 (bebidas, refeicoes, pousada, pocoes, armas, armaduras);
// - armas nas 3 subcategorias (simples, marciais, versateis — RF-02);
// - armadura pesada com strengthReq (schema §5.2);
// - pousada com `unit: 'por noite'` (RB-02);
// - item com `price: 0` (borda da faixa US-03);
// - nomes com acento/caixa mista: "Poção de Cura", "Skooma", "Suíte Luxuosa", "Hidromel".
//
// Shape EXATO do schema (ARCHITECTURE §5.2): id, name, category, subcategory,
// price, unit, weightKg, damage, armorClass, strengthReq, effectText,
// modifiers, restrictions, tags.

/**
 * Itens fake determinísticos (11 itens, ids únicos) — nova estrutura por chamada.
 *
 * @returns {Object[]} array de itens no formato do envelope `data.items`
 */
export function sampleItems() {
  return [
    {
      id: 'bebida-hidromel',
      name: 'Hidromel',
      category: 'bebidas',
      subcategory: null,
      price: 3,
      unit: null,
      weightKg: null,
      damage: null,
      armorClass: null,
      strengthReq: null,
      effectText: 'Bebida alcoólica feita de mel fermentado.',
      modifiers: [],
      restrictions: [],
      tags: [],
    },
    {
      id: 'bebida-skooma',
      name: 'Skooma',
      category: 'bebidas',
      subcategory: null,
      price: 20,
      unit: null,
      weightKg: null,
      damage: null,
      armorClass: null,
      strengthReq: null,
      effectText: '+1 For/Dex/Con, -1 Int/Sab/Car. Dura: [Descanso Curto]',
      modifiers: [
        { value: 1, label: 'For/Dex/Con' },
        { value: -1, label: 'Int/Sab/Car' },
      ],
      restrictions: [],
      tags: ['droga', 'bonus', 'malus'],
    },
    {
      id: 'refeicao-luxuosa',
      name: 'Refeição Luxuosa',
      category: 'refeicoes',
      subcategory: null,
      price: 10,
      unit: null,
      weightKg: null,
      damage: null,
      armorClass: null,
      strengthReq: null,
      effectText: 'Refeição completa e saborosa.',
      modifiers: [],
      restrictions: [],
      tags: [],
    },
    {
      id: 'pousada-suite-luxuosa',
      name: 'Suíte Luxuosa',
      category: 'pousada',
      subcategory: null,
      price: 12,
      unit: 'por noite',
      weightKg: null,
      damage: null,
      armorClass: null,
      strengthReq: null,
      effectText: 'Quarto amplo com cama confortável.',
      modifiers: [],
      restrictions: [],
      tags: ['pousada'],
    },
    {
      // Empate de preço (10 PO) com `refeicao-luxuosa` → desempate RB-11 por name.
      id: 'pocao-de-cura',
      name: 'Poção de Cura',
      category: 'pocoes',
      subcategory: null,
      price: 10,
      unit: null,
      weightKg: null,
      damage: null,
      armorClass: null,
      strengthReq: null,
      effectText: 'Recupera pontos de vida.',
      modifiers: [],
      restrictions: ['não acumulativo'],
      tags: ['cura'],
    },
    {
      // Borda US-03: preço 0 deve ficar visível com priceMin = 0.
      id: 'pocao-de-ensaio',
      name: 'Poção de Ensaio',
      category: 'pocoes',
      subcategory: null,
      price: 0,
      unit: null,
      weightKg: null,
      damage: null,
      armorClass: null,
      strengthReq: null,
      effectText: 'Amostra gratuita de uma poção comum.',
      modifiers: [],
      restrictions: [],
      tags: ['gratis'],
    },
    {
      id: 'arma-simples-adaga',
      name: 'Adaga',
      category: 'armas',
      subcategory: 'simples',
      price: 2,
      unit: null,
      weightKg: 1,
      damage: '1d4',
      armorClass: null,
      strengthReq: null,
      effectText: null,
      modifiers: [],
      restrictions: [],
      tags: ['arma'],
    },
    {
      id: 'arma-marcial-espada-longa',
      name: 'Espada Longa',
      category: 'armas',
      subcategory: 'marciais',
      price: 15,
      unit: null,
      weightKg: 1.5,
      damage: '1d8',
      armorClass: null,
      strengthReq: null,
      effectText: null,
      modifiers: [],
      restrictions: [],
      tags: ['arma'],
    },
    {
      id: 'arma-versatil-lanca',
      name: 'Lança',
      category: 'armas',
      subcategory: 'versateis',
      price: 18,
      unit: null,
      weightKg: 2,
      damage: '1d6/1d8',
      armorClass: null,
      strengthReq: null,
      effectText: null,
      modifiers: [],
      restrictions: [],
      tags: ['arma'],
    },
    {
      id: 'armadura-couro-batido',
      name: 'Couro Batido',
      category: 'armaduras',
      subcategory: 'leves',
      price: 8,
      unit: null,
      weightKg: 4,
      damage: null,
      armorClass: '11 + Destreza',
      strengthReq: null,
      effectText: null,
      modifiers: [],
      restrictions: [],
      tags: ['armadura'],
    },
    {
      // Armadura pesada com strengthReq (schema §5.2).
      id: 'armadura-placas',
      name: 'Placas',
      category: 'armaduras',
      subcategory: 'pesadas',
      price: 150,
      unit: null,
      weightKg: 30,
      damage: null,
      armorClass: '18',
      strengthReq: 15,
      effectText: null,
      modifiers: [],
      restrictions: [],
      tags: ['armadura', 'pesada'],
    },
  ];
}

/**
 * Filtros no padrão do contrato (RF-04/RF-06/RF-11 — idêntico a initialFilters()
 * de js/state.js, §6.1). Objeto novo por chamada: mutar um resultado não pode
 * vazar para os demais testes.
 *
 * @returns {{query: string, priceMin: null, priceMax: null, category: string, subcategory: string}}
 */
export function filtersPadrao() {
  return {
    query: '',
    priceMin: null,
    priceMax: null,
    category: 'all',
    subcategory: 'all',
  };
}
