# Lojinha de Preços — Catálogo de Itens de RPG

Site estático (HTML/CSS/JS puro, **zero dependências, zero build**) que serve como catálogo consultável dos preços de uma loja de RPG estilo D&D: **50 itens em 6 categorias** (Bebidas, Refeições, Pousada, Poções de Vida, Armas, Armaduras & Escudo) com busca por nome sem acento, filtro por faixa de preço, filtro por categoria/subcategoria, ordenação por preço ou nome, modo escuro persistido e badges visuais de efeitos, atributos e restrições.

> ## ⚠️ Aviso importante: servidor local é OBRIGATÓRIO
>
> O site usa **módulos ES** (`<script type="module">`) e `fetch()` do `data/items.json`.
> Os navegadores **bloqueiam** esses recursos quando a página é aberta direto do disco
> (`file://` — duplo clique no `index.html`) → tela em branco.
> **Não abra o `index.html` pelo explorador de arquivos.** Use sempre um dos comandos abaixo
> e acesse **http://localhost:8000**.

## Pré-requisito único

Um **servidor de arquivos estáticos local** (um comando — decisão D-2). As opções usam
ferramentas que já existem no seu sistema ou são baixadas sob demanda — **o projeto em si
não tem `npm install`, não tem `package.json` e não tem etapa de build.**

## Rodando o site

Escolha **UMA** variante, na raiz do repositório, e depois abra **http://localhost:8000**:

```bash
# Windows (PowerShell)
.\scripts\serve.ps1

# macOS / Linux (Git Bash e WSL também funcionam)
./scripts/serve.sh

# Alternativas manuais (sem os scripts do projeto)
python -m http.server 8000   # Python 3 no PATH (no Windows: py -3 -m http.server 8000)
npx serve                    # alternativa via Node.js → http://localhost:3000
```

Parar o servidor: `Ctrl+C` no terminal onde ele está rodando.
Detalhes de portas, troubleshooting e verificações: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Funcionalidades

- **Busca por nome** em tempo real, sem diferenciar maiúsculas nem acentos (digite `pocao` → acha *Poção*, `sko` → acha *Skooma*).
- **Faixa de preço** (mínimo e máximo em PO) combinada com os demais filtros por **E (AND)**.
- **Filtro por categoria** e **subcategoria** (Armas → Simples/Marciais/Versáteis; Armaduras → Leves/Médias/Pesadas/Escudo).
- **Ordenação** por preço (↑/↓) e por nome (A→Z/Z→A); no padrão, itens **agrupados por categoria**.
- **Modo escuro/claro** alternável por botão e **persistido** no navegador (`localStorage`).
- **Badges** de preço, peso, dano, CA, requisito de FOR, cura, bônus positivos (verde) e negativos (vermelho), restrições e duração.
- **Contagem de resultados** (região acessível `aria-live`) e **estado vazio** com botão "Limpar filtros".
- **Estado de erro amigável** (não tela branca) se o JSON faltar/estiver inválido, com "Tentar novamente".
- **Offline**: depois de servido localmente, funciona sem internet (zero CDN, zero fonte externa).

## Testes

```bash
# Testes automatizados da lógica pura (módulos utils/state/filters)
# — usa a stdlib do Node (node:test), SEM npm install
node --test

# Validação do catálogo — OBRIGATÓRIO antes de commitar mudanças em data/
# (Windows sem `python` no PATH: py scripts/validate_data.py)
python scripts/validate_data.py
```

O validador checa envelope/schema, enums, `id` únicos, contagens por categoria,
coerência de `modifiers` e ausência de emotes residuais do Discord (exit 0 = válido).

## Como editar preços e itens

Tudo que é visível no site vive em **`data/items.json`** — nenhum toque em HTML/JS é
necessário para alterar preço, efeito ou adicionar item:

1. Edite o valor (ex.: `"price": 4`) ou adicione um objeto de item no array `items`.
2. Rode `python scripts/validate_data.py` — exit 0 = ok.
3. Recarregue http://localhost:8000.

Schema completo, enums e passo a passo de adição de item: **[docs/DATA.md](docs/DATA.md)**.

## Estrutura do projeto

```
lojinha-de-precos/
├── index.html            # Página única (header, filtros, lista, footer)
├── css/styles.css        # Tokens claro/escuro, layout mobile-first, badges
├── js/                   # 6 módulos ES: app, state, filters, render, theme, utils
├── data/items.json       # Fonte da verdade do catálogo (50 itens, envelope v1)
├── scripts/              # serve.ps1, serve.sh, validate_data.py
├── tests/                # node:test (*.test.mjs) + checklist manual
├── docs/                 # Requisitos, arquitetura, dados, segurança, deploy...
├── CHANGELOG.md          # Keep a Changelog
└── LICENSE               # MIT
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Requisitos funcionais/não funcionais, regras de negócio, user stories |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura, contratos dos módulos, decisões (D-*) |
| [docs/PLAN_EXECUCAO.md](docs/PLAN_EXECUCAO.md) | Plano de execução, donos de arquivos, DoD |
| [docs/DATA.md](docs/DATA.md) | Schema do JSON e como editar/adicionar itens |
| [docs/EMOTES.md](docs/EMOTES.md) | Mapeamento `:emote:` → emoji (rastreabilidade) |
| [docs/SECURITY.md](docs/SECURITY.md) | Revisão de segurança e mitigações |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Runbook local: subir/descer, troubleshooting, rollback |
| [CHANGELOG.md](CHANGELOG.md) | Histórico de versões (Keep a Changelog) |

## Licença

Distribuído sob a licença **MIT** — ver [LICENSE](LICENSE).
