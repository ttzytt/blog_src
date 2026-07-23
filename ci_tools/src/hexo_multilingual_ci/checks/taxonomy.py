"""CSV taxonomy mapping rule."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..glossary import Glossary, TaxonomyKey
from ..models import CheckResult
from .base import ProjectCheck

TAXONOMY_FIELDS = {"tags": "tag", "categories": "category"}


@dataclass
class TaxonomyCheck(ProjectCheck):
    glossary_path: Path
    source_language: str = "zh-CN"
    target_language: str = "en"

    def run(self) -> CheckResult:
        result = CheckResult("Taxonomy")
        source_tree = self.project.languages.get(self.source_language)
        target_tree = self.project.languages.get(self.target_language)
        if source_tree is None or target_tree is None:
            result.error(
                f"unknown language direction {self.source_language} -> "
                f"{self.target_language}"
            )
            return result
        glossary = Glossary.load(self.glossary_path, result)
        mappings = glossary.direction(self.source_language, self.target_language)
        observed: set[TaxonomyKey] = set()

        for relative_path, source_path in sorted(
            self.project.markdown_files(self.source_language).items()
        ):
            target_path = target_tree.root / relative_path
            try:
                if self.project.path_is_skipped(relative_path):
                    result.skipped += 1
                    continue
                source = self._taxonomy(source_path)
                target = self._taxonomy(target_path) if target_path.is_file() else None
                if target is not None:
                    result.checked += 1
                for field, taxonomy_type in TAXONOMY_FIELDS.items():
                    expected: list[str] = []
                    for source_value in source[field]:
                        key = taxonomy_type, source_value
                        observed.add(key)
                        target_value = mappings.get(key)
                        if target_value is None:
                            result.error(
                                f"missing glossary {taxonomy_type} mapping for "
                                f"{source_value!r}",
                                relative_path,
                            )
                        else:
                            expected.append(target_value)
                    if (
                        target is not None
                        and len(expected) == len(source[field])
                        and target[field] != expected
                    ):
                        result.error(
                            f"{field} mismatch; expected {expected!r}, "
                            f"got {target[field]!r}",
                            relative_path,
                        )
            except (OSError, UnicodeError, ValueError) as error:
                result.error(str(error), relative_path)

        for taxonomy_type, source_value in sorted(set(mappings) - observed):
            result.warning(
                f"unused glossary {taxonomy_type} mapping for {source_value!r}",
                self.glossary_path,
            )
        result.details["observed"] = len(observed)
        result.details["source_language"] = self.source_language
        result.details["target_language"] = self.target_language
        return result

    def _taxonomy(self, path: Path) -> dict[str, list[str]]:
        front_matter = self.project.document(path).front_matter or {}
        return {
            field: self._string_list(front_matter.get(field), path, field)
            for field in TAXONOMY_FIELDS
        }

    @staticmethod
    def _string_list(value: Any, path: Path, field: str) -> list[str]:
        if value is None:
            return []
        values = value if isinstance(value, list) else [value]
        if not all(
            isinstance(item, (str, int, float)) and not isinstance(item, bool)
            for item in values
        ):
            raise ValueError(f"{path}: {field} must contain only scalar names")
        return [str(item) for item in values]
