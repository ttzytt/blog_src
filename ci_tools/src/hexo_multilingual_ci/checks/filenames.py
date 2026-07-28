"""Post filename policy."""

from __future__ import annotations

import re

from ..models import CheckResult
from .base import ProjectCheck

POST_FILENAME_PATTERN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\.md")


class PostFilenameCheck(ProjectCheck):
    def run(self) -> CheckResult:
        result = CheckResult("Post filenames")
        counts: dict[str, int] = {}

        for language, tree in self.project.languages.items():
            posts_root = tree.root / "_posts"
            paths = sorted(
                path
                for path in posts_root.rglob("*")
                if path.is_file() and path.suffix.casefold() == ".md"
            )
            counts[language] = len(paths)

            for path in paths:
                result.checked += 1
                if POST_FILENAME_PATTERN.fullmatch(path.name) is None:
                    result.error(
                        "post filename must contain only lowercase a-z, 0-9, "
                        "and single hyphens between segments",
                        path.relative_to(self.project.root),
                    )

        result.details["languages"] = counts
        return result
