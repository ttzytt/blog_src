"""CSV-backed taxonomy glossary model."""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

from .models import CheckResult

REQUIRED_COLUMNS = (
    "type",
    "source_language",
    "target_language",
    "source",
    "target",
    "context",
    "note",
)
type TaxonomyKey = tuple[str, str]
type GlossaryIdentity = tuple[str, str, str, str, str]


@dataclass
class Glossary:
    path: Path
    mappings: dict[tuple[str, str], dict[TaxonomyKey, str]] = field(
        default_factory=dict
    )

    @classmethod
    def load(cls, path: Path, result: CheckResult) -> Glossary:
        glossary = cls(path)
        identities: dict[GlossaryIdentity, str] = {}
        if not path.is_file():
            result.error(f"glossary not found: {path}")
            return glossary
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if tuple(reader.fieldnames or ()) != REQUIRED_COLUMNS:
                result.error(f"expected CSV header {','.join(REQUIRED_COLUMNS)}", path)
                return glossary
            for line_number, raw_row in enumerate(reader, start=2):
                row = {key: (value or "").strip() for key, value in raw_row.items()}
                entry_type = row["type"]
                if entry_type not in {"tag", "category", "term"}:
                    result.error(
                        f"line {line_number}: unsupported type {entry_type!r}", path
                    )
                    continue
                if not row["source"] or not row["target"]:
                    result.error(
                        f"line {line_number}: source and target are required", path
                    )
                    continue
                if not row["source_language"] or not row["target_language"]:
                    result.error(
                        f"line {line_number}: source_language and target_language "
                        "are required",
                        path,
                    )
                    continue
                identity = (
                    entry_type,
                    row["source_language"],
                    row["target_language"],
                    row["source"],
                    row["context"],
                )
                previous = identities.get(identity)
                if previous is not None:
                    qualifier = (
                        "duplicate" if previous == row["target"] else "conflicting"
                    )
                    result.error(
                        f"line {line_number}: {qualifier} glossary entry for "
                        f"{row['source']!r}",
                        path,
                    )
                    continue
                identities[identity] = row["target"]
                if entry_type == "term":
                    continue
                if row["context"] or row["note"]:
                    result.error(
                        f"line {line_number}: taxonomy rows must not use context/note",
                        path,
                    )
                direction = row["source_language"], row["target_language"]
                mapping = glossary.mappings.setdefault(direction, {})
                key = entry_type, row["source"]
                previous = mapping.get(key)
                if previous is not None and previous != row["target"]:
                    result.error(
                        f"line {line_number}: conflicting mapping for {entry_type} "
                        f"{row['source']!r}: {previous!r} vs {row['target']!r}",
                        path,
                    )
                mapping[key] = row["target"]
        return glossary

    def direction(self, source: str, target: str) -> dict[TaxonomyKey, str]:
        return self.mappings.get((source, target), {})
