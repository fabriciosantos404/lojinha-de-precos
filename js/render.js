// render.js — única camada DOM do app: lista/cards, contagem aria-live, estados
// (loading/vazio/erro) e opções do select de subcategoria (contrato §6.2).
// DAG (§12.1): importa APENAS utils.js — nunca filters/state/app/theme.
// Segurança (§9): textContent SEMPRE; innerHTML/insertAdjacentHTML/eval proibidos;
// nenhum atributo style= inline (CSP `style-src 'self'`).

import { CATEGORY_LABELS, SUBCATEGORY_LABELS, formatPrice } from './utils.js';

/**
 * @typedef {{ key: string, label: string, items: Array<Object> }} Group
 */

// ---------------------------------------------------------------------------
// Mapas internos de apresentação (labels de UI são de utils.js/D-9; isto é layout)
// ---------------------------------------------------------------------------

// Emoji derivado da categoria do item (RF-14: emote da fonte → visual do card).
const CATEGORY_EMOJIS = Object.freeze({
  bebidas: '🍹',
  refeicoes: '🍽️',
  pousada: '🛏️',
  pocoes: '🧪',
  armas: '⚔️',
  armaduras: '🛡️',
});

const FALLBACK_EMOJI = '📦';

// Ordem fixa das subcategorias por categoria (RF-02) — espelho do mapa de
// filters.js: a DAG proíbe importar filters.js daqui, então a ordem é
// duplicada de propósito e mantida em sincronia por revisão.
const SUBCATEGORY_KEYS_BY_CATEGORY = Object.freeze({
  armas: Object.freeze(['simples', 'marciais', 'versateis']),
  armaduras: Object.freeze(['leves', 'medias', 'pesadas', 'escudo']),
});

// Badges derivadas de tags (D-19): só estas viram badge--tag. As demais
// (cura, bonus, malus, restricao, descanso-*) são meta ou já têm badge própria
// — cura vive no effectText (D-15); restricao vem de restrictions[] (D-6).
const TAG_BADGE_KEYS = Object.freeze(['droga', 'slot-magia', 'atributo']);

// Duração derivada da tag, nunca de texto livre (§5.3).
const DURATION_BY_TAG = Object.freeze({
  'descanso-curto': '[Descanso Curto]',
  'descanso-longo': '[Descanso Longo]',
});

// Mensagens PT-BR por código de erro (RNF-09): usuário vê frase amigável +
// ação de retry; stack trace só no console.
const ERROR_MESSAGES = Object.freeze({
  NETWORK: 'Não foi possível carregar os itens. Verifique se o servidor local está rodando.',
  NOT_FOUND: 'Não foi possível carregar os itens. Verifique se o servidor local está rodando.',
  PARSE: 'O arquivo de dados está inválido. Verifique o arquivo data/items.json e tente novamente.',
  SCHEMA: 'O arquivo de dados está inválido. Verifique o arquivo data/items.json e tente novamente.',
  FILE_PROTOCOL:
    'Este site precisa de um servidor local (os módulos ES são bloqueados em file://). ' +
    'Rode .\\scripts\\serve.ps1 (Windows) ou ./scripts/serve.sh (macOS/Linux) — depois abra http://localhost:8000',
});

const FALLBACK_ERROR_MESSAGE = ERROR_MESSAGES.NETWORK;

// Ids ausentes são reportados UMA vez e nunca propagam exceção ao usuário.
const reportedMissingIds = new Set();

/**
 * Busca element por id com falha silenciosa: ausência vira console.error
 * único + null (o chamador faz early-return — nunca tela branca).
 *
 * @param {string} id id estável do index.html
 * @returns {Element|null}
 */
function byId(id) {
  const element = document.getElementById(id);

  if (element === null && !reportedMissingIds.has(id)) {
    reportedMissingIds.add(id);
    console.error(`render.js: elemento #${id} ausente no DOM — ação ignorada`);
  }

  return element;
}

/**
 * Visibilidade dos 4 estados mutuamente exclusivos de #results (RNF-02):
 * exatamente um fica visível por vez (CSS `[hidden]` esconde os demais).
 *
 * @param {{loading?: boolean, empty?: boolean, error?: boolean, list?: boolean}} states estado desejado
 */
function setStates({ loading = false, empty = false, error = false, list = false } = {}) {
  setVisible('state-loading', loading);
  setVisible('state-empty', empty);
  setVisible('state-error', error);
  setVisible('item-list', list);
}

/**
 * @param {string} id id do elemento
 * @param {boolean} visible true = visível (remove `hidden`), false = oculto
 */
function setVisible(id, visible) {
  const element = byId(id);
  if (element !== null) {
    element.hidden = !visible;
  }
}

// ---------------------------------------------------------------------------
// Fábricas de elemento (SÓ createElement + textContent + className — §9)
// ---------------------------------------------------------------------------

/**
 * @param {string} variant classe da variante (ex.: 'bonus' → 'badge badge--bonus')
 * @param {string} text texto da badge (nunca HTML)
 * @returns {HTMLElement} <li> com classe badge
 */
function createBadge(variant, text) {
  const badge = document.createElement('li');
  badge.className = `badge badge--${variant}`;
  badge.textContent = text;
  return badge;
}

/**
 * @param {string} value valor da opção ('all' ou SubcategoryKey)
 * @param {string} label texto visível PT-BR
 * @returns {HTMLOptionElement}
 */
function createOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

/**
 * Cabeçalho do card: emoji decorativo (aria-hidden) + nome (h3) + preço (RF-08).
 *
 * @param {Object} data item normalizado
 * @returns {HTMLElement} .card__header
 */
function createCardHeader(data) {
  const header = document.createElement('div');
  header.className = 'card__header';

  // Emoji é decorativo: o nome do item já está no h3 ao lado (RNF-02).
  const emoji = document.createElement('span');
  emoji.className = 'card__emoji';
  emoji.setAttribute('aria-hidden', 'true');
  emoji.textContent = CATEGORY_EMOJIS[data.category] ?? FALLBACK_EMOJI;

  const name = document.createElement('h3');
  name.className = 'card__name';
  name.textContent = typeof data.name === 'string' ? data.name : '';

  // Preço SEMPRE no header, com unidade de período quando existir (RB-01/RB-02).
  const price = document.createElement('span');
  price.className = 'card__price';
  price.textContent = formatPrice(data.price, data.unit);

  header.append(emoji, name, price);
  return header;
}

/**
 * Descrição do card: `effectText` fiel integral (D-15) — null/'' → sem <p>.
 *
 * @param {Object} data item normalizado
 * @returns {HTMLElement|null}
 */
function createCardDescription(data) {
  if (typeof data.effectText !== 'string' || data.effectText === '') {
    return null;
  }

  const paragraph = document.createElement('p');
  paragraph.className = 'card__description';
  paragraph.textContent = data.effectText;
  return paragraph;
}

/**
 * Badges derivadas de dado tipado — nunca de parsing de texto (D-6/D-19).
 * Ordem: unit, weight, damage, ac, req, bonus(+), malus(−), restriction,
 * duration, tag. Sem badge de cura (D-19: cura vive no effectText).
 *
 * @param {HTMLElement} list <ul class="card__badges">
 * @param {Object} data item normalizado
 */
function appendCardBadges(list, data) {
  // Unidade de período ("por noite") — o preço completo já está no card__price.
  if (typeof data.unit === 'string' && data.unit !== '') {
    list.appendChild(createBadge('unit', data.unit));
  }

  if (data.weightKg !== null && data.weightKg !== undefined) {
    list.appendChild(createBadge('weight', `${data.weightKg} kg`));
  }

  if (typeof data.damage === 'string' && data.damage !== '') {
    list.appendChild(createBadge('damage', data.damage));
  }

  // RB-04: fonte traz "14 + Dex máx +2" (armadura) ou "+2" (escudo) → prefixo "CA ".
  if (typeof data.armorClass === 'string' && data.armorClass !== '') {
    const text = data.armorClass.startsWith('CA') ? data.armorClass : `CA ${data.armorClass}`;
    list.appendChild(createBadge('ac', text));
  }

  if (data.strengthReq !== null && data.strengthReq !== undefined) {
    list.appendChild(createBadge('req', `FOR ${data.strengthReq}`));
  }

  appendModifierBadges(list, data.modifiers);
  appendRestrictionBadges(list, data.restrictions);
  appendTagBadges(list, data.tags);
}

/**
 * Bônus/malus (RF-09): value>0 → badge--bonus com sinal "+", value<0 →
 * badge--malus com o próprio "-". A cor nunca é o único sinal (risco #11).
 *
 * @param {HTMLElement} list <ul class="card__badges">
 * @param {Array<Object>} modifiers modifiers do item (D-6)
 */
function appendModifierBadges(list, modifiers) {
  if (!Array.isArray(modifiers)) {
    return;
  }

  for (const modifier of modifiers) {
    if (modifier === null || typeof modifier !== 'object') {
      continue;
    }

    const { value, label } = modifier;
    if (typeof value !== 'number' || value === 0) {
      continue; // D-6: value é inteiro ≠ 0; 0/dado corrompido não vira badge
    }

    const sign = value > 0 ? '+' : ''; // negativo já traz "-" em value
    const suffix = typeof label === 'string' && label !== '' ? ` ${label}` : '';
    const variant = value > 0 ? 'bonus' : 'malus';
    list.appendChild(createBadge(variant, `${sign}${value}${suffix}`));
  }
}

/**
 * Restrições (RB-05/D-6): cada string de `restrictions[]` vira uma badge.
 *
 * @param {HTMLElement} list <ul class="card__badges">
 * @param {Array<string>} restrictions restrictions do item
 */
function appendRestrictionBadges(list, restrictions) {
  if (!Array.isArray(restrictions)) {
    return;
  }

  for (const restriction of restrictions) {
    if (typeof restriction === 'string' && restriction !== '') {
      list.appendChild(createBadge('restriction', restriction));
    }
  }
}

/**
 * Badges de duração e de tag (§5.3/D-19): descanso-* viram "[Descanso …]";
 * só droga/slot-magia/atributo viram badge--tag — as demais tags são meta.
 *
 * @param {HTMLElement} list <ul class="card__badges">
 * @param {Array<string>} tags tags do item
 */
function appendTagBadges(list, tags) {
  if (!Array.isArray(tags)) {
    return;
  }

  for (const tag of tags) {
    if (typeof tag !== 'string' || tag === '') {
      continue;
    }

    const duration = DURATION_BY_TAG[tag];
    if (duration !== undefined) {
      list.appendChild(createBadge('duration', duration));
      continue;
    }

    if (TAG_BADGE_KEYS.includes(tag)) {
      list.appendChild(createBadge('tag', tag));
    }
    // cura/bonus/malus/restricao: meta — cura está no effectText (D-15/D-19),
    // restrição estruturada já saiu via restrictions[] (D-6).
  }
}

/**
 * Card completo: li.card > header + description? + badges (estrutura do CSS §8).
 *
 * @param {Object} data item normalizado
 * @returns {HTMLElement} <li class="card">
 */
function createCard(data) {
  const item = data !== null && typeof data === 'object' ? data : {};

  const card = document.createElement('li');
  card.className = 'card';

  card.appendChild(createCardHeader(item));

  const description = createCardDescription(item);
  if (description !== null) {
    card.appendChild(description);
  }

  const badges = document.createElement('ul');
  badges.className = 'card__badges';
  appendCardBadges(badges, item);
  card.appendChild(badges);

  return card;
}

/**
 * Grupo do modo agrupado (D-17): li.group > h2.group__title + ul.group__list.
 * li>ul é HTML válido e h2 dentro de li também — assim #item-list continua
 * sendo um <ul> e o título do grupo não é filho ilegal dele.
 *
 * @param {Group} group {key, label, items} (label já resolvido em filters.js)
 * @returns {HTMLElement} <li class="group">
 */
function createGroup(group) {
  const data = group !== null && typeof group === 'object' ? group : {};

  const wrapper = document.createElement('li');
  wrapper.className = 'group';

  const title = document.createElement('h2');
  title.className = 'group__title';
  // Defesa barata: filters.js resolve o label; CATEGORY_LABELS é o fallback.
  title.textContent =
    typeof data.label === 'string' && data.label !== ''
      ? data.label
      : CATEGORY_LABELS[data.key] ?? String(data.key ?? '');

  const cardList = document.createElement('ul');
  cardList.className = 'group__list';
  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      cardList.appendChild(createCard(item));
    }
  }

  wrapper.append(title, cardList);
  return wrapper;
}

/**
 * Detecta Group[] vs Item[] (D-5): só Group tem `items` como array;
 * Item do schema §5.2 não possui esse campo.
 *
 * @param {Array<Object>} list lista recebida por renderList
 * @returns {boolean} true = lista de grupos
 */
function isGroupList(list) {
  const first = list[0];
  return first !== null && typeof first === 'object' && Array.isArray(first.items);
}

// ---------------------------------------------------------------------------
// API pública (contrato §6.2)
// ---------------------------------------------------------------------------

/**
 * Pinta #item-list — Group[] (modo agrupado, D-5) ou Item[] (modo plano).
 * Montagem em DocumentFragment + textContent: uma única troca de filhos por
 * render, nenhum HTML interpretado (§9 — XSS via JSON editado, RNF-07).
 * Também promove a lista a estado visível (esconde loading/vazio/erro).
 *
 * @param {Array<Object>} groupsOrItems Group[] ou Item[]
 */
export function renderList(groupsOrItems) {
  const list = byId('item-list');
  if (list === null) {
    return;
  }

  if (!Array.isArray(groupsOrItems)) {
    console.error('render.js: renderList(groupsOrItems) espera Group[] ou Item[]');
    return;
  }

  const fragment = document.createDocumentFragment();

  if (isGroupList(groupsOrItems)) {
    for (const group of groupsOrItems) {
      fragment.appendChild(createGroup(group));
    }
  } else {
    for (const item of groupsOrItems) {
      fragment.appendChild(createCard(item));
    }
  }

  list.replaceChildren(fragment);
  setStates({ list: true });
}

/**
 * Contagem na região aria-live (role="status" no HTML — RF-10/US-02):
 * 0 → "Nenhum item encontrado" · 1 → "1 item encontrado" · N → "N itens encontrados".
 *
 * @param {number} count quantidade de itens no resultado
 */
export function renderCount(count) {
  const element = byId('result-count');
  if (element === null) {
    return;
  }

  if (!Number.isFinite(count)) {
    console.error(`render.js: renderCount espera number, recebeu ${typeof count}`);
  }

  const total = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;

  if (total === 0) {
    element.textContent = 'Nenhum item encontrado';
  } else if (total === 1) {
    element.textContent = '1 item encontrado';
  } else {
    element.textContent = `${total} itens encontrados`;
  }
}

/**
 * Estado vazio (filtros sem match — US-03): mostra #state-empty com o botão
 * "Limpar filtros"; oculta loading/lista/erro. Não altera o conteúdo da lista
 * (fica oculta) — quem repinta é renderList.
 */
export function renderEmpty() {
  setStates({ empty: true });
}

/**
 * Estado de erro (RNF-09): mensagem PT-BR por código dentro do <p> de
 * #state-error, preservando o botão #retry. Código desconhecido → fallback
 * + console.error (nunca lança para o usuário).
 *
 * @param {string} code 'NETWORK'|'NOT_FOUND'|'PARSE'|'SCHEMA'|'FILE_PROTOCOL'
 */
export function renderError(code) {
  const box = byId('state-error');
  if (box === null) {
    return;
  }

  const message = ERROR_MESSAGES[String(code)]; // String(): Symbol não quebra o template
  if (typeof message !== 'string') {
    console.error(`render.js: código de erro desconhecido "${String(code)}"`);
  }
  const text = typeof message === 'string' ? message : FALLBACK_ERROR_MESSAGE;

  // O <p> de mensagem existe no index.html; só ele é atualizado — o botão
  // #retry (ação de recuperação) nunca é destruído.
  let paragraph = box.querySelector('p');
  if (paragraph === null) {
    paragraph = document.createElement('p');
    box.insertBefore(paragraph, box.firstChild);
  }
  paragraph.textContent = text;

  setStates({ error: true });
}

/**
 * Popula/restringe #subcategory (RF-02): opção 'all' "Todas" primeiro e as
 * subcategorias da categoria na ordem fixa; 'all'/categoria sem subcategorias
 * → só "Todas". A seleção volta para 'all' (a opção anterior pode nem existir).
 *
 * @param {string} category 'all' ou CategoryKey
 */
export function renderSubcategoryOptions(category) {
  const select = byId('subcategory');
  if (select === null) {
    return;
  }

  const fragment = document.createDocumentFragment();
  fragment.appendChild(createOption('all', 'Todas'));

  const keys = SUBCATEGORY_KEYS_BY_CATEGORY[category];
  if (keys !== undefined) {
    for (const key of keys) {
      const label = SUBCATEGORY_LABELS[key];
      if (typeof label === 'string') {
        fragment.appendChild(createOption(key, label));
      }
    }
  }

  select.replaceChildren(fragment);
  select.value = 'all';
}

/**
 * Estado de carregando: mostra #state-loading e oculta os demais estados.
 */
export function renderLoading() {
  setStates({ loading: true });
}

/**
 * Estado normal (sucesso): #item-list visível, estados escondidos.
 * Não mexe no conteúdo — quem pinta é renderList.
 */
export function renderReady() {
  setStates({ list: true });
}

/**
 * Esvazia #item-list sem alterar a visibilidade dos estados.
 * (renderList com array novo já substitui tudo; este helper é para reset explícito.)
 */
export function clearResults() {
  const list = byId('item-list');
  if (list !== null) {
    list.replaceChildren();
  }
}
