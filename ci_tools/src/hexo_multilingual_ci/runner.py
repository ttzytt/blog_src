"""Application service composing project validation rules."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .checks import (
    ContentCompletenessCheck,
    FrontMatterConsistencyCheck,
    LanguageCoverageCheck,
    TaxonomyCheck,
)
from .models import CheckResult
from .project import HexoProject


@dataclass
class ValidationRunner:
    project: HexoProject
    glossary_path: Path
    source_language: str | None = None
    target_language: str = "en"

    def all(self) -> list[CheckResult]:
        source = self.source_language or self.project.default_language
        return [
            TaxonomyCheck(
                self.project,
                self.glossary_path,
                source,
                self.target_language,
            ).run(),
            LanguageCoverageCheck(self.project, strict=True).run(),
            FrontMatterConsistencyCheck(self.project, source).run(),
            ContentCompletenessCheck(self.project, source).run(),
        ]
