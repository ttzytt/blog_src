"""Shared, dependency-free helpers for multilingual front matter controls."""

from __future__ import annotations

import re
from pathlib import Path


SKIP_MULTILINGUAL_CHECK_FIELD = "skip_multilingual_check"
TOP_LEVEL_FIELD = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$")
BOOLEAN_VALUE = re.compile(r"^(true|false)\s*(?:#.*)?$", re.IGNORECASE)


def front_matter_lines(path: Path) -> list[tuple[int, str]] | None:
    """Return YAML front matter as ``(line number, text)`` pairs."""

    lines = path.read_text(encoding="utf-8-sig").splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return list(enumerate(lines[1:index], start=2))
    raise ValueError(f"{path}: missing closing front matter delimiter")


def skip_multilingual_check(path: Path) -> bool:
    """Read the strict top-level ``skip_multilingual_check`` YAML boolean."""

    lines = front_matter_lines(path)
    if lines is None:
        return False

    value: bool | None = None
    for line_number, line in lines:
        match = TOP_LEVEL_FIELD.match(line) if line == line.lstrip() else None
        if match is None or match.group(1) != SKIP_MULTILINGUAL_CHECK_FIELD:
            continue
        if value is not None:
            raise ValueError(
                f"{path}:{line_number}: duplicate field "
                f"{SKIP_MULTILINGUAL_CHECK_FIELD!r}"
            )
        boolean = BOOLEAN_VALUE.fullmatch(match.group(2).strip())
        if boolean is None:
            raise ValueError(
                f"{path}:{line_number}: {SKIP_MULTILINGUAL_CHECK_FIELD} must be "
                "the YAML boolean true or false (not a quoted string)"
            )
        value = boolean.group(1).lower() == "true"
    return value or False


def multilingual_path_is_skipped(*paths: Path) -> bool:
    """Return true when any existing language variant opts the path out."""

    return any(path.is_file() and skip_multilingual_check(path) for path in paths)
