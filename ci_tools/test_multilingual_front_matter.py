"""Tests for the shared multilingual front matter control."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from multilingual_front_matter import (
    multilingual_path_is_skipped,
    skip_multilingual_check,
)


class SkipMultilingualCheckTests(unittest.TestCase):
    def write_post(self, directory: Path, name: str, front_matter: str) -> Path:
        path = directory / name
        path.write_text(f"---\n{front_matter}\n---\nBody\n", encoding="utf-8")
        return path

    def test_true_skips_the_path(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = self.write_post(root, "source.md", "skip_multilingual_check: true")
            target = self.write_post(root, "target.md", "title: Target")
            self.assertTrue(skip_multilingual_check(source))
            self.assertTrue(multilingual_path_is_skipped(source, target))

    def test_false_and_missing_do_not_skip(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            false_post = self.write_post(
                root, "false.md", "skip_multilingual_check: false"
            )
            missing_post = self.write_post(root, "missing.md", "title: Example")
            self.assertFalse(skip_multilingual_check(false_post))
            self.assertFalse(multilingual_path_is_skipped(false_post, missing_post))

    def test_quoted_boolean_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            post = self.write_post(
                Path(temporary_directory),
                "quoted.md",
                'skip_multilingual_check: "true"',
            )
            with self.assertRaisesRegex(ValueError, "must be the YAML boolean"):
                skip_multilingual_check(post)

    def test_duplicate_field_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            post = self.write_post(
                Path(temporary_directory),
                "duplicate.md",
                "skip_multilingual_check: false\nskip_multilingual_check: true",
            )
            with self.assertRaisesRegex(ValueError, "duplicate field"):
                skip_multilingual_check(post)


if __name__ == "__main__":
    unittest.main()
