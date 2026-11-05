// boot-guard.js — guard de boot CLÁSSICO (sem `type="module"`, sem import).
//
// Por que existe (risco 1 de docs/ARCHITECTURE.md): navegadores bloqueiam
// <script type="module"> via file:// (origin null → CORS), então js/app.js
// NUNCA executa nesse cenário, loadItems() nunca roda e a mensagem
// FILE_PROTOCOL do render.js fica inalcançável — o usuário veria
// "Carregando itens…" para sempre. Este script clássico local carrega
// normalmente em file:// e troca o estado de loading por uma orientação
// PT-BR. Em http(s):// ele retorna cedo e não faz nada (zero overhead).
// A CSP do index.html (`script-src 'self'`) cobre script externo local;
// nenhum inline, nenhum innerHTML/eval (textContent/createElement apenas).

(function () {
  'use strict';

  // Servidor local em uso → o fluxo normal (app.js) cuida de tudo.
  if (location.protocol !== 'file:') {
    return;
  }

  const MESSAGE =
    'Este site precisa de um servidor local (os módulos ES são bloqueados em file://). ' +
    'Rode: py scripts/serve.ps1 — e abra http://localhost:8000';

  /**
   * Troca #state-loading por #state-error com a orientação de servidor,
   * reaproveitando a estrutura existente do index.html. Null-tolerant:
   * cada elemento ausente é ignorado — nunca lança exceção ao usuário.
   * Apenas textContent/atributos; o HTML interno não é reescrito.
   */
  function showFileProtocolGuidance() {
    const loading = document.getElementById('state-loading');
    if (loading !== null) {
      loading.setAttribute('hidden', '');
    }

    const errorBox = document.getElementById('state-error');
    if (errorBox === null) {
      return;
    }
    errorBox.removeAttribute('hidden');

    const message = errorBox.querySelector('p');
    if (message !== null) {
      message.textContent = MESSAGE;
    }

    // Em file:// o app.js não roda → o handler do #retry nunca é registrado;
    // escondemos o botão morto em vez de exibir uma ação que nada faz (UX).
    const retry = errorBox.querySelector('button');
    if (retry !== null) {
      retry.setAttribute('hidden', '');
    }
  }

  // O script fica no <head> (antes do módulo): na execução o body ainda não
  // existe — aguarda DOMContentLoaded para tocar nos elementos. Se o documento
  // já estiver pronto (injeção tardia), executa imediatamente.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showFileProtocolGuidance);
  } else {
    showFileProtocolGuidance();
  }
})();
