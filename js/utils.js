// utils.js — utilitários genéricos + mapas de label de UI (módulo folha: sem DOM, sem storage, sem imports do projeto).

/**
 * Normaliza texto para comparação de busca (RF-03): remove acentos e caixa.
 * NFD separa o acento em combining mark (U+0300–U+036F), que é removido —
 * assim "pocao" encontra "Poção" e "POÇÃO" vira "pocao".
 *
 * @param {*} s texto de entrada (não-string vira '' — defesa barata contra dado corrompido do JSON)
 * @returns {string} texto sem acento e em minúsculas
 */
export function normalizeText(s) {
  if (typeof s !== 'string') {
    return '';
  }

  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Atrasa a execução de `fn` até `ms` sem novas chamadas (debounce trailing).
 * Usado só no campo de busca (200 ms ≤ limite de 300 ms da RF-03) para não
 * filtrar a cada tecla; selects/preço usam evento `change` direto.
 *
 * @param {Function} fn função a executar com os últimos argumentos recebidos
 * @param {number} ms janela de espera em milissegundos
 * @returns {Function} função debounced (leading=false, trailing=true)
 */
export function debounce(fn, ms) {
  let timerId = null;

  return function debounced(...args) {
    if (timerId !== null) {
      clearTimeout(timerId);
    }

    timerId = setTimeout(() => {
      timerId = null;
      fn(...args);
    }, ms);
  };
}

/**
 * Formata o preço em PO (RB-01: moeda única, sem conversão) acrescentando a
 * unidade de período quando informada (RB-02: Pousada usa "por noite").
 *
 * @param {number} price preço inteiro em PO
 * @param {string|null} [unit] "por noite" para pousada; null/undefined para compra única
 * @returns {string} ex.: "10 PO" ou "5 PO / noite"
 */
export function formatPrice(price, unit) {
  const base = `${price} PO`;

  return unit === 'por noite' ? `${base} / noite` : base;
}

/**
 * Labels PT-BR das categorias (chave ASCII no dado → texto que o usuário vê).
 * Ponto único de tradução (D-9): trocar um label é mudar 1 linha.
 *
 * @type {Record<string, string>}
 */
export const CATEGORY_LABELS = Object.freeze({
  bebidas: 'Bebidas',
  refeicoes: 'Refeições',
  pousada: 'Pousada',
  pocoes: 'Poções de Vida',
  armas: 'Armas',
  armaduras: 'Armaduras & Escudo',
});

/**
 * Labels PT-BR das subcategorias (só armas e armaduras têm subcategoria).
 *
 * @type {Record<string, string>}
 */
export const SUBCATEGORY_LABELS = Object.freeze({
  simples: 'Simples',
  marciais: 'Marciais',
  versateis: 'Versáteis',
  leves: 'Leves',
  medias: 'Médias',
  pesadas: 'Pesadas',
  escudo: 'Escudo',
});

/**
 * Ordem fixa de exibição das categorias no modo agrupado (RF-01): é a ordem
 * em que a fonte lista os itens, então o agrupado devolve a mesma leitura
 * original do Discord.
 *
 * @type {string[]}
 */
export const CATEGORY_ORDER = Object.freeze([
  'bebidas',
  'refeicoes',
  'pousada',
  'pocoes',
  'armas',
  'armaduras',
]);
