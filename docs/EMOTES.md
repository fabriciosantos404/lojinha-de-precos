# EMOTES.md — mapeamento `:emote:` → emoji (RF-14)

> **Projeto:** lojinha-de-precos
> **Tarefa:** T-02 — rastreabilidade da substituição de emotes do Discord (RB-12 / RF-14)
> **Depende de:** `data/items.json` (T-01)
> **Status:** Entregue — **pendências encerradas** (Seção 6)
> **Responsável:** Senior Database Engineer
> **Companheiro de manutenção:** [`DATA.md`](DATA.md) (schema e edição do JSON)

---

## 1. Contexto e regras

1. **RB-12 (fidelidade textual):** nomes e efeitos em `data/items.json` são transcritos exatamente como na lista original do Discord. Os **emotes do Discord são o único elemento transformado** em emojis equivalentes.
2. **RF-14:** nenhum código `:Emote:` pode sobrar em `data/items.json` (conferência na Seção 5).
3. O schema do `Item` (ARCHITECTURE §5.2) **não possui campo `emoji`** — os emojis da fonte marcavam itens/seções na lista do Discord e vivem apenas nesta tabela de rastreabilidade; os textos transcritos não os contêm.
4. Critério de mapeamento: **similaridade semântica** entre o emote e o item/seção que ele marcava.
5. Mapeamentos marcados como **confirmados** foram validados pelo Tech Lead na especificação do T-02; os **inferidos** (código não preservado) estão na Seção 2.1 e o encerramento das pendências na Seção 6.

---

## 2. Mapeamento por item (emote → emoji → item) — confirmado

| # | Emote original (Discord) | Emoji | Item (`id`) | Nome |
|---|---|---|---|---|
| 1 | `:AstolfoKawaii:` | 🥛 | `copo-de-leite` | Copo de Leite |
| 2 | `:lua:` | 🍵 | `cha-gelado-de-ervas` | Chá Gelado de Ervas |
| 3 | `:AstolfoNight:` | 🍯 | `hidromel` | Hidromel |
| 4 | `:dudu:` | 🍎 | `cidra-da-terra-dos-anoes` | Cidra da Terra dos Anões |
| 5 | `:Chazin:` | 🥂 | `licor-fino` | Licor Fino |
| 6 | `:kannasipcoca:` | 🍹 | `caipirinha-de-abrasil` | Caipirinha de Abrasil |
| 7 | `:Meguminahegao:` | 🍷 | `vinho-de-boa-qualidade` | Vinho de Boa Qualidade |
| 8 | `:Vodka:` | 💜 | `skooma` | Skooma |

> **Nota (superseded):** o risco #4 do `REQUIREMENTS.md` trazia suposições hipotéticas (`:Vodka:` → 🍸, `:Chazin:` → 🧀, `:AstolfoKawaii:` → 🌸). Prevalecem os mapeamentos oficiais acima, confirmados pelo Tech Lead no T-02 — a suposição original nunca foi aplicada ao JSON.

### 2.1 Mapeamento inferido (código `:emote:` não preservado na lista-fonte)

Os códigos originais abaixo **não constam na lista preservada** — emoji deduzido por
**semântica** (critério do item 4 da Seção 1). O mapeamento é definitivo enquanto a fonte
original não for recuperada; se ressurgir, basta preencher a coluna "Emote original".

| # | Emote original (Discord) | Emoji | Item (`id`) | Nome | Justificativa semântica |
|---|---|---|---|---|---|
| 9 | não preservado | 🥤 | `suco-de-fruta-fresca` | Suco de Fruta Fresca | copo/suco de fruta |
| 10 | não preservado | 🍺 | `cerveja-comum` | Cerveja Comum | caneca de cerveja |
| 11 | não preservado | 🦜 | `grog-dos-piratas` | Grog dos Piratas | grog/pirataria |
| 12 | não preservado | 🧙 | `tonica-dos-magos` | Tônica dos Magos | magia/mago |

> **Nota (T-03):** `:emote:` algum entrou no `data/items.json` — a coluna existe só para
> rastreabilidade (RF-14). O validador bloqueia qualquer `:token:` residual (regra 11).

---

## 3. Emotes de seção (cabeçalhos de categoria)

| Seção (categoria) | Emote original (Discord) | Emoji | Itens cobertos | Status |
|---|---|---|---|---|
| Bebidas | — (emotes por item, Seção 2) | — | 12 | ✓ |
| Refeições | não preservado | 🍆 | 6 | ✓ — inferido por semântica (Seção 2.1/6) |
| Pousada | `:turtle:` | 🪶 | 5 | ✓ (confirmado no T-02) |
| Poções de Vida | não preservado | ♥️ | 10 | ✓ — inferido por semântica (Seção 2.1/6) |
| Armas | `:Kannasuicide:` | 🗡️ | 8 | ✓ |
| Armaduras & Escudo | `:chad:` | 🪖 | 9 | ✓ |

---

## 4. Inventário completo de emojis por item (conferência do catálogo)

### Bebidas (12)

| Emoji | Item (`id`) | Nome | Emote original |
|---|---|---|---|
| 🥛 | `copo-de-leite` | Copo de Leite | `:AstolfoKawaii:` |
| 🥤 | `suco-de-fruta-fresca` | Suco de Fruta Fresca | não preservado (inferido — Seção 2.1) |
| 🍵 | `cha-gelado-de-ervas` | Chá Gelado de Ervas | `:lua:` |
| 🍺 | `cerveja-comum` | Cerveja Comum | não preservado (inferido — Seção 2.1) |
| 🦜 | `grog-dos-piratas` | Grog dos Piratas | não preservado (inferido — Seção 2.1) |
| 🍯 | `hidromel` | Hidromel | `:AstolfoNight:` |
| 🍎 | `cidra-da-terra-dos-anoes` | Cidra da Terra dos Anões | `:dudu:` |
| 🥂 | `licor-fino` | Licor Fino | `:Chazin:` |
| 🍹 | `caipirinha-de-abrasil` | Caipirinha de Abrasil | `:kannasipcoca:` |
| 🧙 | `tonica-dos-magos` | Tônica dos Magos | não preservado (inferido — Seção 2.1) |
| 🍷 | `vinho-de-boa-qualidade` | Vinho de Boa Qualidade | `:Meguminahegao:` |
| 💜 | `skooma` | Skooma | `:Vodka:` |

### Refeições (6) — emoji de seção 🍆

| Item (`id`) | Nome |
|---|---|
| `refeicao-simples` | Refeição Simples |
| `refeicao-basica` | Refeição Básica |
| `refeicao-completa` | Refeição Completa |
| `refeicao-de-boa-qualidade` | Refeição de Boa Qualidade |
| `refeicao-nobre` | Refeição Nobre |
| `refeicao-luxuosa` | Refeição Luxuosa |

### Pousada (5) — emote de seção `:turtle:` → 🪶

| Item (`id`) | Nome |
|---|---|
| `quarto-simples` | Quarto Simples |
| `quarto-confortavel` | Quarto Confortável |
| `quarto-de-boa-qualidade` | Quarto de Boa Qualidade |
| `quarto-nobre` | Quarto Nobre |
| `suite-luxuosa` | Suíte Luxuosa |

### Poções de Vida (10) — emoji de seção ♥️

| Item (`id`) | Nome |
|---|---|
| `pocao-cura-menor` | Poção de Cura Menor |
| `pocao-cura-basica` | Poção de Cura Básica |
| `pocao-cura-comum` | Poção de Cura Comum |
| `pocao-cura-aumentada` | Poção de Cura Aumentada |
| `pocao-cura-potente` | Poção de Cura Potente |
| `pocao-cura-suprema` | Poção de Cura Suprema |
| `pocao-cura-magica` | Poção de Cura Mágica |
| `pocao-cura-extraordinaria` | Poção de Cura Extraordinária |
| `elixir-da-vida` | Elixir da Vida |
| `pocao-recuperacao-moderada-de-slot-de-magia` | Poção de Recuperação Moderada de Slot de Magia |

### Armas (8) — emote de seção `:Kannasuicide:` → 🗡️

| Item (`id`) | Nome |
|---|---|
| `arma-simples-1d4` | Arma Simples 1d4 |
| `arma-simples-1d6` | Arma Simples 1d6 |
| `arma-marcial-1d8` | Arma Marcial 1d8 |
| `arma-marcial-1d10` | Arma Marcial 1d10 |
| `arma-marcial-1d12` | Arma Marcial 1d12 |
| `arma-marcial-2d6` | Arma Marcial 2d6 |
| `arma-versatil-1d6-1d8` | Arma Versátil 1d6/1d8 |
| `arma-versatil-1d8-1d10` | Arma Versátil 1d8/1d10 |

### Armaduras & Escudo (9) — emote de seção `:chad:` → 🪖

| Item (`id`) | Nome |
|---|---|
| `armadura-de-couro` | Armadura de Couro |
| `armadura-de-couro-batido` | Armadura de Couro Batido |
| `armadura-de-pele` | Armadura de Pele |
| `armadura-de-escamas` | Armadura de Escamas |
| `armadura-de-cota-de-malha` | Armadura de Cota de Malha |
| `armadura-de-cota-de-malha-completa` | Armadura de Cota de Malha Completa |
| `armadura-de-escamas-reforcadas` | Armadura de Escamas Reforçadas |
| `armadura-de-placas` | Armadura de Placas |
| `escudo` | Escudo |

---

## 5. Conferência RF-14 (nenhum `:emote:` residual)

Comando (retorna vazio = OK):

```bash
grep -En ':[A-Za-z0-9_]+:' data/items.json
```

**Resultado na entrega:** nenhuma ocorrência — os códigos `:emote:` nunca entraram no JSON (a transcrição T-01 já recebeu os textos com os emojis/substituições aplicadas, e nenhum texto de item contém o padrão `:nome:`).

Verificação automatizada obrigatória (regra 11 do validador — varre **todas** as strings do arquivo):

```bash
py scripts/validate_data.py     # Windows — em outros SOs: python scripts/validate_data.py
```

Saída esperada: `OK: 50 itens validados, 0 erros, 0 avisos.` Qualquer `:emote:` residual aparece como `ERRO:` e bloqueia o commit. Detalhes: [`DATA.md`](DATA.md) Seção 6.

---

## 6. Pendências — encerradas (T-03)

| # | Pendência anterior | Resolução |
|---|---|---|
| 1 | Códigos de emote originais das bebidas 🥤 (Suco), 🍺 (Cerveja), 🦜 (Grog) e 🧙 (Tônica) não informados na especificação do T-02 | **Encerrada — não bloqueante.** *Códigos exatos indisponíveis na lista preservada — emoji inferido por semântica* (Seção 2.1). RF-14 segue íntegra: nenhum `:emote:` no JSON. Se a fonte original ressurgir, basta completar a coluna "Emote original". |
| 2 | Códigos de emote das seções 🍆 (Refeições) e ♥️ (Poções de Vida) não informados | **Encerrada — mesma nota:** códigos exatos indisponíveis na lista preservada — emoji inferido por semântica (Seção 3). |
| 3 | Contagem do catálogo: **50 itens** fiéis à fonte × 52 do `REQUIREMENTS.md` §7 | **Encerrada quanto a §7/RF-01/RF-11/RF-13/Fluxo 1/`PLAN_EXECUCAO.md`** — todos já usam 50 (D-13). **Restam 2 referências desatualizadas** para o dono do doc (não bloqueiam o dado): `REQUIREMENTS.md` RF-06 ("exatamente 5 itens" em Marciais → **4**) e US-01 ("9 itens de armas" → **8**). Ver Seção 7. |

> Nenhuma pendência bloqueia o gate. O `data/items.json` está conforme (validador: `OK: 50 itens validados, 0 erros, 0 avisos.`).

---

## 7. Nota de rastreabilidade — contagem do catálogo

O `data/items.json` entregue no T-01 contém **50 itens** (12 Bebidas + 6 Refeições + 5 Pousada + 10 Poções + 8 Armas + 9 Armaduras & Escudo), transcrição fiel da lista-fonte recebida — a fonte tem **4** armas marciais (não 5) e **2** armaduras médias (não 3), como o próprio D-11 do `ARCHITECTURE.md` confirma (8 nomes de armas).

**Decisão do Tech Lead:** fidelidade à fonte (RB-12) prevalece sobre a contagem do §7; inventar os 2 itens que faltariam seria dado falso. A divergência `52 → 50` foi reportada para correção documental do `REQUIREMENTS.md` (§7, RF-01, RF-11, RF-13, US-01, Fluxo 1) e do `PLAN_EXECUCAO.md` (T-01/T-04), e para alinhamento do validador `scripts/validate_data.py` (T-04) e dos critérios de QA.

**Situação (T-03):** correções aplicadas em `REQUIREMENTS.md` §7, RF-01, RF-11, RF-13 e Fluxo 1 e no `PLAN_EXECUCAO.md` (todos citam 50). **Restam duas referências desatualizadas** nesse mesmo doc — RF-06 ("lista exatamente 5 itens" em Marciais → hoje são **4**) e US-01 ("9 itens de armas" → hoje são **8**) —, de propriedade do autor dos requisitos; reportadas ao Tech Lead (ver pendência 3 da Seção 6). O dado e o validador já estão alinhados ao D-13 (12/6/5/10/8/9 = 50).
