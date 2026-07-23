"""Translated body length and Markdown structure rule."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..markdown import ContentMetrics, MarkdownAnalyzer
from ..models import CheckResult
from .base import ProjectCheck

DEFAULT_COEFFICIENTS = {
    ("en", "zh-CN"): 1 / 1.5,
    ("zh-CN", "en"): 1.5,
}


@dataclass
class ContentCompletenessCheck(ProjectCheck):
    source_language: str | None = None
    coefficients: dict[tuple[str, str], float] = field(
        default_factory=lambda: dict(DEFAULT_COEFFICIENTS)
    )
    analyzer: MarkdownAnalyzer = field(default_factory=MarkdownAnalyzer)

    def run(self) -> CheckResult:
        result = CheckResult("Content completeness")
        source_language = self.source_language or self.project.default_language
        if source_language not in self.project.languages:
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
                    source_metrics = self.analyzer.analyze(
                        self.project.document(source_path)
                    )
                    target_metrics = self.analyzer.analyze(
                        self.project.document(target_path)
                    )
                    result.checked += 1
                    self._compare(
                        result,
                        relative_path.as_posix(),
                        source_language,
                        target_language,
                        source_metrics,
                        target_metrics,
                    )
                except (OSError, UnicodeError, ValueError) as error:
                    result.error(str(error), relative_path)
        result.details["source_language"] = source_language
        return result

    def _compare(
        self,
        result: CheckResult,
        relative_path: str,
        source_language: str,
        target_language: str,
        source: ContentMetrics,
        target: ContentMetrics,
    ) -> None:
        coefficient = self.coefficients.get((source_language, target_language))
        if coefficient is None:
            result.error(
                f"no character-ratio rule configured for {source_language} -> "
                f"{target_language}",
            )
            return
        minimum = int(source.characters * coefficient)
        if source.characters and target.characters < minimum:
            ratio = target.characters / source.characters
            result.error(
                f"{target_language} character count {target.characters} is below the "
                f"{source_language} -> {target_language} coefficient requirement "
                f"(coefficient {coefficient:.4f}; source {source.characters}; actual "
                f"target/source {ratio:.2f}x; minimum {minimum})",
            )
        for label in ("code_fences", "images", "links"):
            source_count = getattr(source, label)
            target_count = getattr(target, label)
            if source_count != target_count:
                result.error(
                    f"{label} differ for {source_language} -> {target_language}: "
                    f"{source_count} != {target_count}",
                )
