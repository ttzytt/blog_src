from __future__ import annotations

from pathlib import Path

import pytest

from hexo_multilingual_ci.frontmatter import FrontMatterParser


def write_post(path: Path, front_matter: str) -> Path:
    path.write_text(f"---\n{front_matter}\n---\nBody\n", encoding="utf-8")
    return path


def test_skip_boolean_is_typed(tmp_path: Path) -> None:
    document = FrontMatterParser().parse(
        write_post(tmp_path / "post.md", "skip_multilingual_check: true")
    )
    assert document.skips_multilingual_check is True


def test_quoted_skip_boolean_is_rejected(tmp_path: Path) -> None:
    document = FrontMatterParser().parse(
        write_post(tmp_path / "post.md", 'skip_multilingual_check: "true"')
    )
    with pytest.raises(ValueError, match="must be the YAML boolean"):
        _ = document.skips_multilingual_check


def test_yaml_11_boolean_alias_is_rejected_like_hexo(tmp_path: Path) -> None:
    document = FrontMatterParser().parse(
        write_post(tmp_path / "post.md", "skip_multilingual_check: yes")
    )
    with pytest.raises(ValueError, match="must be the YAML boolean"):
        _ = document.skips_multilingual_check


def test_duplicate_front_matter_key_is_rejected(tmp_path: Path) -> None:
    path = write_post(tmp_path / "post.md", "title: First\ntitle: Second")
    with pytest.raises(ValueError, match="duplicate key"):
        FrontMatterParser().parse(path)
