from __future__ import annotations

from pathlib import Path

from hexo_multilingual_ci.checks import (
    ContentCompletenessCheck,
    FrontMatterConsistencyCheck,
    LanguageCoverageCheck,
    TaxonomyCheck,
)
from hexo_multilingual_ci.project import HexoProject
from hexo_multilingual_ci.runner import ValidationRunner

GLOSSARY_HEADER = "type,source_language,target_language,source,target,context,note\n"
SOURCE_FRONT_MATTER = """\
title: 源文章
date: 2026-01-01 00:00:00
tags:
- 系统
categories:
- 笔记
skip_multilingual_check: false
"""
TARGET_FRONT_MATTER = """\
title: Target post
date: 2026-01-01 00:00:00
tags:
- Systems
categories:
- Notes
skip_multilingual_check: false
"""
SOURCE_BODY = "中文正文内容"
TARGET_BODY = "A sufficiently long translated article body"


def write_post(path: Path, front_matter: str, body: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"---\n{front_matter}---\n{body}\n", encoding="utf-8")


def make_project(
    root: Path,
    *,
    source_front_matter: str = SOURCE_FRONT_MATTER,
    target_front_matter: str | None = TARGET_FRONT_MATTER,
    source_body: str = SOURCE_BODY,
    target_body: str = TARGET_BODY,
) -> tuple[HexoProject, Path]:
    (root / "_config.yml").write_text(
        "language: zh-CN\nsource_dir: source\n", encoding="utf-8"
    )
    (root / "config-en.yml").write_text(
        "language: en\nsource_dir: source-en\n", encoding="utf-8"
    )
    write_post(
        root / "source" / "_posts" / "example.md",
        source_front_matter,
        source_body,
    )
    (root / "source-en" / "_posts").mkdir(parents=True)
    if target_front_matter is not None:
        write_post(
            root / "source-en" / "_posts" / "example.md",
            target_front_matter,
            target_body,
        )
    glossary = root / "translation-glossary-zh-en.csv"
    glossary.write_text(
        GLOSSARY_HEADER
        + "tag,zh-CN,en,系统,Systems,,\n"
        + "category,zh-CN,en,笔记,Notes,,\n",
        encoding="utf-8",
    )
    return HexoProject(root), glossary


def test_validation_runner_accepts_valid_project(tmp_path: Path) -> None:
    project, glossary = make_project(tmp_path)

    results = ValidationRunner(project, glossary).all()

    assert all(result.passed for result in results)
    assert [result.checked for result in results] == [1, 1, 1, 1]
    assert [result.skipped for result in results] == [0, 0, 0, 0]


def test_skip_on_one_variant_exempts_the_path_from_all_checks(
    tmp_path: Path,
) -> None:
    source = SOURCE_FRONT_MATTER.replace(
        "skip_multilingual_check: false", "skip_multilingual_check: true"
    )
    target = TARGET_FRONT_MATTER.replace("skip_multilingual_check: false\n", "")
    project, glossary = make_project(
        tmp_path,
        source_front_matter=source,
        target_front_matter=target,
        target_body="",
    )

    results = ValidationRunner(project, glossary).all()

    assert all(result.passed for result in results)
    assert [result.checked for result in results] == [0, 0, 0, 0]
    assert [result.skipped for result in results] == [1, 1, 1, 1]


def test_coverage_reports_a_missing_language_variant(tmp_path: Path) -> None:
    project, _ = make_project(tmp_path, target_front_matter=None)

    result = LanguageCoverageCheck(project, strict=True).run()

    assert not result.passed
    assert [finding.message for finding in result.errors] == ["missing in en"]


def test_front_matter_reports_nonlocalized_field_difference(tmp_path: Path) -> None:
    target = TARGET_FRONT_MATTER.replace(
        "date: 2026-01-01 00:00:00", "date: 2026-01-02 00:00:00"
    )
    project, _ = make_project(tmp_path, target_front_matter=target)

    result = FrontMatterConsistencyCheck(project, "zh-CN").run()

    assert not result.passed
    assert any("'date' differs from source" in item.message for item in result.errors)


def test_taxonomy_and_content_report_translation_regressions(tmp_path: Path) -> None:
    target = TARGET_FRONT_MATTER.replace("- Systems", "- Wrong")
    project, glossary = make_project(
        tmp_path,
        target_front_matter=target,
        target_body="short",
    )

    taxonomy = TaxonomyCheck(project, glossary, "zh-CN", "en").run()
    content = ContentCompletenessCheck(project, "zh-CN").run()

    assert not taxonomy.passed
    assert any("tags mismatch" in item.message for item in taxonomy.errors)
    assert not content.passed
    assert any("character count" in item.message for item in content.errors)
