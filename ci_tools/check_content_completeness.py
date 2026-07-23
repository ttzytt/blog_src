#!/usr/bin/env python3
"""Validate translated Markdown body length and preserved structural elements."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from check_language_coverage import discover_languages
from multilingual_front_matter import multilingual_path_is_skipped


# Directional target/source character coefficients after removing front matter,
# the machine-translation warning, fenced code, URLs, and Markdown/HTML syntax.
# The required target count is source_count * coefficient.
CHARACTER_CONVERSION_COEFFICIENTS: dict[tuple[str, str], float] = {
    ("en", "zh-CN"): 1 / 1.5,
    ("zh-CN", "en"): 1.5,
}

FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
MACHINE_WARNING = re.compile(
    r"\{%\s*note\s+danger\s+simple\s*%\}.*?\{%\s*endnote\s*%\}",
    re.DOTALL | re.IGNORECASE,
)
MARKDOWN_IMAGE = re.compile(r"!\[([^]]*)\]\([^\n)]*\)")
REFERENCE_IMAGE = re.compile(r"!\[([^]]*)\]\[[^]]*\]")
MARKDOWN_LINK = re.compile(r"(?<!!)\[([^]]+)\]\([^\n)]*\)")
REFERENCE_LINK = re.compile(r"(?<!!)\[([^]]+)\]\[[^]]*\]")
AUTOLINK = re.compile(r"<https?://[^>]+>", re.IGNORECASE)
HTML_IMAGE = re.compile(r"<img\b", re.IGNORECASE)
HTML_LINK = re.compile(r"<a\b", re.IGNORECASE)
HEXO_IMAGE = re.compile(r"\{%\s*(?:asset_img|image)\b", re.IGNORECASE)
INLINE_CODE = re.compile(r"(`+)(.+?)\1", re.DOTALL)
HTML_TAG = re.compile(r"</?[A-Za-z][^>]*>")
HEXO_TAG = re.compile(r"\{%.*?%\}", re.DOTALL)
URL = re.compile(r"https?://[^\s)>]+", re.IGNORECASE)
MARKDOWN_SYNTAX = re.compile(r"[*_~#>|{}\[\]()]")
type MetricsByLanguage = dict[str, "ContentMetrics"]


@dataclass(frozen=True)
class ContentMetrics:
    characters: int
    code_fences: int
    images: int
    links: int


def markdown_body(path: Path) -> str:
    text = path.read_text(encoding="utf-8-sig")
    lines = text.splitlines(keepends=True)
    if lines and lines[0].strip() == "---":
        for index, line in enumerate(lines[1:], start=1):
            if line.strip() == "---":
                text = "".join(lines[index + 1 :])
                break
        else:
            raise ValueError(f"{path}: missing closing front matter delimiter")
    return MACHINE_WARNING.sub("", text, count=1)


def split_prose_and_count_fences(path: Path, body: str) -> tuple[str, int]:
    prose: list[str] = []
    opening: tuple[str, int] | None = None
    fence_count = 0

    for line_number, line in enumerate(body.splitlines(keepends=True), start=1):
        match = FENCE.match(line.rstrip("\r\n"))
        if opening is None:
            if match:
                marker = match.group(1)
                opening = (marker[0], len(marker))
                fence_count += 1
            else:
                prose.append(line)
            continue

        if match:
            marker = match.group(1)
            if marker[0] == opening[0] and len(marker) >= opening[1] and not match.group(2).strip():
                opening = None

    if opening is not None:
        raise ValueError(f"{path}: unclosed fenced code block")
    return "".join(prose), fence_count


def count_characters(prose: str) -> int:
    text = MARKDOWN_IMAGE.sub(r"\1", prose)
    text = REFERENCE_IMAGE.sub(r"\1", text)
    text = MARKDOWN_LINK.sub(r"\1", text)
    text = REFERENCE_LINK.sub(r"\1", text)
    text = AUTOLINK.sub("", text)
    text = INLINE_CODE.sub("", text)
    text = HTML_TAG.sub("", text)
    text = HEXO_TAG.sub("", text)
    text = URL.sub("", text)
    text = MARKDOWN_SYNTAX.sub("", text)
    return sum(character.isalnum() for character in text)


def metrics(path: Path) -> ContentMetrics:
    body = HTML_COMMENT.sub("", markdown_body(path))
    prose, fence_count = split_prose_and_count_fences(path, body)
    images = (
        len(MARKDOWN_IMAGE.findall(prose))
        + len(REFERENCE_IMAGE.findall(prose))
        + len(HTML_IMAGE.findall(prose))
        + len(HEXO_IMAGE.findall(prose))
    )
    links = (
        len(MARKDOWN_LINK.findall(prose))
        + len(REFERENCE_LINK.findall(prose))
        + len(AUTOLINK.findall(prose))
        + len(HTML_LINK.findall(prose))
    )
    return ContentMetrics(count_characters(prose), fence_count, images, links)


def compare_metrics(
    relative_path: Path,
    source_language: str,
    target_language: str,
    source: ContentMetrics,
    target: ContentMetrics,
) -> list[str]:
    errors: list[str] = []
    coefficient = CHARACTER_CONVERSION_COEFFICIENTS.get(
        (source_language, target_language)
    )
    if coefficient is None:
        return [
            f"{relative_path.as_posix()}: no character-ratio rule configured for "
            f"{source_language} -> {target_language}"
        ]

    minimum = int(source.characters * coefficient)
    if source.characters and target.characters < minimum:
        ratio = target.characters / source.characters
        errors.append(
            f"{relative_path.as_posix()}: {target_language} character count "
            f"{target.characters} is below the {source_language} -> {target_language} "
            f"coefficient requirement (coefficient {coefficient:.4f}; source "
            f"{source.characters}; actual target/source {ratio:.2f}x; minimum {minimum})"
        )

    for label in ("code_fences", "images", "links"):
        source_count = getattr(source, label)
        target_count = getattr(target, label)
        if source_count != target_count:
            errors.append(
                f"{relative_path.as_posix()}: {label} differ for {source_language} -> "
                f"{target_language}: {source_count} != {target_count}"
            )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, default=Path("."))
    parser.add_argument("--source-language")
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
    skipped_count = 0
    try:
        for source_path in sorted(source_root.rglob("*.md")):
            relative_path = source_path.relative_to(source_root)
            source_metrics = metrics(source_path)
            for target_language, target_root in languages.items():
                if target_language == source_language:
                    continue
                target_path = target_root / relative_path
                if multilingual_path_is_skipped(source_path, target_path):
                    skipped_count += 1
                    continue
                if not target_path.is_file():
                    continue
                pair_count += 1
                errors.extend(
                    compare_metrics(
                        relative_path,
                        source_language,
                        target_language,
                        source_metrics,
                        metrics(target_path),
                    )
                )
    except (OSError, UnicodeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Content completeness failed with {len(errors)} error(s).", file=sys.stderr)
        return 1

    print(
        f"Content completeness passed: {pair_count} pair(s), "
        f"source language={source_language}, skipped={skipped_count}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
