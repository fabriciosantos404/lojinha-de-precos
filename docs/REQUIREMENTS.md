# REQUIREMENTS.md — lojinha-de-precos

> **Projeto:** lojinha-de-precos
> **Fase:** 1 — Descoberta / Requisitos
> **Status:** Draft para aprovação do Tech Lead
> **Fonte da verdade:** lista de itens transcrevida pelo usuário (decisões 1–4 já tomadas e não questionadas)

---

## 1. Objetivo do produto

O **lojinha-de-precos** é um site estático (HTML/CSS/JS puro, sem build nem framework) que serve como **catálogo consultável dos preços de itens de uma loja de RPG estilo D&D**, organizado por categoria e subcategoria, com busca por nome, filtro por faixa de preço, ordenação por preço/nome e modo escuro. O produto existe para que jogadores e mestres consultem rapidamente quanto custa cada item (bebida, refeição, pousada, poção, arma, armadura), entendendo de relance seus efeitos, requisitos e atributos por meio de badges visuais — substituindo a leitura manual de uma lista longa postada num Discord.

## 2. Público / usuários

| Persona | Papel | O que precisa |
|---|---|---|
| **Jogador** | Personagem que consome itens na loja | Achar rápido o item e o preço; ver efeito da poção/bônus antes de comprar |
| **Mestre (DM)** | Conduz a sessão e aplica os preços | Consultar preços, efeitos, requisitos (FOR) e CA durante a jogo; modo escuro para mesa com luz baixa |
| **Usuário da loja do Discord** | Membro da comunidade que já via a lista em texto | Mesma fidelidade de conteúdo da lista original, mas filtrável e ordenável |
| **Mantenedor do catálogo** | Dono do repositório (o próprio usuário) | Editar preços/efeitos editando apenas JSON, sem tocar no código |

> Não há personas de administrador, pagamento ou suporte: é um site de leitura.

## 3. Escopo

### In
- Visualização dos itens em cards/lista, agrupados por **categoria** e **subcategoria**.
- **Busca por nome** (parcial, ignorando maiúsculas/acentos).
- **Filtro de faixa de preço** (mínimo e máximo em PO).
- **Filtro por categoria e subcategoria.**
- **Ordenação** por preço (asc/desc) e por nome (asc/desc).
- **Modo escuro/claro** com persistência em `localStorage`.
- **Badges de atributos/efeitos**: cura, bônus (positivos e negativos), requisito de FOR, CA, peso, dano, duração, restrições.
- **Contagem de resultados** e **estado vazio** com ação de limpar filtros.
- **Dados 100% em JSON** editável, transcrição fiel da lista do usuário (emotes do Discord → emojis equivalentes).
- **Execução local** com um comando simples de servidor estático.

### Out (com justificativa)
- **Carrinho, pagamento, checkout** — é um site de visualização, não e-commerce (decisão 2: sem comparador; escopo é consulta).
- **Login/conta/autorização** — conteúdo público e estático, sem backend.
- **API/backend/banco de dados** — decisão 1 (HTML/CSS/JS puro) e decisão 3 (deploy local).
- **IA/recomendações** — fora do pedido original.
- **Comparador de itens** — explicitamente excluído pelo usuário (decisão 2).
- **Conversão de moedas (PP/PE/PC/PL)** — fonte usa moeda única PO (regra RB-08).
- **GitHub Pages / deploy na nuvem** — decisão 3 (somente local agora), sem bloquear evolução futura (estrutura de pastas preparada).
- **Persistência de filtros/ordenação além do tema** — *Should*, não *Must* (ver MoSCoW).

## 4. Requisitos funcionais

| ID | Requisito | Critério de verificação mínimo |
|---|---|---|
| **RF-01** | Exibir todos os itens da fonte agrupados por **categoria** (Bebidas, Refeições, Pousada, Poções de Vida, Armas, Armaduras & Escudo). | Todos os 50 itens aparecem sob a categoria correta. |
| **RF-02** | Exibir **subcategorias** quando aplicável: Armas → Simples / Marciais / Versáteis; Armaduras → Leves / Médias / Pesadas / Escudo. | Cada item da fonte está na subcategoria correta. |
| **RF-03** | **Busca por nome**: campo de texto filtra em tempo real (input ou ≤300 ms de debounce) por correspondência parcial, sem diferenciar maiúsculas/minúsculas nem acentos. | "pocao" encontra "Poção"; "sko" encontra "Skooma". |
| **RF-04** | **Faixa de preço**: campos "mínimo" e "máximo" (números ≥ 0 em PO) que combinam com a busca e os demais filtros (E **AND** entre tipos de filtro). | Definir mín=5 e máx=15 mostra apenas itens de 5–15 PO. |
| **RF-05** | **Ordenação** por **preço** (crescente/decrescente) e por **nome** (A→Z/Z→A), com estado inicial por categoria. | Ordenar por preço asc retorna Cura Menor (5) antes de Cura Básica (10); desempate por nome asc. |
| **RF-06** | **Filtro por categoria** (seleção única com opção "Todas", padrão "Todas") e, visível quando relevante, **filtro por subcategoria**. | Selecionar "Armas" + "Marciais" lista exatamente 4 itens (D-13). |
| **RF-07** | **Modo escuro/claro** alternável por botão, aplicado imediatamente e **persistido em `localStorage`**; padrão = tema do sistema ou claro. | Recarregar a página mantém o tema escolhido. |
| **RF-08** | **Badges de atributos** por item: `preço (PO)`, `peso (kg)`, `dano (ex.: 1d8)`, `CA` (ex.: `CA 14 + Dex máx +2`), `requisito (FOR 13)`, `cura (ex.: 4d4+4)`, `bônus (+1 concentração)`, `restrição (não acumulativo)`, `duração ([Descanso Curto])`. | Cada item exibe todos os atributos aplicáveis da fonte. |
| **RF-09** | **Badges de efeito** destacam visualmente **bônus positivos** (verde) e **negativos** (vermelho) — ex.: Skooma `+1 For/Dex/Con` (verde) e `-1 Int/Sab/Car` (vermelho). | Skooma exibe ambos os bônus com cores/sinais distintos. |
| **RF-10** | **Contagem de resultados** visível ("N itens encontrados"), atualizada a cada mudança de filtro/busca/ordenação. | Com filtro de categoria Bebidas: "12 itens encontrados". |
| **RF-11** | **Estado vazio**: quando nenhum item corresponde, exibir mensagem clara + botão **"Limpar filtros"** que restaura estado inicial. | Busca "xyz" sem match mostra estado vazio; clicar em limpar restaura os 50 itens. |
| **RF-12** | **Persistência de preferências**: tema sempre persistido; filtros, busca e ordenação podem ser restaurados na sessão (*Should*). | Ver RF-07 (obrigatório) e história US-08 (opcional). |
| **RF-13** | **Dados em JSON** (`data/items.json`): todos os 50 itens com nome, categoria, subcategoria, preço, peso, efeitos e restrições fiéis à fonte. | Conferência item a item contra a lista do usuário (Seção 7). |
| **RF-14** | **Substituição de emotes do Discord** por emojis equivalentes nos textos/nomes, mantendo o restante do texto fiel. | Nenhum `:Emote:` permanece no JSON. |
| **RF-15** | **Servidor local**: um comando único (ex.: `python -m http.server 8000` ou `npx serve`) serve o site. | O site abre em `http://localhost:8000` sem etapa de build. |

## 5. Requisitos não funcionais

| ID | Requisito | Alvo mensurável |
|---|---|---|
| **RNF-01** | **Performance**: render inicial e atualizações de filtro imperceptíveis. | Lista de 50 itens renderiza em < 100 ms; filtro/ordenação em < 50 ms no hardware médio; nenhum bloqueio de UI. |
| **RNF-02** | **Acessibilidade básica**: navegação completa por teclado (Tab/Enter/Espaço), foco visível, `aria-label` em controles, `aria-live` na contagem de resultados, contraste mínimo **WCAG AA (4.5:1)** em ambos os temas. | Teste manual de teclado + inspeção de contraste aprovados. |
| **RNF-03** | **Responsividade mobile-first**: layout utilizável de **320 px a 1440 px**, cards empilhados no mobile, filtros acessíveis (drawer/colapsável no mobile). | Sem scroll horizontal a 320 px; alvos de toque ≥ 44 px. |
| **RNF-04** | **Offline**: após servido localmente, funciona **sem internet**. Zero dependências de CDN, fontes externas ou npm install. | Desconectar rede → site continua funcional. |
| **RNF-05** | **Manutenção**: preço/efeito alterado alterando **somente o JSON**, sem editar HTML/JS. | Trocar 1 PO → 2 PO em `items.json` reflete ao recarregar. |
| **RNF-06** | **Compatibilidade**: últimas 2 versões de Chrome, Edge, Firefox e Safari. | Sem erros de console nessas versões. |
| **RNF-07** | **Segurança**: sem backend; renderização **escapa HTML** dos campos do JSON (prevenção a XSS via dados editados). | Item com `<script>` no nome exibe como texto. |
| **RNF-08** | **Resiliência a `localStorage` indisponível** (modo privado): o site deve funcionar sem persistir tema, sem quebrar. | Alternar tema em aba privada não gera erro. |
| **RNF-09** | **Falha de carregamento do JSON**: mensagem de erro amigável em caso de arquivo ausente/inválido. | Renomear o JSON → estado de erro legível, não tela branca. |

## 6. Modelo de dados e regras de negócio

### 6.1 Entidades

**Categoria** (enum fixa): `bebidas | refeicoes | pousada | pocoes | armas | armaduras`

**Item** (`data/items.json`):

```json
{
  "id": "pocao-cura-basica",
  "name": "Cura Básica",
  "category": "pocoes",
  "subcategory": null,
  "price": 10,
  "unit": null,
  "weightKg": null,
  "damage": null,
  "armorClass": null,
  "strengthReq": null,
  "effectText": "2d4+2",
  "tags": ["cura"]
}
```

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | string (slug) | ✅ | Único, estável |
| `name` | string | ✅ | Fiel à fonte |
| `category` | enum | ✅ | 6 categorias |
| `subcategory` | string \| null | ❌ | Armas: `simples/marciais/versateis`; Armaduras: `leves/medias/pesadas/escudo` |
| `price` | number ≥ 0 | ✅ | Inteiro em **PO** |
| `unit` | string \| null | ❌ | `"por noite"` apenas em Pousada |
| `weightKg` | number \| null | ❌ | Armas, armaduras, escudo |
| `damage` | string \| null | ❌ | Ex.: `"1d8"`, versáteis `"1d6/1d8"` |
| `armorClass` | string \| null | ❌ | Ex.: `"14 + Dex máx +2"` |
| `strengthReq` | number \| null | ❌ | Ex.: `13` (armaduras pesadas) |
| `effectText` | string \| null | ❌ | Texto fiel do efeito da fonte |
| `tags` | string[] | ✅ | `cura`, `bonus`, `malus`, `droga`, `restricao`, `descanso-curto`, `descanso-longo`, `atributo`, `slot-magia`… |

### 6.2 Regras de negócio

- **RB-01 — Moeda única PO.** Todo preço é exibido em **PO** (Peça de Ouro). Não há conversão para PP/PE/PC/PL porque **a fonte não informa outras moedas** — incluir conversão criaria dados inventados.
- **RB-02 — Pousada usa unidade "por noite".** Itens de Pousada exibem `X PO / noite` (badge `por noite`), diferenciando-se de compra única.
- **RB-03 — Armas** possuem sempre `damage` (dado de dano) + `weightKg` + subcategoria. Armas versáteis exibem os dois dados (`1d6/1d8`).
- **RB-04 — Armaduras e Escudo** possuem `armorClass`, `weightKg` e, se armadura pesada, `strengthReq` (FOR). O Escudo é subcategoria própria com `CA +2`.
- **RB-05 — Poções** possuem `effectText` fiel (ex.: `12d4+12`) e, quando houver, restrições em badges: `não acumulativo` (Elixir, Poção de Slot), `exige descanso antes de novo uso` (Poção de Slot), `cura total` (Elixir).
- **RB-06 — Duração de efeitos** usa as marcações da fonte como badges: `[Descanso Curto]` (Tônica dos Magos, Skooma) e `[Descanso Longo]` (implícito no Elixir: `+2 atributo … até descanso longo`).
- **RB-07 — Bônus positivos e negativos são distinguíveis**: positivos com `+` e cor de destaque de bônus; negativos com `−` e cor de alerta (Skooma: `+1 For/Dex/Con` vs `-1 Int/Sab/Car`).
- **RB-08 — Skooma permanece em Bebidas** (fidelidade à fonte) com tag adicional `droga` — a tag já comunica a natureza sem mover o item.
- **RB-09 — Efeito combinado múltiplo** (Cura Extraordinária: regeneração **OU** resistências) é preservado em texto único com `OU` destacado — não é dividido em itens separados.
- **RB-10 — Filtros são combinados por E (AND)**: busca ∩ faixa de preço ∩ categoria ∩ subcategoria. Ordenação não altera o conjunto, apenas a apresentação.
- **RB-11 — Desempate da ordenação**: empates por preço são ordenados por `name` crescente (determinístico e testável).
- **RB-12 — Fidelidade textual**: nomes e efeitos são transcritos exatamente como na fonte (decisão 4). Emotes do Discord são o **único** elemento transformado (→ emoji equivalente).

## 7. Contagem esperada de itens

| Categoria | Subcategoria | Itens |
|---|---|---|
| Bebidas | — | **12** (Copo de Leite, Suco de Fruta Fresca, Chá Gelado de Ervas, Cerveja Comum, Grog dos Piratas, Hidromel, Cidra da Terra dos Anões, Licor Fino, Caipirinha de Abrasil, Tônica dos Magos, Vinho de Boa Qualidade, Skooma) |
| Refeições | — | **6** (Simples, Básica, Completa, Boa Qualidade, Nobre, Luxuosa) |
| Pousada (por noite) | — | **5** (Simples, Confortável, Boa Qualidade, Nobre, Suíte Luxuosa) |
| Poções de Vida | — | **10** (Cura Menor, Básica, Comum, Aumentada, Potente, Suprema, Mágica, Extraordinária, Elixir da Vida, Poção de Recuperação Moderada de Slot de Magia) |
| Armas | Simples **2** + Marciais **4** + Versáteis **2** | **8** |
| Armaduras & Escudo | Leves **3** + Médias **2** + Pesadas **3** + Escudo **1** | **9** |
| **TOTAL** | | **50** |

✅ Conferência com a fonte (corrigida pelo Tech Lead — D-13): 12 + 6 + 5 + 10 + 8 + 9 = **50 itens**.
> **Nota (D-13):** a contagem original "52" desta Fase 1 estava errada — a fonte tem **4** armas marciais (1d8, 1d10, 1d12, 2d6) e **2** armaduras médias (Escamas, Cota de Malha). Fidelidade à fonte (RB-12) prevalece: inventar itens seria dado falso.

## 8. User Stories (com critérios de aceitação)

### US-01 — Navegar por categoria e subcategoria
> **Como** jogador, **quero** ver os itens separados por categoria **para** achar rapidamente o que preciso.

- **GIVEN** o site está aberto com todos os filtros no padrão
- **WHEN** eu seleciono a categoria "Armas"
- **THEN** são exibidos 8 itens de armas, agrupados em "Simples", "Marciais" e "Versáteis"
- **AND** a contagem exibe "8 itens encontrados"

### US-02 — Buscar item por nome
> **Como** mestre, **quero** digitar o nome do item **para** não percorrer a lista inteira.

- **GIVEN** o campo de busca está vazio
- **WHEN** eu digito "skooma"
- **THEN** apenas o item "Skooma" é exibido e a contagem mostra "1 item encontrado"
- **AND** a busca ignora maiúsculas e acentos (digitar "pocao" encontra "Poção")

### US-03 — Filtrar por faixa de preço
> **Como** jogador, **quero** definir preço mínimo e máximo **para** achar itens orçamento da minha party.

- **GIVEN** a categoria é "Todas" e a faixa está vazia
- **WHEN** eu informo mínimo = 10 e máximo = 20
- **THEN** apenas itens com `10 ≤ preço ≤ 20` são exibidos (inclui Cura Básica 10, Skooma 20, Cura Aumentada 20…)
- **AND** a contagem de resultados é atualizada
- **GIVEN** mínimo > máximo
- **THEN** é exibido estado vazio com aviso e o botão "Limpar filtros" restaura tudo

### US-04 — Ordenar por preço e por nome
> **Como** mestre, **quero** ordenar os itens do mais barato ao mais caro **para** montar encontros por orçamento.

- **GIVEN** os filtros atuais retornam N itens
- **WHEN** eu seleciono ordenação "Preço ↑"
- **THEN** o primeiro item é o de menor preço e o último o de maior preço
- **AND** itens com mesmo preço são ordenados por nome (A→Z)
- **WHEN** eu seleciono "Nome ↓"
- **THEN** a lista reordena sem alterar a contagem

### US-05 — Alternar modo escuro persistido
> **Como** jogador em sessão noturna, **quero** ativar o modo escuro **para** não ofuscar a mesa.

- **GIVEN** o tema atual é claro e o site é carregado pela primeira vez
- **WHEN** eu clico no botão de tema
- **THEN** o tema muda para escuro imediatamente
- **WHEN** eu recarrego a página
- **THEN** o tema escuro permanece ativo (localStorage)
- **GIVEN** o navegador está em modo privado sem localStorage
- **THEN** o site continua funcionando, apenas sem persistir o tema (RNF-08)

### US-06 — Entender efeitos e atributos pelas badges
> **Como** jogador, **quero** ver cura, CA, peso, requisito e bônus em badges **para** comparar itens sem ler texto corrido.

- **GIVEN** eu visualizo a categoria "Poções de Vida"
- **THEN** cada poção exibe badge de cura (ex.: `4d4+4`) e restrições quando existirem (`não acumulativo`, `exige descanso antes de novo uso`)
- **GIVEN** eu visualizo "Skooma"
- **THEN** os bônus positivos (`+1 For/Dex/Con`) e negativos (`-1 Int/Sab/Car`) têm distinção visual
- **GIVEN** eu visualizo "Placas"
- **THEN** aparecem badges `CA 18`, `FOR 15` e `50 kg`

### US-07 — Ver contagem e sair do estado vazio
> **Como** usuário, **quero** saber quantos itens encontraram **para** saber se meu filtro funcionou.

- **GIVEN** eu aplico um filtro que não retorna resultados (ex.: busca "xyz")
- **THEN** é exibida mensagem "Nenhum item encontrado" com botão "Limpar filtros"
- **WHEN** eu clico em "Limpar filtros"
- **THEN** busca, faixa e categorias voltam ao padrão e os 50 itens são exibidos

### US-08 — Manter o catálogo atualizado pelo JSON *(Should)*
> **Como** mantenedor, **quero** editar preços e efeitos em JSON **para** atualizar sem tocar no código.

- **GIVEN** o arquivo `data/items.json` está válido
- **WHEN** eu altero o preço de "Hidromel" de 3 para 4 PO e recarrego
- **THEN** o novo preço aparece e a ordenação respeita o valor atualizado
- **GIVEN** o JSON está com erro de sintaxe
- **THEN** o site exibe estado de erro amigável, não tela branca (RNF-09)

## 9. Fluxos principais

**Fluxo 1 — Consulta por categoria**
1. Usuário abre o site (servidor local) → 50 itens renderizados, categoria "Todas", ordenação padrão.
2. Seleciona "Armaduras" → vê subcategorias Leves/Médias/Pesadas/Escudo.
3. Seleciona "Pesadas" → vê 3 itens com badges CA, FOR e peso.
4. Contagem mostra "3 itens encontrados".

**Fluxo 2 — Busca + faixa combinadas**
1. Digita "cura" na busca → lista reduz para poções de cura.
2. Define máx = 20 → resta Cura Menor (5), Básica (10), Comum (15), Aumentada (20).
3. Limpa a faixa → volta a mostrar todas as "cura" acima de 20.

**Fluxo 3 — Ordenação**
1. Categoria "Bebidas", ordena por preço ↑ → Copo de Leite (1) primeiro, Skooma (20) último.
2. Inverte para ↓ → ordem espelhada; contagem inalterada.

**Fluxo 4 — Modo escuro**
1. Clica no ícone de tema → UI muda para escuro, ícone indica estado atual.
2. Recarrega → tema mantido.
3. Dispositivo sem storage → tema volta ao padrão sem erro.

**Fluxo 5 — Estado vazio**
1. Combina busca impossível + faixa estreita → mensagem de vazio + "Limpar filtros".
2. Clica em limpar → estado inicial restaurado.

**Fluxo 6 — Manutenção de dados**
1. Mantenedor edita `data/items.json` (preço/novo item).
2. Recarrega o site → item refletido com filtros, contagem e badges corretos.
3. JSON inválido → estado de erro amigável.

## 10. Prioridades (MoSCoW)

### Must (MVP — sem isso o produto não entrega valor)
- Exibir os 50 itens fiéis à fonte em JSON (RF-13, RF-14).
- Categorias e subcategorias (RF-01, RF-02).
- Busca por nome (RF-03) e faixa de preço (RF-04).
- Ordenação por preço e nome (RF-05).
- Filtros por categoria/subcategoria (RF-06).
- Modo escuro persistido (RF-07).
- Badges de efeitos/atributos, incluindo bônus negativos (RF-08, RF-09).
- Contagem de resultados e estado vazio com limpar filtros (RF-10, RF-11).
- Servidor local com um comando (RF-15) e offline sem dependências (RNF-04).
- Responsividade mobile-first e acessibilidade básica (RNF-02, RNF-03).

### Should
- Persistência de filtros/busca/ordenação no reload (RF-12).
- Debounce otimista na busca e estado de erro de JSON (RNF-09).
- Agrupamento visual por subcategoria com cabeçalhos colapsáveis.

### Could
- Contador por subcategoria no menu lateral.
- Destaque do item mais caro/barato da categoria atual.
- Atalho de teclado para focar a busca (`/`).
- Página "sobre a fonte"/créditos.

### Won't (neste ciclo)
- Carrinho, pagamento, login, API, banco de dados, IA (escopo Out).
- Comparador de itens (decisão explícita do usuário).
- Conversão de moedas PP/PE/PC/PL (RB-01).
- Deploy em GitHub Pages (decisão 3 — sem bloquear futuro).

## 11. Riscos, ambiguidades e suposições

| # | Risco / ambiguidade | Resolução / suposição |
|---|---|---|
| 1 | **Skooma é listada em Bebidas**, mas é uma droga com efeito negativo. | Manter em **Bebidas** com tag `droga` (fidelidade à fonte + tag comunica). Se o usuário preferir mover para categoria própria, é mudança de 1 campo no JSON. |
| 2 | **"Caipirinha de Abrasil"** — erro de digitação ("Abrasil" vs "Brasil"). | **Sugestão: manter "Abrasil"** — a decisão 4 determina transcrição fiel dos textos; corrigir criaria divergência com a fonte do Discord. *Se o usuário aprovar correção, alterar nome mantendo o restante fiel.* |
| 3 | **Armas não têm nome na fonte** — só dado de dano, peso e preço (ex.: "1d4 → 2 PO (2kg)"). | **Suposição:** nome derivado previsível: `Arma Simples 1d4`, `Arma Marcial 1d12`, `Arma Versátil 1d6/1d8`, etc. Não inventar nomes temáticos (adaga, espada…) que seriam dados falsos. *Confirmar com o Tech Lead.* |
| 4 | Emotes do Discord (`:AstolfoKawaii:`, `:Vodka:`, `:Chazin:`…) → emojis. | **Suposição:** mapear por similaridade semântica (ex.: `:Vodka:` → 🍸, `:Chazin:` → 🧀, `:AstolfoKawaii:` → 🌸) e **registrar o mapeamento num `docs/EMOTES.md`** para rastreabilidade. Nenhum `:emote:` pode sobrar (RF-14). |
| 5 | Filtro de categoria: seleção única ou múltipla? | **Suposição:** seleção única + opção "Todas" (padrão). Multisseleção aumenta complexidade de UI sem valor claro para 6 categorias. |
| 6 | Busca ignora acentos? | **Suposição:** sim (normalização Unicode/NFD). Usuário do Discord digita sem acento com frequência. |
| 7 | Faixa de preço com mín > máx, valores negativos ou não numéricos. | **Suposição:** entradas inválidas são ignoradas/validadas (mín ≤ máx por validação); mín > máx → estado vazio + aviso; negativos não são aceitos. Testável em US-03. |
| 8 | Persistir filtros (não só o tema)? | **Should**, não Must. Tema é Must (decisão do usuário); filtros são ambíguos — suposição: não persistir no MVP para evitar estado "fantasma" confuso. |
| 9 | "Tônica dos Magos +1 concentração/percepção" — interpretar como bônus? | **Suposição:** sim, badge `+1 concentração/percepção` com duração `[Descanso Curto]`. Texto original preservado em `effectText`. |
| 10 | Elixir: efeitos múltiplos com alternativa (`OU`). | **Suposição:** `effectText` com texto completo e tags `cura`, `atributo`, `restricao`, `descanso-longo`. Não separar em itens distintos (RB-09). |
| 11 | Contraste em modo escuro e badges coloridos (verde/vermelho). | Riscos de acessibilidade: exigir WCAG AA nos dois temas (RNF-02); sinalizar também com `+`/`−` (não só cor) — não depender apenas de cor. |
| 12 | JSON editado manualmente pode ficar inválido. | Estado de erro amigável (RNF-09) + `docs` com exemplo de item. |
| 13 | Comando de servidor local: `python -m http.server` vs `npx serve`. | **Suposição:** documentar **ambos** no README; nenhum depende de build/npm install no fluxo principal (npx baixa sob demanda). |
| 14 | Pousada "por noite" pode ser confundido com preço único. | Badge `por noite` obrigatório nos 5 itens de Pousada (RB-02). |
