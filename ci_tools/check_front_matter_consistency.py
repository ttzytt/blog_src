#!/usr/bin/env python3
"""Validate copied Hexo front matter across translated article pairs."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from check_language_coverage import discover_languages


# These fields contain language-specific prose or taxonomy translations. Their
# presence is checked, but their values are intentionally allowed to differ.
LOCALIZED_FIELDS = frozenset(
    {"title", "tags", "categories", "keywords", "description", "lang"}
)
TOP_LEVEL_FIELD = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$")
type FrontMatter = dict[str, tuple[str, ...]]


def front_matter_lines(path: Path) -> list[str] | None:
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return lines[1:index]
    raise ValueError(f"{path}: missing closing front matter delimiter")


def normalize_scalar(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] == '"':
        try:
            decoded = json.loads(value)
            return decoded if isinstance(decoded, str) else value
        except json.JSONDecodeError:
            return value
    if len(value) >= 2 and value[0] == value[-1] == "'":
        return value[1:-1].replace("''", "'")
    if value.lower() in {"null", "~"}:
        return ""
    if value.lower() in {"true", "false"}:
        return value.lower()
    return value


def parse_front_matter(path: Path) -> FrontMatter | None:
    lines = front_matter_lines(path)
    if lines is None:
        return None
    result: FrontMatter = {}
    current_key: str | None = None
    for line_number, line in enumerate(lines, start=2):
        match = TOP_LEVEL_FIELD.match(line) if line == line.lstrip() else None
        if match:
            key, value = match.groups()
            if key in result:
                raise ValueError(f"{path}:{line_number}: duplicate field {key!r}")
            result[key] = (normalize_scalar(value),)
            current_key = key
            continue
        if current_key is None:
            if line.strip() and not line.lstrip().startswith("#"):
                raise ValueError(f"{path}:{line_number}: malformed front matter line")
            continue
        if line.strip() and not line.lstrip().startswith("#"):
            result[current_key] += (line.rstrip(),)
    return result


def compare_pair(source: Path, target: Path) -> list[str]:
    source_fields = parse_front_matter(source)
    target_fields = parse_front_matter(target)
    errors: list[str] = []

    if source_fields is None and target_fields is None:
        return errors
    if source_fields is None:
        return [f"{target}: has front matter while source {source} does not"]
    if target_fields is None:
        return [f"{target}: missing front matter present in source {source}"]

    missing = sorted(source_fields.keys() - target_fields.keys())
    extra = sorted(target_fields.keys() - source_fields.keys())
    if missing:
        errors.append(f"{target}: missing field(s): {', '.join(missing)}")
    if extra:
        errors.append(f"{target}: extra field(s): {', '.join(extra)}")

    copied_fields = (source_fields.keys() & target_fields.keys()) - LOCALIZED_FIELDS
    for field in sorted(copied_fields):
        if source_fields[field] != target_fields[field]:
            errors.append(
                f"{target}: {field!r} differs from source {source}: "
                f"{target_fields[field]!r} != {source_fields[field]!r}"
            )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, default=Path("."))
    parser.add_argument(
        "--source-language",
        help="language code used as the authoritative front matter source",
    )
    args = parser.parse_args()
    project_root = args.project_root.resolve()

    try:
        languages = discover_languages(project_root)
        source_language = args.source_language or next(iter(languages))
        source_root = languages[source_language]
    except (KeyError, OSError, UnicodeError, ValueError, StopIteration) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1

    errors: list[str] = []
    pair_count = 0
    try:
        for relative_path in sorted(path.relative_to(source_root) for path in source_root.rglob("*.md")):
            source_path = source_root / relative_path
            for language, target_root in languages.items():
                if language == source_language:
                    continue
                target_path = target_root / relative_path
                if not target_path.is_file():
                    continue  # The language coverage check reports missing pairs.
                pair_count += 1
                errors.extend(compare_pair(source_path, target_path))
    except (OSError, UnicodeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Front matter validation failed with {len(errors)} error(s).", file=sys.stderr)
        return 1

    print(
        f"Front matter validation passed: {pair_count} pair(s), "
        f"source language={source_language}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
