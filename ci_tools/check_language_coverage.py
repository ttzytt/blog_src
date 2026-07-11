#!/usr/bin/env python3
"""Report Markdown pages missing from any configured Hexo language source tree."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


type LanguageRoots = dict[str, Path]
type LanguagePathSets = dict[str, set[Path]]


def read_scalar(config: Path, key: str) -> str | None:
    pattern = re.compile(rf"^{re.escape(key)}\s*:\s*([^#]+?)\s*$")
    for line in config.read_text(encoding="utf-8-sig").splitlines():
        match = pattern.match(line)
        if match:
            return match.group(1).strip().strip("'\"")
    return None


def discover_languages(project_root: Path) -> LanguageRoots:
    base_config = project_root / "_config.yml"
    if not base_config.is_file():
        raise ValueError(f"missing {base_config}")
    default_root = read_scalar(base_config, "source_dir") or "source"
    default_language = read_scalar(base_config, "language") or "default"
    languages = {default_language: project_root / default_root}

    for config in sorted(project_root.glob("config-*.yml")):
        source_dir = read_scalar(config, "source_dir")
        if not source_dir:
            continue
        language = read_scalar(config, "language") or config.stem.removeprefix("config-")
        source_root = project_root / source_dir
        existing = languages.get(language)
        if existing is not None and existing != source_root:
            raise ValueError(
                f"language {language!r} has multiple source roots: {existing} and {source_root}"
            )
        languages[language] = source_root
    return languages


def markdown_paths(root: Path) -> set[Path]:
    return {path.relative_to(root) for path in root.rglob("*.md")}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, default=Path("."))
    parser.add_argument(
        "--strict",
        action="store_true",
        help="return a non-zero status when counterparts are missing",
    )
    args = parser.parse_args()
    project_root = args.project_root.resolve()

    try:
        languages = discover_languages(project_root)
    except (OSError, UnicodeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1

    if len(languages) < 2:
        print("ERROR: fewer than two language source roots were discovered", file=sys.stderr)
        return 1

    path_sets: LanguagePathSets = {}
    for language, source_root in languages.items():
        if not source_root.is_dir():
            print(f"ERROR: source root for {language} does not exist: {source_root}", file=sys.stderr)
            return 1
        path_sets[language] = markdown_paths(source_root)

    all_paths = set().union(*path_sets.values())
    warnings: list[str] = []
    for relative_path in sorted(all_paths):
        missing = [language for language, paths in path_sets.items() if relative_path not in paths]
        if missing:
            warnings.append(f"{relative_path.as_posix()}: missing in {', '.join(missing)}")

    counts = ", ".join(
        f"{language}={len(paths)}" for language, paths in path_sets.items()
    )
    if warnings:
        for warning in warnings:
            print(f"WARNING: {warning}", file=sys.stderr)
        print(
            f"Language coverage found {len(warnings)} incomplete path(s); {counts}.",
            file=sys.stderr,
        )
        return 1 if args.strict else 0

    print(f"Language coverage passed: {len(all_paths)} shared path(s); {counts}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
