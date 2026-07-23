#!/usr/bin/env python3
"""Validate translated Hexo tag/category values against a CSV glossary."""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

from multilingual_front_matter import multilingual_path_is_skipped


REQUIRED_COLUMNS = (
    "type",
    "source_language",
    "target_language",
    "source",
    "target",
    "context",
    "note",
)
TAXONOMY_FIELDS = {"tags": "tag", "categories": "category"}
type TaxonomyKey = tuple[str, str]
type TaxonomyMap = dict[TaxonomyKey, str]
type GlossaryKey = tuple[str, str, str, str, str]


def unquote_yaml_scalar(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] == "'":
        return value[1:-1].replace("''", "'")
    if len(value) >= 2 and value[0] == value[-1] == '"':
        try:
            import json

            return json.loads(value)
        except (ValueError, TypeError):
            return value[1:-1]
    return value


def split_flow_sequence(value: str) -> list[str]:
    body = value.strip()[1:-1]
    if not body.strip():
        return []
    return [unquote_yaml_scalar(item) for item in next(csv.reader([body], skipinitialspace=True))]


def read_front_matter(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8-sig")
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return []
    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            return lines[1:index]
    raise ValueError("front matter has no closing delimiter")


def taxonomy_values(path: Path) -> dict[str, list[str]]:
    lines = read_front_matter(path)
    result = {field: [] for field in TAXONOMY_FIELDS}
    index = 0
    while index < len(lines):
        match = re.match(r"^(tags|categories)\s*:\s*(.*?)\s*$", lines[index])
        if not match:
            index += 1
            continue

        field, inline_value = match.groups()
        if inline_value:
            if inline_value.startswith("[") and inline_value.endswith("]"):
                result[field] = split_flow_sequence(inline_value)
            else:
                result[field] = [unquote_yaml_scalar(inline_value)]
            index += 1
            continue

        values: list[str] = []
        index += 1
        while index < len(lines):
            # YAML permits indentationless sequences directly below a mapping key.
            item = re.match(r"^\s*-\s+(.+?)\s*$", lines[index])
            if item:
                values.append(unquote_yaml_scalar(item.group(1)))
                index += 1
                continue
            if not lines[index].strip() or lines[index].lstrip().startswith("#"):
                index += 1
                continue
            break
        result[field] = values
    return result


def load_mappings(
    glossary: Path, source_language: str, target_language: str
) -> tuple[TaxonomyMap, list[str]]:
    errors: list[str] = []
    mappings: TaxonomyMap = {}
    glossary_entries: dict[GlossaryKey, str] = {}
    with glossary.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if tuple(reader.fieldnames or ()) != REQUIRED_COLUMNS:
            return {}, [
                f"{glossary}: expected CSV header {','.join(REQUIRED_COLUMNS)}"
            ]
        for line_number, row in enumerate(reader, start=2):
            row = {key: (value or "").strip() for key, value in row.items()}
            if row["type"] not in {"tag", "category", "term"}:
                errors.append(f"{glossary}:{line_number}: unsupported type {row['type']!r}")
                continue
            if not row["source"] or not row["target"]:
                errors.append(f"{glossary}:{line_number}: source and target are required")
                continue
            if not row["source_language"] or not row["target_language"]:
                errors.append(
                    f"{glossary}:{line_number}: source_language and target_language are required"
                )
                continue
            glossary_key = (
                row["type"],
                row["source_language"],
                row["target_language"],
                row["source"],
                row["context"],
            )
            previous_entry = glossary_entries.get(glossary_key)
            if previous_entry is not None:
                qualifier = "duplicate" if previous_entry == row["target"] else "conflicting"
                errors.append(
                    f"{glossary}:{line_number}: {qualifier} glossary entry for "
                    f"{row['source']!r}"
                )
                continue
            glossary_entries[glossary_key] = row["target"]
            if row["type"] == "term":
                continue
            if row["context"] or row["note"]:
                errors.append(
                    f"{glossary}:{line_number}: taxonomy rows must not use context/note"
                )
            if (
                row["source_language"] != source_language
                or row["target_language"] != target_language
            ):
                continue
            key = (row["type"], row["source"])
            previous = mappings.get(key)
            if previous is not None and previous != row["target"]:
                errors.append(
                    f"{glossary}:{line_number}: conflicting mapping for "
                    f"{row['type']} {row['source']!r}: {previous!r} vs {row['target']!r}"
                )
            mappings[key] = row["target"]
    return mappings, errors


def markdown_files(root: Path) -> dict[Path, Path]:
    return {path.relative_to(root): path for path in root.rglob("*.md")}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--glossary", type=Path, default=Path("translation-glossary-zh-en.csv")
    )
    parser.add_argument("--source-root", type=Path, default=Path("source"))
    parser.add_argument("--target-root", type=Path, default=Path("source-en"))
    parser.add_argument("--source-language", default="zh-CN")
    parser.add_argument("--target-language", default="en")
    args = parser.parse_args()

    errors: list[str] = []
    if not args.glossary.is_file():
        print(f"ERROR: glossary not found: {args.glossary}", file=sys.stderr)
        return 1
    if not args.source_root.is_dir() or not args.target_root.is_dir():
        print("ERROR: source and target roots must both exist", file=sys.stderr)
        return 1

    mappings, mapping_errors = load_mappings(
        args.glossary, args.source_language, args.target_language
    )
    errors.extend(mapping_errors)

    source_files = markdown_files(args.source_root)
    target_files = markdown_files(args.target_root)
    checked_pairs = 0
    skipped_count = 0
    observed: set[TaxonomyKey] = set()

    for relative_path, source_path in sorted(source_files.items()):
        target_path = target_files.get(relative_path)
        try:
            if multilingual_path_is_skipped(
                source_path, *(tuple() if target_path is None else (target_path,))
            ):
                skipped_count += 1
                continue
        except (OSError, UnicodeError, ValueError) as error:
            errors.append(f"{relative_path}: {error}")
            continue
        try:
            source_taxonomy = taxonomy_values(source_path)
        except (OSError, UnicodeError, ValueError) as error:
            errors.append(f"{relative_path}: {error}")
            continue

        target_taxonomy: dict[str, list[str]] | None = None
        if target_path is not None:
            try:
                target_taxonomy = taxonomy_values(target_path)
                checked_pairs += 1
            except (OSError, UnicodeError, ValueError) as error:
                errors.append(f"{relative_path}: {error}")

        for field, taxonomy_type in TAXONOMY_FIELDS.items():
            expected: list[str] = []
            for source_value in source_taxonomy[field]:
                key = (taxonomy_type, source_value)
                observed.add(key)
                target_value = mappings.get(key)
                if target_value is None:
                    errors.append(
                        f"{relative_path.as_posix()}: missing glossary {taxonomy_type} mapping "
                        f"for {source_value!r}"
                    )
                else:
                    expected.append(target_value)

            if target_taxonomy is None:
                continue  # The language-coverage checker reports missing counterparts.
            actual = target_taxonomy[field]
            if len(expected) == len(source_taxonomy[field]) and actual != expected:
                errors.append(
                    f"{relative_path.as_posix()}: {field} mismatch; "
                    f"expected {expected!r}, got {actual!r}"
                )

    unused = sorted(set(mappings) - observed)
    for taxonomy_type, source_value in unused:
        print(
            f"WARNING: unused glossary {taxonomy_type} mapping for {source_value!r}",
            file=sys.stderr,
        )

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Taxonomy validation failed with {len(errors)} error(s).", file=sys.stderr)
        return 1

    print(
        f"Taxonomy validation passed: {checked_pairs} file pair(s), "
        f"{len(observed)} unique tag/category value(s), skipped={skipped_count}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
