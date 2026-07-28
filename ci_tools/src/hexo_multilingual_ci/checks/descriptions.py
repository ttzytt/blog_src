"""Post description presence and length policy."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..models import CheckResult
from .base import ProjectCheck

DEFAULT_DESCRIPTION_LIMITS: dict[str, tuple[int, int]] = {
    "zh-CN": (50, 160),
    "en": (120, 160),
}


@dataclass
class PostDescriptionCheck(ProjectCheck):
    limits: dict[str, tuple[int, int]] = field(
        default_factory=lambda: DEFAULT_DESCRIPTION_LIMITS.copy()
    )

    def run(self) -> CheckResult:
        result = CheckResult("Post descriptions")
        counts: dict[str, int] = {}

        for language, tree in self.project.languages.items():
            bounds = self.limits.get(language)
            if bounds is None:
                result.error(
                    f"no description length limits configured for {language!r}"
                )
                continue
            minimum, maximum = bounds

            posts_root = tree.root / "_posts"
            paths = sorted(
                path
                for path in posts_root.rglob("*")
                if path.is_file() and path.suffix.casefold() == ".md"
            )
            counts[language] = len(paths)

            for path in paths:
                result.checked += 1
                relative_path = path.relative_to(self.project.root)
                try:
                    front_matter = self.project.document(path).front_matter
                except (OSError, UnicodeError, ValueError) as error:
                    result.error(str(error), relative_path)
                    continue

                if front_matter is None:
                    result.error("missing YAML front matter", relative_path)
                    continue

                description = front_matter.get("description")
                if not isinstance(description, str) or not description.strip():
                    result.error(
                        "description must be a non-empty string", relative_path
                    )
                    continue

                normalized = " ".join(description.split())
                length = len(normalized)
                if length < minimum:
                    result.error(
                        f"description has {length} characters; minimum for "
                        f"{language} is {minimum}",
                        relative_path,
                    )
                elif length > maximum:
                    result.error(
                        f"description has {length} characters; maximum for "
                        f"{language} is {maximum}",
                        relative_path,
                    )

        result.details["languages"] = counts
        result.details["limits"] = self.limits
        return result
