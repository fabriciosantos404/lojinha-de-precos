# Changelog

Todas as mudanças notáveis neste projeto são documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.1.0] - 2026-11-02

Primeira versão completa (MVP) do **lojinha-de-precos** — catálogo de preços de itens de RPG,
100% estático, executável localmente com um comando.

### Added

- **Site completo** — página única `index.html` + `css/styles.css` (mobile-first, 320–1440 px, contraste WCAG AA nos dois temas).
- **Catálogo de 50 itens** em `data/items.json` (envelope `{version: 1, items}`), 6 categorias (Bebidas, Refeições, Pousada, Poções de Vida, Armas, Armaduras & Escudo) e 7 subcategorias, transcrição fiel da fonte (RB-12) sem emotes residuais do Discord (RF-14).
- **6 módulos ES** (`js/app.js`, `state.js`, `filters.js`, `render.js`, `theme.js`, `utils.js`), sem bundler e sem dependências.
- **Busca por nome** sem diferenciar maiúsculas/acentos (normalização NFD) com debounce de 200 ms (RF-03).
- **Filtro por faixa de preço** (mín/máx em PO) combinado com os demais filtros por AND (RF-04, RB-10).
- **Filtro por categoria e subcategoria**, com subcategorias restritas à categoria selecionada (RF-06).
- **Ordenação** por preço (↑/↓) e nome (A→Z/Z→A) com desempate determinístico (RF-05, RB-11); modo agrupado por categoria como padrão (D-5).
- **Modo escuro/claro** com persistência defensiva em `localStorage` e fallback para o tema do sistema (RF-07, RNF-08).
- **Badges visuais** de preço, peso, dano, CA, requisito de FOR, cura, duração e restrições; bônus positivos (verde/`+`) e negativos (vermelho/`−`) distintos também por sinal (RF-08, RF-09).
- **Contagem de resultados** em região `aria-live` e **estado vazio** com botão "Limpar filtros" (RF-10, RF-11).
- **Estado de erro amigável** com botão "Tentar novamente" para JSON ausente/inválido, e detecção de abertura via `file://` (RNF-09, risco 1).
- **Servidor local com um comando** — `scripts/serve.ps1` (Windows) e `scripts/serve.sh` (macOS/Linux), com fallback `python` → `py`/`python3` e alternativa `npx serve` (RF-15, D-2).
- **Testes automatizados** com a stdlib do Node (`node --test`, sem `npm install` — D-18): `tests/utils.test.mjs`, `tests/state.test.mjs`, `tests/filters.test.mjs` cobrindo normalização, imutabilidade, AND dos filtros, faixa, desempate e agrupamento.
- **Validador de dados** `scripts/validate_data.py` (Python stdlib): schema, enums, `id` únicos, contagens, coerência de `modifiers` e emotes residuais — obrigatório antes de commitar mudanças no JSON.
- **Documentação**: `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/PLAN_EXECUCAO.md`, `docs/DATA.md`, `docs/EMOTES.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md` (runbook local).
- **Offline total** após servido — zero CDN, zero fontes externas, zero dependências npm (RNF-04).
- **CSP restritiva** via meta tag (`script-src 'self'`), `innerHTML`/`eval` proibidos no projeto (RNF-07).

### Changed

- Reescrito `README.md`: onboarding em ≤ 2 comandos, aviso destacado sobre `file://`, 3 variantes de servidor, features, testes, edição do JSON e mapa da documentação.
- Revisado `.gitignore` (não recriado): agora ignora também artefatos de segredos locais (`.env*`, mantendo `!.env.example`) além de `node_modules/`, `__pycache__/`, arquivos de sistema e editores.

### Fixed

- Nenhuma correção nesta primeira versão — tudo implementado de acordo com `docs/REQUIREMENTS.md` e `docs/ARCHITECTURE.md` desde o início. Esta seção passa a registrar correções a partir da v0.1.1.

> Referências de link de versão serão adicionadas quando o repositório for publicado.
