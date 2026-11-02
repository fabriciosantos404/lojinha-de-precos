#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validador de integridade do catálogo `data/items.json` — lojinha-de-precos.

Ferramenta de integridade do catálogo: o mantenedor roda UM comando antes de
commitar alterações no JSON (RNF-05). Lista TODOS os erros encontrados (não para
no primeiro) e termina com um resumo.

Uso (na raiz do repositório):
    python scripts/validate_data.py                   # valida data/items.json (padrão)
    python scripts/validate_data.py caminho/items.json # valida outro arquivo
    py scripts/validate_data.py                       # Windows sem `python` no PATH

Códigos de saída (exit codes):
    0 = catálogo VÁLIDO (podem existir AVISOs)
    1 = ERROS encontrados (arquivo ausente, UTF-8/JSON inválido, schema, enums,
        ids duplicados ou regras de domínio violadas)

Mensagens em PT-BR com prefixos: `ERRO:` (bloqueia o commit), `AVISO:`
(informativo, não bloqueia) e `OK:` (resumo final).

Regras cobertas (fonte da verdade: docs/ARCHITECTURE.md §5, docs/REQUIREMENTS.md):
    - Envelope `{version: 1, items: [não vazio]}`            (decisão D-3)
    - Schema fechado do Item, tipos e enums                   (§5.2/§5.3, risco 4)
    - `id` único e em formato slug                            (§5.2)
    - RB-02: todo item de pousada com `unit: "por noite"`
    - RF-14: nenhum emote Discord residual em qualquer string
    - Coerência modifiers × tags (RF-09)
    - Contagens por categoria                                 (AVISO, D-13/risco 13)

Decisão h (ARCHITECTURE §3): SOMENTE stdlib — json, sys, re, pathlib, argparse.
Zero pip, zero requirements, zero dependências.
"""

import argparse
import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Constantes de domínio (espelho de ARCHITECTURE §5 — atualizar aqui E no doc)
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATH = ROOT / "data" / "items.json"

# §5.3 — enums de categoria e subcategoria (chaves ASCII, labels no front)
CATEGORIES = ("bebidas", "refeicoes", "pousada", "pocoes", "armas", "armaduras")
SUBS_ARMAS = ("simples", "marciais", "versateis")
SUBS_ARMADURAS = ("leves", "medias", "pesadas", "escudo")
SUBCATEGORIES = SUBS_ARMAS + SUBS_ARMADURAS

# RB-02 — "por noite" só existe na pousada e TODO item de pousada exige
UNITS = (None, "por noite")

# §5.3 — conjunto documentado de tags
KNOWN_TAGS = (
    "cura",
    "bonus",
    "malus",
    "droga",
    "restricao",
    "descanso-curto",
    "descanso-longo",
    "atributo",
    "slot-magia",
)

# Contagens oficiais do catálogo — decisão D-13 (50 itens, não 52)
EXPECTED_COUNTS = {
    "bebidas": 12,
    "refeicoes": 6,
    "pousada": 5,
    "pocoes": 10,
    "armas": 8,
    "armaduras": 9,
}
EXPECTED_TOTAL = 50

# §5.2 — schema fechado do Item: presente OU ausente, nunca outro
REQUIRED_FIELDS = ("id", "name", "category", "price", "tags")
OPTIONAL_FIELDS = (
    "subcategory",
    "unit",
    "weightKg",
    "damage",
    "armorClass",
    "strengthReq",
    "effectText",
    "modifiers",
    "restrictions",
)
ALL_FIELDS = frozenset(REQUIRED_FIELDS + OPTIONAL_FIELDS)

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
EMOTE_RE = re.compile(r":[A-Za-z0-9_]{2,}:")  # RF-14 — emote Discord residual
DESCANSO_RE = re.compile(r"\[Descanso", re.IGNORECASE)
DESCANSO_CURTO_RE = re.compile(r"\[Descanso\s*Curto", re.IGNORECASE)
DESCANSO_LONGO_RE = re.compile(r"\[Descanso\s*Longo", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def is_int(value):
    """Inteiro de verdade (bool NÃO conta — `True` é subclasse de int)."""
    return isinstance(value, int) and not isinstance(value, bool)


def is_number(number):
    """number do JSON (int ou float), excluindo bool."""
    return isinstance(number, (int, float)) and not isinstance(number, bool)


def type_name(value):
    """Nome do tipo em termos de JSON, para mensagens de erro compreensíveis."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "booleano"
    if isinstance(value, int):
        return "inteiro"
    if isinstance(value, float):
        return "número"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "objeto"
    return type(value).__name__


def item_label(pos, item):
    """Rótulo do item para as mensagens: `item 12 ('skooma')`."""
    if isinstance(item, dict):
        item_id = item.get("id")
        if isinstance(item_id, str) and item_id:
            return "item {} ('{}')".format(pos, item_id)
    return "item {}".format(pos)


def find_emotes(node, path="$"):
    """Varre TODAS as strings do JSON atrás de emote Discord residual (RF-14).

    Retorna lista de (caminho, token, string original).
    """
    found = []
    if isinstance(node, str):
        for match in EMOTE_RE.finditer(node):
            found.append((path, match.group(0), node))
    elif isinstance(node, list):
        for index, child in enumerate(node):
            found.extend(find_emotes(child, "{}[{}]".format(path, index)))
    elif isinstance(node, dict):
        for key, child in node.items():
            found.extend(find_emotes(child, "{}.{}".format(path, key)))
    return found


# ---------------------------------------------------------------------------
# Validação por item (regras 3–14)
# ---------------------------------------------------------------------------


def validate_item(item, pos, errors, warnings, state):
    if not isinstance(item, dict):
        errors.append(
            "item {}: deve ser um objeto JSON, encontrado {}.".format(
                pos, type_name(item)
            )
        )
        return

    label = item_label(pos, item)

    # --- Regra 9: schema fechado (§5.2) — nenhum campo extra ----------------
    for key in item:
        if key not in ALL_FIELDS:
            errors.append(
                "{}: campo desconhecido '{}' (schema fechado, ARCHITECTURE §5.2).".format(
                    label, key
                )
            )

    # --- Regra 3: campos obrigatórios presentes -----------------------------
    for key in REQUIRED_FIELDS:
        if key not in item:
            errors.append("{}: campo obrigatório '{}' ausente.".format(label, key))

    # --- Regra 3/4: id string slug e único ----------------------------------
    if "id" in item:
        item_id = item["id"]
        if not isinstance(item_id, str):
            errors.append(
                "{}: 'id' deve ser string slug, encontrado {}.".format(
                    label, type_name(item_id)
                )
            )
        else:
            if not SLUG_RE.match(item_id):
                errors.append(
                    "{}: 'id' '{}' fora do formato slug "
                    "(^[a-z0-9]+(-[a-z0-9]+)*$).".format(label, item_id)
                )
            first_pos = state["seen_ids"].get(item_id)
            if first_pos is not None:
                errors.append(
                    "{}: 'id' duplicado — primeira ocorrência no item {}.".format(
                        label, first_pos
                    )
                )
            else:
                state["seen_ids"][item_id] = pos

    # --- Regra 3/13: name string não vazia, sem '<'/'>' ---------------------
    # §9: dados nunca viram HTML (o front usa textContent, mas a regra de
    # dados garante que nem o JSON carregue marcação).
    if "name" in item:
        name = item["name"]
        if not isinstance(name, str):
            errors.append(
                "{}: 'name' deve ser string, encontrado {}.".format(
                    label, type_name(name)
                )
            )
        elif not name.strip():
            errors.append("{}: 'name' não pode ser vazio.".format(label))
        elif "<" in name or ">" in name:
            errors.append(
                "{}: 'name' contém '<' ou '>' — dado nunca vira HTML "
                "(ARCHITECTURE §9).".format(label)
            )

    # --- Regra 3/5: category ∈ enum -----------------------------------------
    category = item.get("category")
    category_ok = False
    if "category" in item:
        if not isinstance(category, str):
            errors.append(
                "{}: 'category' deve ser string, encontrado {}.".format(
                    label, type_name(category)
                )
            )
        elif category not in CATEGORIES:
            errors.append(
                "{}: 'category' '{}' fora do enum {}.".format(
                    label, category, list(CATEGORIES)
                )
            )
        else:
            category_ok = True
            state["counts"][category] = state["counts"].get(category, 0) + 1

    # --- Regra 6: subcategory ∈ enum + regras por categoria -----------------
    subcategory = item.get("subcategory")  # ausente == null (§5.2 é opcional)
    sub_plausible = subcategory is None or (
        isinstance(subcategory, str) and subcategory in SUBCATEGORIES
    )
    if "subcategory" in item and not sub_plausible:
        errors.append(
            "{}: 'subcategory' {} fora do enum {} (ou null).".format(
                label, repr(subcategory), list(SUBCATEGORIES)
            )
        )
    if category_ok and sub_plausible:
        if category == "armas" and subcategory not in SUBS_ARMAS:
            errors.append(
                "{}: categoria 'armas' exige subcategory ∈ {}.".format(
                    label, list(SUBS_ARMAS)
                )
            )
        elif category == "armaduras" and subcategory not in SUBS_ARMADURAS:
            errors.append(
                "{}: categoria 'armaduras' exige subcategory ∈ {}.".format(
                    label, list(SUBS_ARMADURAS)
                )
            )
        elif category not in ("armas", "armaduras") and subcategory is not None:
            errors.append(
                "{}: categoria '{}' exige 'subcategory' null.".format(
                    label, category
                )
            )

    # --- Regra 3/17: price inteiro ≥ 0 (não bool) + aviso de preço 0 -------
    if "price" in item:
        price = item["price"]
        if isinstance(price, bool) or not isinstance(price, int):
            errors.append(
                "{}: 'price' deve ser inteiro ≥ 0, encontrado {} ({!r}).".format(
                    label, type_name(price), price
                )
            )
        elif price < 0:
            errors.append(
                "{}: 'price' ({}) não pode ser negativo.".format(label, price)
            )
        elif price == 0:
            # Regra 17 (AVISO): preço 0 é permitido, mas incomum
            warnings.append("{}: preço 0.".format(label))

    # --- Regra 7/8: unit ∈ {null, "por noite"} + RB-02 -----------------------
    unit = item.get("unit")  # ausente == null
    unit_typed = unit is None or unit == "por noite"
    if "unit" in item and not unit_typed:
        errors.append(
            '{}: \'unit\' deve ser null ou "por noite", encontrado {} ({!r}).'.format(
                label, type_name(unit), unit
            )
        )
    if unit_typed and category_ok:
        if unit == "por noite" and category != "pousada":
            errors.append(
                '{}: \'unit: "por noite"\' só é permitido na categoria '
                "'pousada' (RB-02).".format(label)
            )
        if category == "pousada" and unit != "por noite":
            errors.append(
                '{}: item da categoria \'pousada\' deve ter '
                '\'unit: "por noite"\' (RB-02).'.format(label)
            )

    # --- Regra 8: tipos dos opcionais ---------------------------------------
    weight = item.get("weightKg")
    if "weightKg" in item and weight is not None and not is_number(weight):
        errors.append(
            "{}: 'weightKg' deve ser number|null, encontrado {}.".format(
                label, type_name(weight)
            )
        )

    damage = item.get("damage")
    if "damage" in item and damage is not None and not isinstance(damage, str):
        errors.append(
            "{}: 'damage' deve ser string|null, encontrado {}.".format(
                label, type_name(damage)
            )
        )

    armor_class = item.get("armorClass")
    if "armorClass" in item and armor_class is not None and not isinstance(
        armor_class, str
    ):
        errors.append(
            "{}: 'armorClass' deve ser string|null, encontrado {}.".format(
                label, type_name(armor_class)
            )
        )

    strength_req = item.get("strengthReq")
    if "strengthReq" in item and strength_req is not None and not is_int(
        strength_req
    ):
        errors.append(
            "{}: 'strengthReq' deve ser inteiro|null, encontrado {}.".format(
                label, type_name(strength_req)
            )
        )

    effect_text = item.get("effectText")
    effect_ok = True
    if "effectText" in item and effect_text is not None and not isinstance(
        effect_text, str
    ):
        errors.append(
            "{}: 'effectText' deve ser string|null, encontrado {}.".format(
                label, type_name(effect_text)
            )
        )
        effect_ok = False

    # Regra 8: modifiers = list de {value: int ≠ 0, label: str} (D-6)
    modifiers_ok = True
    modifiers = item.get("modifiers")
    parsed_values = []
    if "modifiers" in item:
        if not isinstance(modifiers, list):
            errors.append(
                "{}: 'modifiers' deve ser array de objetos {{value, label}}, "
                "encontrado {}.".format(label, type_name(modifiers))
            )
            modifiers_ok = False
        else:
            for index, modifier in enumerate(modifiers):
                if not isinstance(modifier, dict):
                    errors.append(
                        "{}: modifiers[{}] deve ser objeto {{value, label}}, "
                        "encontrado {}.".format(label, index, type_name(modifier))
                    )
                    modifiers_ok = False
                    continue
                for key in modifier:
                    if key not in ("value", "label"):
                        errors.append(
                            "{}: modifiers[{}] tem campo desconhecido '{}'.".format(
                                label, index, key
                            )
                        )
                        modifiers_ok = False
                for key in ("value", "label"):
                    if key not in modifier:
                        errors.append(
                            "{}: modifiers[{}] sem o campo obrigatório "
                            "'{}'.".format(label, index, key)
                        )
                        modifiers_ok = False
                if "value" in modifier:
                    value = modifier["value"]
                    if not is_int(value) or value == 0:
                        errors.append(
                            "{}: modifiers[{}].value deve ser inteiro ≠ 0, "
                            "encontrado {!r}.".format(label, index, value)
                        )
                        modifiers_ok = False
                if "label" in modifier:
                    text_label = modifier["label"]
                    if not isinstance(text_label, str) or not text_label.strip():
                        errors.append(
                            "{}: modifiers[{}].label deve ser string não "
                            "vazia.".format(label, index)
                        )
                        modifiers_ok = False
                if is_int(modifier.get("value")) and isinstance(
                    modifier.get("label"), str
                ):
                    parsed_values.append(modifier["value"])

    # Regra 8: restrictions = list[str]
    if "restrictions" in item:
        restrictions = item["restrictions"]
        if not isinstance(restrictions, list):
            errors.append(
                "{}: 'restrictions' deve ser array de strings, encontrado "
                "{}.".format(label, type_name(restrictions))
            )
        else:
            for index, text in enumerate(restrictions):
                if not isinstance(text, str):
                    errors.append(
                        "{}: restrictions[{}] deve ser string, encontrado "
                        "{}.".format(label, index, type_name(text))
                    )
                elif not text.strip():
                    errors.append(
                        "{}: restrictions[{}] não pode ser string "
                        "vazia.".format(label, index)
                    )

    # Regra 3/10: tags = list[str] do conjunto documentado (§5.3)
    # Decisão do Tech Lead (T-04): o CAMPO 'tags' é obrigatório, mas a lista
    # PODE ser vazia (37 dos 50 itens do catálogo não têm tags) — o que não
    # pode existir é string vazia dentro da lista. §5.2 exige presença, não
    # conteúdo.
    raw_tags = set()
    tags_is_list = False
    if "tags" in item:
        tags = item["tags"]
        if not isinstance(tags, list):
            errors.append(
                "{}: 'tags' deve ser array de strings, encontrado {}.".format(
                    label, type_name(tags)
                )
            )
        else:
            tags_is_list = True
            for index, tag in enumerate(tags):
                if not isinstance(tag, str):
                    errors.append(
                        "{}: tags[{}] deve ser string, encontrado {}.".format(
                            label, index, type_name(tag)
                        )
                    )
                elif not tag.strip():
                    errors.append(
                        "{}: tags[{}] não pode ser string vazia.".format(
                            label, index
                        )
                    )
                elif tag not in KNOWN_TAGS:
                    errors.append(
                        "{}: tag '{}' fora do conjunto documentado "
                        "(ARCHITECTURE §5.3).".format(label, tag)
                    )
                else:
                    raw_tags.add(tag)
                    state["used_tags"].add(tag)

    # --- Regra 14: coerência modifiers × tags (ERRO confirmado) -------------
    # Modifiers negativos exigem tag 'malus'; positivos exigem 'bonus' (RF-09:
    # badges verdes/vermelhas derivadas de dado tipado).
    if modifiers_ok and tags_is_list:
        if any(value < 0 for value in parsed_values) and "malus" not in raw_tags:
            errors.append(
                "{}: tem modifier negativo mas não tem a tag 'malus' "
                "(coerência RF-09).".format(label)
            )
        if any(value > 0 for value in parsed_values) and "bonus" not in raw_tags:
            errors.append(
                "{}: tem modifier positivo mas não tem a tag 'bonus' "
                "(coerência RF-09).".format(label)
            )

    # --- Regra 14 (parte final): AVISO de '[Descanso' sem tag ---------------
    if effect_ok and tags_is_list and isinstance(effect_text, str):
        if DESCANSO_RE.search(effect_text):
            expected = []
            if DESCANSO_CURTO_RE.search(effect_text):
                expected.append("descanso-curto")
            if DESCANSO_LONGO_RE.search(effect_text):
                expected.append("descanso-longo")
            missing = [tag for tag in expected if tag not in raw_tags]
            for tag in missing:
                warnings.append(
                    "{}: effectText menciona '[Descanso ...]' mas a tag '{}' "
                    "está ausente.".format(label, tag)
                )
            if not expected:
                warnings.append(
                    "{}: effectText menciona '[Descanso' mas nenhuma tag "
                    "'descanso-curto'/'descanso-longo' está "
                    "presente.".format(label)
                )

    # --- Regra 12: regras de domínio ----------------------------------------
    # Guardas de tipo: se o campo já gerou erro de tipo, não duplica erro aqui.
    damage_typed = damage is None or isinstance(damage, str)
    weight_typed = weight is None or is_number(weight)
    armor_typed = armor_class is None or isinstance(armor_class, str)
    strength_typed = strength_req is None or is_int(strength_req)

    if category_ok and category == "armas":
        # RB-03: dano é o dado central de uma arma
        if damage_typed and damage is None:
            errors.append(
                "{}: armas devem ter 'damage' não nulo (RB-03).".format(label)
            )
        if weight_typed and weight is None:
            errors.append(
                "{}: armas devem ter 'weightKg' não nulo.".format(label)
            )

    if category_ok and category == "armaduras":
        # RB-04: CA é o dado central de armadura/escudo
        if armor_typed and armor_class is None:
            errors.append(
                "{}: armaduras/escudo devem ter 'armorClass' não nulo "
                "(RB-04).".format(label)
            )
        if weight_typed and weight is None:
            errors.append(
                "{}: armaduras/escudo devem ter 'weightKg' não nulo.".format(label)
            )
        if (
            strength_typed
            and strength_req is not None
            and sub_plausible
            and subcategory != "pesadas"
        ):
            errors.append(
                "{}: 'strengthReq' só é permitido em armaduras "
                "'pesadas'.".format(label)
            )

    if strength_typed and strength_req is not None and armor_typed and (
        armor_class is None
    ):
        errors.append(
            "{}: item com 'strengthReq' deve ter 'armorClass'.".format(label)
        )


# ---------------------------------------------------------------------------
# Orquestração (regras 1–2, 11, 15–17) e saída
# ---------------------------------------------------------------------------


def configure_output():
    """Força stdout em UTF-8 para as mensagens PT-BR com acentos.

    No Windows, stdout redirecionado (pipe de CI/log) herda o codepage do
    sistema e quebra acentos ("não" vira "nÃ£o"); UTF-8 explícito mantém a
    saída idêntica em console, pipe e editor de log.
    """
    reconfigure = getattr(sys.stdout, "reconfigure", None)
    if reconfigure is None:
        return  # stream primitivo sem reconfiguração (ex.: stdout substituído)
    try:
        reconfigure(encoding="utf-8", errors="replace")
    except (OSError, ValueError):
        # Sem suporte a reconfiguração neste ambiente: mantém o encoding
        # padrão do interpreter — mensagens continuam corretas, só o encoding
        # do canal pode variar.
        pass


def finish(errors, warnings, item_count):
    """Imprime TODOS os erros, depois os avisos, e devolve o exit code."""
    for message in errors:
        print("ERRO: {}".format(message))
    for message in warnings:
        print("AVISO: {}".format(message))
    if errors:
        print("ERRO: {} erro(s) encontrado(s).".format(len(errors)))
        return 1
    print(
        "OK: {} itens validados, 0 erros, {} avisos.".format(
            item_count, len(warnings)
        )
    )
    return 0


def parse_args(argv):
    parser = argparse.ArgumentParser(
        prog="validate_data.py",
        description=(
            "Valida schema, enums, ids únicos, regras de domínio e emotes "
            "residuais de data/items.json (RNF-05). Roda na raiz do repo: "
            "python scripts/validate_data.py"
        ),
    )
    parser.add_argument(
        "path",
        nargs="?",
        default=None,
        help=(
            "caminho do JSON a validar "
            "(padrão: data/items.json, resolvido a partir da raiz do repo)"
        ),
    )
    return parser.parse_args(argv)


def main(argv=None):
    configure_output()
    args = parse_args(argv)
    target = Path(args.path) if args.path else DEFAULT_PATH

    errors = []
    warnings = []

    # --- Regra 1: arquivo existe, é UTF-8 válido e é JSON --------------------
    try:
        raw = target.read_bytes()
    except FileNotFoundError:
        errors.append("arquivo não encontrado: {}".format(target))
        return finish(errors, warnings, 0)
    except OSError as exc:
        errors.append("não foi possível ler {}: {}".format(target, exc))
        return finish(errors, warnings, 0)

    try:
        # utf-8-sig tolera BOM do Windows e continua rejeitando bytes inválidos
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        errors.append("{} não é UTF-8 válido: {}".format(target, exc))
        return finish(errors, warnings, 0)

    try:
        doc = json.loads(text)
    except json.JSONDecodeError as exc:
        errors.append(
            "JSON inválido em {} (linha {}, coluna {}): {}".format(
                target, exc.lineno, exc.colno, exc.msg
            )
        )
        return finish(errors, warnings, 0)

    # --- Regra 11 (RF-14): nenhum emote Discord residual em string alguna ----
    for path_str, token, snippet in find_emotes(doc):
        short = snippet if len(snippet) <= 80 else snippet[:77] + "..."
        errors.append(
            "emote Discord residual '{}' em {} (RF-14): \"{}\"".format(
                token, path_str, short
            )
        )

    # --- Regra 2: envelope {version: 1, items: [não vazio]} (D-3) ------------
    if not isinstance(doc, dict):
        errors.append(
            "envelope deve ser um objeto JSON, encontrado {}.".format(
                type_name(doc)
            )
        )
        return finish(errors, warnings, 0)

    if "version" not in doc:
        errors.append("envelope sem o campo 'version' (esperado 1).")
    else:
        version = doc["version"]
        if isinstance(version, bool) or not is_int(version) or version != 1:
            errors.append(
                "envelope 'version' deve ser o inteiro 1, encontrado "
                "{!r}.".format(version)
            )

    if "items" not in doc:
        errors.append("envelope sem o campo 'items'.")
        return finish(errors, warnings, 0)

    items = doc["items"]
    if not isinstance(items, list):
        errors.append(
            "envelope 'items' deve ser array, encontrado {}.".format(
                type_name(items)
            )
        )
        return finish(errors, warnings, 0)
    if not items:
        errors.append("envelope 'items' não pode ser vazio.")
        return finish(errors, warnings, 0)

    # --- Regras 3–14: validação item a item (acumula, nunca para no 1º erro) --
    state = {"seen_ids": {}, "counts": {}, "used_tags": set()}
    for pos, item in enumerate(items, start=1):
        validate_item(item, pos, errors, warnings, state)

    # --- Regra 15 (AVISO): contagens por categoria (D-13 / risco 13) ---------
    # O catálogo pode crescer: desvio vira aviso, nunca erro.
    for category, expected in EXPECTED_COUNTS.items():
        actual = state["counts"].get(category, 0)
        if actual != expected:
            warnings.append(
                "contagem da categoria '{}': esperado {} itens (D-13), "
                "encontrado {}.".format(category, expected, actual)
            )
    if len(items) != EXPECTED_TOTAL:
        warnings.append(
            "total de itens: esperado {} (D-13), encontrado {}.".format(
                EXPECTED_TOTAL, len(items)
            )
        )

    # --- Regra 16 (AVISO): tag documentada nunca usada -----------------------
    for tag in KNOWN_TAGS:
        if tag not in state["used_tags"]:
            warnings.append(
                "tag documentada '{}' nunca usada no catálogo.".format(tag)
            )

    return finish(errors, warnings, len(items))


if __name__ == "__main__":
    sys.exit(main())
