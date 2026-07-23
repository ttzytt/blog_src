"""Paired front matter consistency rule."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..models import CheckResult
from .base import ProjectCheck

DEFAULT_LOCALIZED_FIELDS = frozenset(
    {"title", "tags", "categories", "keywords", "description", "lang"}
)


@dataclass
class FrontMatterConsistencyCheck(ProjectCheck):
    source_language: str | None = None
    localized_fields: frozenset[str] = field(
        default_factory=lambda: DEFAULT_LOCALIZED_FIELDS
    )

    def run(self) -> CheckResult:
        result = CheckResult("Front matter consistency")
        source_language = self.source_language or self.project.default_language
        source_tree = self.project.languages.get(source_language)
        if source_tree is None:
            result.error(f"unknown source language {source_language!r}")
            return result

        for relative_path, source_path in sorted(
            self.project.markdown_files(source_language).items()
        ):
            for target_language, target_tree in self.project.languages.items():
                if target_language == source_language:
                    continue
                target_path = target_tree.root / relative_path
                try:
                    if self.project.path_is_skipped(relative_path):
                        result.skipped += 1
                        continue
                    if not target_path.is_file():
                        continue
                    result.checked += 1
                    self._compare_pair(source_path, target_path, result)
                except (OSError, UnicodeError, ValueError) as error:
                    result.error(str(error), relative_path)
        result.details["source_language"] = source_language
        return result

    def _compare_pair(
        self, source_path: Path, target_path: Path, result: CheckResult
    ) -> None:
        source = self.project.document(source_path).front_matter
        target = self.project.document(target_path).front_matter
        if source is None and target is None:
            return
        if source is None:
            result.error(
                f"has front matter while source {source_path} does not", target_path
            )
            return
        if target is None:
            result.error(
                f"missing front matter present in source {source_path}", target_path
            )
            return
        missing = sorted(source.keys() - target.keys())
        extra = sorted(target.keys() - source.keys())
        if missing:
            result.error(f"missing field(s): {', '.join(missing)}", target_path)
        if extra:
            result.error(f"extra field(s): {', '.join(extra)}", target_path)
        for key in sorted((source.keys() & target.keys()) - self.localized_fields):
            if not self._equivalent(source[key], target[key]):
                result.error(
                    f"{key!r} differs from source {source_path}: "
                    f"{target[key]!r} != {source[key]!r}",
                    target_path,
                )

    @staticmethod
    def _equivalent(source: Any, target: Any) -> bool:
        return bool(source == target)
