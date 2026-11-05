# DATA.md — guia de manutenção de `data/items.json`

> **Projeto:** lojinha-de-precos
> **Tarefa:** T-03 — doc de manutenção do mantenedor (**RF-13** — dados fiéis em JSON · **RNF-05** — edição só no JSON)
> **Responsável:** Senior Database Engineer (Data)
> **Fontes normativas:** [`ARCHITECTURE.md`](ARCHITECTURE.md) §5 (contrato de dados, decisões D-*) · [`REQUIREMENTS.md`](REQUIREMENTS.md) §6 (regras de negócio RB-*) · [`EMOTES.md`](EMOTES.md) (RF-14)
> **Público:** mantenedor do catálogo — quem edita preço, efeito ou adiciona item.

---

## 1. Visão geral — a fonte de verdade

**`data/items.json` é a fonte de verdade de todo o catálogo.** O site não tem banco de dados,
nem API, nem conteúdo embutido no HTML: no boot ele faz `fetch("data/items.json")` e pinta a
lista com o que encontrar no arquivo.

- **Editar dados NUNCA exige tocar em código.** Preço, efeito, nome, peso, CA, tags — tudo é
  dado. HTML/CSS/JS (`index.html`, `css/`, `js/`) ficam fora do fluxo de manutenção (RNF-05).
- **Recarregar o site aplica a alteração.** O servidor local lê o arquivo a cada requisição —
  basta salvar o JSON e dar F5 em `http://localhost:8000` (não é preciso reiniciar o servidor).
  Se o navegador servir uma cópia do cache, use um reload forçado (ex.: `Ctrl+F5`).
- **Fluxo completo de manutenção (3 passos):**

```
1. editar data/items.json
2. rodar o validador     →  py scripts/validate_data.py   (exit 0 = pode commitar)
3. recarregar o site     →  F5 em http://localhost:8000
```

> Este doc cobre *o que* e *como* editar. Requisitos e arquitetura (por que o desenho é assim)
> vivem em `REQUIREMENTS.md` §6 e `ARCHITECTURE.md` §5.

---

## 2. Envelope — `{ "version": 1, "items": [...] }`

O arquivo **não** é uma lista de itens; é um objeto com dois campos:

```json
{
  "version": 1,
  "items": [ { "...": "Item" }, { "...": "Item" } ]
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `version` | inteiro, hoje sempre `1` | ✅ | Versão do schema do item. |
| `items` | array de `Item` (não vazio) | ✅ | O catálogo. |

**Por que é versionado (decisão D-3):**

1. validador e front podem **recusar versões desconhecidas com mensagem clara** em vez de
   falhar de forma obscura;
2. permite **migração futura de schema** sem ambiguidade ("é uma lista?" × "é um objeto?");
3. o custo é zero — um nível de aninhamento.

**Implicações práticas:**

- o front lê `data.items` (não `items` no topo) e checa `version === 1` → versão diferente
  cai no estado de erro `SCHEMA` (ver Seção 8);
- **não renomeie nem remova `version`**, e não mude seu valor sem decisão do Tech Lead
  (mudar o schema do `Item` é uma nova versão + migração, não um ajuste de dado).

---

## 3. Schema completo do `Item`

### 3.1 Campos (ARCHITECTURE §5.2)

Schema **fechado**: os campos abaixo são *todos* que existem. Campo extra é **erro** do
validador. Os opcionais podem ser escritos explicitamente como `null` (padrão do arquivo atual)
ou omitidos — para o validador e o front, ausente == `null`; **recomenda-se sempre escrever
todos**, como o arquivo já faz, para leitura e diff mais fáceis.

| Campo | Tipo | Obrig. | Exemplo | Descrição |
|---|---|---|---|---|
| `id` | string slug, **única e estável** | ✅ | `"pocao-cura-basica"` | Chave do item no render. Formato exigido: `^[a-z0-9]+(-[a-z0-9]+)*$` (minúsculas, dígitos e hífens). |
| `name` | string não vazia | ✅ | `"Cura Básica"` | Nome fiel à fonte. **Sem `<` nem `>`** — dado nunca vira HTML (ARCHITECTURE §9). |
| `category` | enum (Seção 3.5) | ✅ | `"pocoes"` | Uma das 6 categorias. |
| `subcategory` | enum (Seção 3.5) \| `null` | ❌ | `"marciais"` | **Obrigatória (não `null`) apenas em `armas` e `armaduras`**; nas demais categorias é `null`. |
| `price` | inteiro ≥ 0 | ✅ | `10` | Preço em **PO** — moeda única (RB-01). Não aceita string, float nem booleano. |
| `unit` | `"por noite"` \| `null` | ❌ | `"por noite"` | **Obrigatório em `pousada`, proibido fora dela** (RB-02). |
| `weightKg` | number \| `null` | ❌ | `46` | Peso em kg. **Obrigatório em armas, armaduras e escudo.** |
| `damage` | string \| `null` | ❌ | `"1d6/1d8"` | Dado de dano. **Obrigatório em armas** (RB-03); versáteis usam formato `"X/Y"` (ex.: `"1d6/1d8"`). |
| `armorClass` | string \| `null` | ❌ | `"14 + Destreza (máximo +2)"` | CA. **Obrigatório em armaduras e escudo** (RB-04); escudo = `"+2"`. |
| `strengthReq` | inteiro \| `null` | ❌ | `15` | Requisito de FOR. **Só em subcategoria `pesadas`** e exige `armorClass` preenchido. |
| `effectText` | string \| `null` | ❌ | `"Recupera 2d4+2 pontos de vida. …"` | **Texto integral do card** (D-15): descrição + efeito fiel da fonte. `null` **apenas** em armas/armaduras (cujo atributo vive em `damage`/`armorClass`). |
| `modifiers` | array de `{ "value": int ≠ 0, "label": str }` | ❌ (default `[]`) | `[{"value": 1, "label": "For/Dex/Con"}]` | Badges de efeito tipadas (D-6, RF-09): `value > 0` → badge verde com `+`; `value < 0` → badge vermelha com `−`. `label` não pode ser vazio. |
| `restrictions` | array de strings não vazias | ❌ (default `[]`) | `["não acumulativo", "cura total"]` | Textos de badge de restrição (RB-05). |
| `tags` | array de strings (conjunto Seção 3.4) | ✅ — **o campo**, não o conteúdo | `["cura"]` | Metadados de classificação e derivação de badges (D-6). **A lista pode ser vazia** (`[]`): 37 dos 50 itens atuais não têm tags. |

**Coerência exigida entre `modifiers` e `tags` (regra 14 do validador):**

- `modifiers` com algum `value > 0` → exige a tag **`bonus`**;
- `modifiers` com algum `value < 0` → exige a tag **`malus`**.

A relação é unidirecional: ter `bonus` sem `modifiers` é permitido (ex.:
`pocao-cura-magica` tem `["cura", "bonus"]` e `modifiers: []`).

### 3.2 Exemplo de referência — `skooma`

```json
{
  "id": "skooma",
  "name": "Skooma",
  "category": "bebidas",
  "subcategory": null,
  "price": 20,
  "unit": null,
  "weightKg": null,
  "damage": null,
  "armorClass": null,
  "strengthReq": null,
  "effectText": "… (+1 testes For, Dex, Con, -1 Int, Sab, Car) [Descanso Curto].",
  "modifiers": [
    { "value": 1,  "label": "For/Dex/Con" },
    { "value": -1, "label": "Int/Sab/Car" }
  ],
  "restrictions": [],
  "tags": ["droga", "bonus", "malus", "descanso-curto"]
}
```

### 3.3 `restrictions` × `tags`

`restrictions` guarda o **texto exibido** (fiel à fonte); a tag **`restricao`** marca que o item
*tem* restrição. Exemplos reais do catálogo:

| Item | `restrictions` | `tags` relacionadas |
|---|---|---|
| `elixir-da-vida` | `["não acumulativo", "cura total"]` | `restricao` |
| `pocao-recuperacao-moderada-de-slot-de-magia` | `["não acumulativo", "exige descanso antes de novo uso"]` | `restricao`, `slot-magia` |

### 3.4 Tags válidas e significados (ARCHITECTURE §5.3)

Conjunto **fechado** — o validador **rejeita** qualquer tag fora desta lista:

| Tag | Significado | Onde aparece (exemplos reais) |
|---|---|---|
| `cura` | O item recupera pontos de vida; o valor vive no `effectText` (ver D-19, Seção 7). | 8 poções de cura + `caipirinha-de-abrasil` + `elixir-da-vida` (10 usos) |
| `bonus` | Bônus/efeito **positivo** (badge verde, sinal `+`). | `tonica-dos-magos`, `skooma`, `elixir-da-vida`, `pocao-cura-magica`, `pocao-cura-extraordinaria` |
| `malus` | Efeito **negativo** (badge vermelha, sinal `−`). Obrigatória quando há `modifiers` negativos. | `skooma` |
| `droga` | Natureza de droga do item — mantém o item na categoria da fonte sem confundir o leitor (RB-08). | `skooma` |
| `restricao` | O item tem uso restrito (o texto está em `restrictions`). | `elixir-da-vida`, `pocao-recuperacao-moderada-de-slot-de-magia` |
| `descanso-curto` | Duração até o **descanso curto** → deriva a badge `[Descanso Curto]` (RB-06). | `tonica-dos-magos`, `skooma` |
| `descanso-longo` | Duração até o **descanso longo** → deriva a badge `[Descanso Longo]`. | `elixir-da-vida` |
| `atributo` | Modifica um **atributo** (texto do efeito em `effectText`). | `elixir-da-vida` |
| `slot-magia` | Recupera **slot de magia**. | `pocao-recuperacao-moderada-de-slot-de-magia` |

> Badges de duração são **derivadas da tag**, nunca de texto livre (§5.3): se o `effectText`
> menciona `[Descanso Curto]`, o item **deve** ter a tag `descanso-curto` (o validador avisa).

### 3.5 Enums de categoria e subcategoria (ARCHITECTURE §5.3)

**Categorias** (chave → label; ordem fixa = ordem de exibição no modo agrupado):

| Chave | Label PT-BR | Itens hoje |
|---|---|---|
| `bebidas` | Bebidas | 12 |
| `refeicoes` | Refeições | 6 |
| `pousada` | Pousada | 5 |
| `pocoes` | Poções de Vida | 10 |
| `armas` | Armas | 8 |
| `armaduras` | Armaduras & Escudo | 9 |

**Subcategorias:**

| Chave | Label PT-BR | Pertence a | Itens hoje |
|---|---|---|---|
| `simples` | Simples | `armas` | 2 |
| `marciais` | Marciais | `armas` | 4 |
| `versateis` | Versáteis | `armas` | 2 |
| `leves` | Leves | `armaduras` | 3 |
| `medias` | Médias | `armaduras` | 2 |
| `pesadas` | Pesadas | `armaduras` | 3 |
| `escudo` | Escudo | `armaduras` | 1 |

Regras de coerência (erro do validador):

- `armas` → `subcategory` **obrigatoriamente** ∈ `simples` / `marciais` / `versateis`;
- `armaduras` → `subcategory` **obrigatoriamente** ∈ `leves` / `medias` / `pesadas` / `escudo`;
- qualquer outra categoria → `subcategory` **obrigatoriamente** `null`.

As chaves são **ASCII minúsculo sem acento** (`marciais`, `medias`); os labels PT-BR moram em
`js/utils.js` (`CATEGORY_LABELS`, `SUBCATEGORY_LABELS`) — trocar um label é mudar 1 linha lá,
nunca no JSON (D-9).

---

## 4. Como adicionar um item (passo a passo)

### Passos

1. **Descubra a categoria e a subcategoria certas** na Seção 3.5 (só `armas` e `armaduras`
   têm subcategoria).
2. **Gere um `id` slug único** — minúsculo, hifenado, sem acento e **sem colisão** com os
   existentes (confira no arquivo ou com um grep no `id` atual).
3. **Monte o objeto com TODOS os campos** da Seção 3.1 (use `null` no que não se aplica;
   `tags` é obrigatório — pode ser `[]`).
4. **Preencha os campos de domínio da categoria:** `unit` só na pousada; `damage` + `weightKg`
   nas armas; `armorClass` + `weightKg` nas armaduras/escudo; `strengthReq` só em pesadas.
5. **Transcreva `effectText` fielmente da fonte** (RB-12/D-15) — descrição e efeito inteiros.
6. **Estruture o efeito:** `modifiers` para bônus positivos/negativos (com tags `bonus`/`malus`
   coerentes) e `restrictions` para limites de uso (com tag `restricao`).
7. **Emotes do Discord → emoji** equivalente e registre o mapeamento em
   [`EMOTES.md`](EMOTES.md) para rastreabilidade (RF-14).
8. **Valide** (Seção 6) e **recarregue** o site.

### Exemplo completo — item real do catálogo (`elixir-da-vida`, uma poção)

```json
{
  "id": "elixir-da-vida",
  "name": "Elixir da Vida",
  "category": "pocoes",
  "subcategory": null,
  "price": 100,
  "unit": null,
  "weightKg": null,
  "damage": null,
  "armorClass": null,
  "strengthReq": null,
  "effectText": "Recupera todos os pontos de vida perdidos e fornece efeitos benéficos duradouros, como regeneração acelerada (+2d4 por hora durante 2d4 horas) e um aumento de +2 em um atributo de sua escolha (até descanso longo). Não é acumulativo.",
  "modifiers": [
    { "value": 2, "label": "atributo à escolha" }
  ],
  "restrictions": ["não acumulativo", "cura total"],
  "tags": ["cura", "atributo", "bonus", "restricao", "descanso-longo"]
}
```

**Variação por categoria** (o que muda em relação ao exemplo):

| Categoria | `subcategory` | `unit` | Campos obrigatórios de domínio | `effectText` |
|---|---|---|---|---|
| `bebidas`, `refeicoes`, `pocoes` | `null` | `null` | — | texto fiel da fonte |
| `pousada` | `null` | **`"por noite"`** | — | texto fiel da fonte |
| `armas` | `simples`/`marciais`/`versateis` | `null` | **`damage`** + **`weightKg`** | `null` |
| `armaduras` | `leves`/`medias`/`pesadas`/`escudo` | `null` | **`armorClass`** + **`weightKg`** (`strengthReq` só em `pesadas`) | `null` |

### Checklist antes de commitar

- [ ] `id` em formato slug (`^[a-z0-9]+(-[a-z0-9]+)*$`) e **único** no catálogo
- [ ] `category` ∈ enum da Seção 3.5 e `subcategory` **coerente com a categoria**
      (só armas/armaduras; senão `null`)
- [ ] `unit: "por noite"` **apenas** em `pousada` (e presente em todo item de pousada)
- [ ] armas com `damage` + `weightKg`; armaduras/escudo com `armorClass` + `weightKg`;
      `strengthReq` só em `pesadas` (e com `armorClass`)
- [ ] `price` é inteiro ≥ 0
- [ ] `effectText` fiel à fonte (D-15) — `null` só em armas/armaduras
- [ ] `modifiers` com `value` inteiro ≠ 0 e tags **`bonus`** (positivo) / **`malus`** (negativo) coerentes
- [ ] `restrictions` preenchidas quando a fonte exige (RB-05) + tag `restricao`
- [ ] `tags` somente do conjunto da Seção 3.4; campo `tags` presente (pode ser `[]`)
- [ ] `name` **sem `<`/`>`** e **sem `:emote:`** — emote virou emoji e foi registrado em `EMOTES.md`
- [ ] nenhum campo extra fora do schema fechado (Seção 3.1)
- [ ] `py scripts/validate_data.py` termina com **exit 0**
- [ ] contagem por categoria conferida (Seção 9)

---

## 5. Como alterar preço ou efeito (o caso mais comum)

1. **Uma linha só:** abra `data/items.json` e troque o valor — ex.: `"price": 3` →
   `"price": 4` (Hidromel), ou edite o trecho do `effectText` desejado.
2. **Valide:** `py scripts/validate_data.py` (ver Seção 6).
3. **Recarregue** `http://localhost:8000` — o preço/efeito novo aparece, e a ordenação e a
   contagem se ajustam sozinhas (RNF-05, US-08).

Nada de HTML/JS precisa ser tocado — e **não deve** ser: dado é dado (RB-12/RNF-05).

---

## 6. Validação obrigatória antes de commitar

**Rode UM comando, na raiz do repositório, antes de commitar qualquer mudança em `data/`:**

```bash
# Windows (PowerShell/CMD)
py scripts/validate_data.py

# macOS / Linux (e Windows com `python` no PATH)
python scripts/validate_data.py
python3 scripts/validate_data.py   # distros onde `python` é Python 2 (ou inexistente)
```

**Saída esperada (catálogo íntegro):**

```
OK: 50 itens validados, 0 erros, 0 avisos.
```

| Exit code | Significado |
|---|---|
| `0` | Catálogo **válido** — pode commitar. Avisos (`AVISO:`) são informativos e não bloqueiam. |
| `1` | **Erros** (`ERRO:`) — **não commitar** até corrigir. O script lista **todos** os erros (não para no primeiro) e fecha com `ERRO: N erro(s) encontrado(s).` |

### Erros × avisos — resumo das regras 1–17

**ERRO = bloqueia o commit (exit 1). AVISO = informativo (exit 0).**

| # | Regra | Nível |
|---|---|---|
| 1 | Arquivo existe, é UTF-8 válido e é JSON parseável (informa **linha e coluna** do erro) | ERRO |
| 2 | Envelope `{version: 1, items: [não vazio]}` (D-3) | ERRO |
| 3 | Campos obrigatórios presentes (`id`, `name`, `category`, `price`, `tags`) e com tipos corretos | ERRO |
| 4 | `id` em formato slug e **único** no catálogo | ERRO |
| 5 | `category` dentro do enum de 6 | ERRO |
| 6 | `subcategory` ∈ enum ou `null`, **coerente com a categoria** | ERRO |
| 7 | `price` inteiro ≥ 0 (não bool, não string, não float) | ERRO |
| 8 | Tipos dos opcionais: `unit`, `weightKg`, `damage`, `armorClass`, `strengthReq`, `effectText`, `modifiers` (`{value: int ≠ 0, label: str}`), `restrictions` (strings não vazias) | ERRO |
| 9 | **Schema fechado**: nenhum campo fora da Seção 3.1 | ERRO |
| 10 | `tags` = array de strings não vazias do conjunto da Seção 3.4 | ERRO |
| 11 | Nenhum emote Discord residual (`:token:`) em **nenhuma** string do arquivo (RF-14) | ERRO |
| 12 | Regras de domínio: RB-02 (`unit` × pousada), RB-03 (armas com dano+peso), RB-04 (armaduras/escudo com CA+peso; `strengthReq` só em `pesadas` e exige `armorClass`) | ERRO |
| 13 | `name` não vazio e **sem `<`/`>`** (dado nunca vira HTML — §9) | ERRO |
| 14 | Coerência `modifiers` × `tags` (positivo exige `bonus`, negativo exige `malus`); *e* aviso de `effectText` com `[Descanso …]` sem a tag `descanso-curto`/`descanso-longo` | ERRO (coerência) · AVISO (descanso) |
| 15 | Contagem por categoria diferente de 12/6/5/10/8/9 ou total diferente de 50 (D-13) | AVISO |
| 16 | Tag documentada (Seção 3.4) **nunca usada** em nenhum item | AVISO |
| 17 | `price == 0` (permitido, mas incomum) | AVISO |

Avisos **nunca bloqueiam** o commit — são sinais de revisão: contagem inesperada (15),
tag documentada sem uso (16), preço 0 (17) e `[Descanso …]` sem a tag de duração (14).
Detalhe dos desvios de contagem na Seção 9.

O script é **stdlib puro** (sem `pip install`): `json`, `re`, `pathlib`, `sys`, `argparse`
(decisão h da ARCHITECTURE §3). Ele aceita caminho alternativo:
`py scripts/validate_data.py outro/arquivo.json` (útil para testar um item novo antes de colar
no catálogo).

> **Resumo erros × avisos:** `ERRO:` = bloqueia o commit (exit 1) — regras 1–14
> (arquivo/envelope/schema/enums/domínio/emotes). `AVISO:` = informativo (exit 0) —
> regras 14 (descanso sem tag), 15 (contagem), 16 (tag sem uso) e 17 (preço 0).

---

## 7. Regras de negócio do dado (RB-01…RB-12) e decisões relevantes

### 7.1 Regras de negócio (REQUIREMENTS §6.2)

| RB | Regra | Efeito no JSON |
|---|---|---|
| **RB-01** | **Moeda única PO.** Sem conversão PP/PE/PC/PL — a fonte não informa outras moedas. | `price` inteiro em PO; nunca texto com moeda. |
| **RB-02** | **Pousada usa "por noite".** | Todo item `pousada` tem `unit: "por noite"` (obrigatório); mais nada tem. |
| **RB-03** | **Armas** têm sempre dano + peso + subcategoria; versáteis exibem os dois dados. | `damage` (`"1d8"`, `"1d6/1d8"`) + `weightKg` obrigatórios; `subcategory` obrigatória. |
| **RB-04** | **Armaduras e Escudo** têm CA + peso; pesadas têm requisito de FOR; escudo é subcategoria própria com `CA +2`. | `armorClass` + `weightKg` obrigatórios; `strengthReq` só em `pesadas`. |
| **RB-05** | **Poções** têm `effectText` fiel e restrições em badges. | `restrictions` com os textos exatos (`não acumulativo`, `exige descanso antes de novo uso`, `cura total`) + tag `restricao`. |
| **RB-06** | **Duração** usa as marcações da fonte como badges. | Tags `descanso-curto` / `descanso-longo` derivam as badges `[Descanso Curto]` / `[Descanso Longo]`. |
| **RB-07** | **Bônus positivos e negativos distinguíveis.** | `modifiers` com `value` sinalizado + tags `bonus`/`malus` → badge verde `+` × vermelha `−`. |
| **RB-08** | **Skooma permanece em Bebidas** (fidelidade), com tag `droga`. | `category: "bebidas"` + `tags` contendo `droga`. |
| **RB-09** | **Efeito combinado múltiplo** (Cura Extraordinária: regeneração **OU** resistências) fica em texto único. | Não dividir em itens separados; `OU` preservado no `effectText`. |
| **RB-10** | **Filtros combinados por E (AND).** | Não afeta o JSON; garante que busca+faixa+categoria se intersectam. |
| **RB-11** | **Desempate determinístico** da ordenação (preço → `name`; nome → `id`). | Não afeta o JSON; exige `name`/`id` sempre presentes. |
| **RB-12** | **Fidelidade textual:** nomes e efeitos exatamente como na fonte. **Emotes são o único elemento transformado.** | Nunca inventar/reescrever texto; `:emote:` → emoji e registro em `EMOTES.md`. |

### 7.2 Decisões que orientam a edição

| Decisão | Conteúdo | Na prática |
|---|---|---|
| **D-13** | O catálogo oficial tem **50 itens**: Bebidas 12, Refeições 6, Pousada 5, Poções 10, Armas 8, Armaduras & Escudo 9. | O validador compara com esses números e **avisa** (não bloqueia) em desvio (Seção 9). Inventar itens para "fechar a conta" seria dado falso. |
| **D-15** | `effectText` é o **texto descritivo completo do card** (descrição + efeito fiéis); `null` apenas em armas/armaduras. | Não descartar descrições da fonte — seria perda silenciosa de dados (RB-12/RF-13). |
| **D-11** | **Nomes de armas são derivados**: `Arma Simples 1d4`, `Arma Marcial 1d8`, `Arma Versátil 1d6/1d8` etc. | A fonte não traz nomes temáticos; **não inventar** "Adaga"/"Espada Longa" — seria dado falso. |
| **D-12** | **"Caipirinha de Abrasil"** mantido (typo da fonte). | Não "corrigir" para "Brasil" — alteração de conteúdo não solicitada. Corrigir é 1 linha, só se o usuário pedir. |
| **D-19** | **Não há badge de cura.** O valor da cura (ex.: `1d4+1`, `4d4+4`) vive no **`effectText`** (texto do card); a tag `cura` é **metadado** de classificação e não gera badge própria. | Ao editar poções, atualize `effectText`; não crie campo de cura nem espere badge separada. |

---

## 8. Arquivo JSON inválido — o que acontece e como corrigir

### 8.1 O que acontece no site (estado de erro — RNF-09)

O carregamento (ARCHITECTURE §2.1) mapeia cada falha para um código de erro e pinta um
**estado de erro amigável — nunca uma tela branca**:

| Situação | Código | Causa típica |
|---|---|---|
| Arquivo ausente/renomeado | `NOT_FOUND` | Renomeou/moveu o `items.json` |
| Servidor parado ou falha de fetch | `NETWORK` | Esqueceu de subir o servidor local |
| `JSON.parse` falhou | `PARSE` | Vírgula, aspa ou chave/colchete errado |
| JSON válido, envelope errado | `SCHEMA` | Sem `version`, `version ≠ 1`, sem `items` ou `items` não é array |

Comportamento especificado (implementação em `js/app.js` + `js/render.js`): mensagem em PT-BR
na região principal + botão **"Tentar novamente"** (reexecuta o carregamento); o detalhe técnico
vai para o `console.error`. Se a página foi aberta via `file://` (duplo clique no `index.html`),
o site detecta e orienta a usar o servidor local (D-2).

### 8.2 Como corrigir

1. **Rode o validador** — ele informa **linha e coluna** exatas do erro de sintaxe:

   ```
   ERRO: JSON inválido em data/items.json (linha 42, coluna 7): Expecting ',' delimiter
   ERRO: 1 erro(s) encontrado(s).
   ```

2. **Abra o arquivo na linha indicada** e corrija. O console do navegador também aponta a
   posição do erro, mas o validador é a referência (roda sem servidor).
3. **Erros mais comuns em edição manual:**
   - vírgula **sobrando** antes de `}`/`]` ou **faltando** entre objetos;
   - aspas tipográficas `“ ” ‘ ’` no lugar de aspas retas `"`;
   - comentários `//` ou `/* … */` — **JSON não aceita comentários**;
   - chave/colchete esquecido de fechar;
   - quebra de linha literal **dentro** de uma string (strings só aceitam `\n` escapado).
4. **Salve em UTF-8.**
5. Rode o validador de novo até `exit 0` e recarregue o site.
6. **Atenção silenciosa:** chaves duplicadas num mesmo objeto são aceitas pelo parser
   (prevalece a última) e **não geram erro** — evite duplicar campos.

> Se o erro for `SCHEMA` (não `PARSE`), o JSON está sintaticamente ok — revise o envelope
> (Seção 2): `version` deve ser o inteiro `1` e `items` deve ser um array não vazio.

---

## 9. Contagens esperadas do catálogo (D-13)

| Categoria | Subcategorias | Itens esperados |
|---|---|---|
| `bebidas` | — | **12** |
| `refeicoes` | — | **6** |
| `pousada` | — | **5** |
| `pocoes` | — | **10** |
| `armas` | simples 2 · marciais 4 · versateis 2 | **8** |
| `armaduras` | leves 3 · medias 2 · pesadas 3 · escudo 1 | **9** |
| **TOTAL** | | **50** |

12 + 6 + 5 + 10 + 8 + 9 = **50 itens** (decisão D-13 — a contagem antiga "52" estava errada;
a fonte tem 4 armas marciais e 2 armaduras médias).

**Desvio gera AVISO, nunca erro** (risco 13 — o catálogo pode crescer sem quebrar):

```
AVISO: contagem da categoria 'bebidas': esperado 12 itens (D-13), encontrado 13.
AVISO: total de itens: esperado 50 (D-13), encontrado 51.
```

- **Adicionou item de propósito?** O aviso é esperado e não bloqueia o commit. Nesse caso as
  contagens oficiais precisam ser atualizadas no validador (`EXPECTED_COUNTS`/
  `EXPECTED_TOTAL`, tarefa T-04) e nesta Seção — coordene com o Tech Lead.
- **Não bateu sem você mexer no total?** Algo foi removido/acidentalmente duplicado — investigue
  antes de commitar.

---

## 10. Cuidados

1. **Nunca inventar dados (RB-12).** A fonte é a única verdade: sem preço informado → não crie
   item; sem dado de peso/dano/CA → campo `null`, não número chutado; sem moeda além de PO →
   nenhuma conversão (RB-01); sem nome de arma → nome derivado no padrão D-11, nunca nome
   temático; typo da fonte ("Abrasil") → mantido (D-12).
2. **Emotes do Discord → emoji** e **registrar o mapeamento em [`EMOTES.md`](EMOTES.md)**
   (RF-14). Nenhum `:emote:` pode sobrar em qualquer string do JSON — o validador bloqueia
   (regra 11).
3. **Dado é dado: não edite HTML/JS para alterar conteúdo** (RNF-05) — e não misture regra de
   negócio no JSON; regras de negócio e lógica vivem nos módulos JS (relate ao Tech Lead se
   encontrar lógica de negócio onde não devia).
4. **Schema fechado:** não adicione campos novos por conta própria — o validador rejeita
   (regra 9). Precisou de campo novo? É mudança de schema (D-3/D-6) → decisão do Tech Lead.
5. **Enums são fixos:** nova categoria, subcategoria ou tag exige mudança de **código**
   (`js/utils.js`, `js/state.js`, `scripts/validate_data.py`) — não é edição de dado.
6. **`id` é estável:** não renomeie ids já publicados (quebra referências e vira item "novo"
   para qualquer coisa que os cite). Corrigir typo de `name` é livre; de `id`, não.
7. **Nenhum `<`/`>` em `name`** e nada que vire HTML — o front renderiza com `textContent`
   (ARCHITECTURE §9), mas a regra de dado já proíbe marcação no JSON.
8. **Sempre valide antes de commitar** (Seção 6) — exit 0 é o gate.

---

## Referências

| Documento | O que retira daqui |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) §5 | Contrato de dados, enums, decisões D-3, D-6, D-9 |
| [`REQUIREMENTS.md`](REQUIREMENTS.md) §6 | RB-01…RB-12, modelo do `Item` (RF-13/RNF-05) |
| [`EMOTES.md`](EMOTES.md) | Mapeamento `:emote:` → emoji (RF-14) |
| `scripts/validate_data.py` | Implementação das regras 1–17 (espelho desta doc) |
| `README.md` | Como rodar o site e o validador |
