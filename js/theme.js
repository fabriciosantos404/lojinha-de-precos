// Tema claro/escuro: aplica data-theme no <html> e é o único módulo com acesso a localStorage (§6.3 regra 5).

const STORAGE_KEY = 'theme';

// Falha de storage é recorrente em aba privada: avisa só na 1ª vez para não poluir o console.
let hasWarnedStorageFailure = false;

/**
 * Aplica o tema no <html> e sincroniza o botão #theme-toggle (aria-label + aria-pressed).
 * @param {'light'|'dark'} theme
 * @returns {void}
 */
export function applyTheme(theme) {
  assertTheme(theme);
  document.documentElement.dataset.theme = theme;

  const button = document.getElementById('theme-toggle');
  if (button === null) {
    return; // tolerado: a página pode não ter o botão (ex.: testes/frames)
  }
  const isDark = theme === 'dark';
  button.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
  button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
}

/**
 * Resolve o tema na inicialização: storage → preferência do sistema → aplica e retorna.
 * Nunca lança, mesmo com localStorage indisponível (RNF-08).
 * @returns {'light'|'dark'}
 */
export function initTheme() {
  const theme = readStoredTheme() ?? preferredTheme();
  applyTheme(theme);
  return theme;
}

/**
 * Alterna a partir do tema atual, aplica imediatamente e persiste.
 * Falha ao persistir é tolerada (o tema visual sempre muda); retorna o tema aplicado.
 * @param {'light'|'dark'} current tema atual — valor fora do enum lança TypeError (D-14)
 * @returns {'light'|'dark'} tema resultante
 */
export function toggleTheme(current) {
  assertTheme(current);
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (error) {
    warnStorageFailure('gravar', error);
  }
  return next;
}

/**
 * Lê o tema persistido; ausente/inválido ou storage quebrado → null (fallback no chamador).
 * @returns {'light'|'dark'|null}
 */
function readStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch (error) {
    warnStorageFailure('ler', error);
    return null;
  }
}

/** Preferência do sistema — padrão quando não há tema salvo válido. */
function preferredTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Fail Fast (D-14): tema fora do enum é bug de wiring, não entrada de usuário. */
function assertTheme(value) {
  if (value !== 'light' && value !== 'dark') {
    throw new TypeError(`theme.js: tema inválido — esperado 'light' ou 'dark', recebido: ${String(value)}`);
  }
}

/** Aviso único de falha de storage: o site segue funcionando, só não persiste (RNF-08). */
function warnStorageFailure(action, error) {
  if (hasWarnedStorageFailure) {
    return;
  }
  hasWarnedStorageFailure = true;
  console.warn(`theme.js: falha ao ${action} o tema no localStorage — seguindo sem persistir (RNF-08).`, error);
}
