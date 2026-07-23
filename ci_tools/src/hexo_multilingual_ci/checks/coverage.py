"""Language tree coverage rule."""

from __future__ import annotations

from dataclasses import dataclass

from ..models import CheckResult
from .base import ProjectCheck


@dataclass
class LanguageCoverageCheck(ProjectCheck):
    strict: bool = True

    def run(self) -> CheckResult:
        result = CheckResult("Language coverage")
        files = {
            language: self.project.markdown_files(language)
            for language in self.project.languages
        }
        skipped_paths = set()
        for relative_path in sorted(self.project.all_relative_paths()):
            try:
                if self.project.path_is_skipped(relative_path):
                    result.skipped += 1
                    skipped_paths.add(relative_path)
                    continue
            except (OSError, UnicodeError, ValueError) as error:
                result.error(str(error), relative_path)
                continue
            result.checked += 1
            missing = [
                language
                for language, language_files in files.items()
                if relative_path not in language_files
            ]
            if missing:
                message = f"missing in {', '.join(missing)}"
                if self.strict:
                    result.error(message, relative_path)
                else:
                    result.warning(message, relative_path)
        result.details["languages"] = {
            language: len(set(paths) - skipped_paths)
            for language, paths in files.items()
        }
        return result
