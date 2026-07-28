from __future__ import annotations

from io import StringIO
from pathlib import Path

import pytest
from rich.console import Console

from hexo_multilingual_ci.checks import (
    ContentCompletenessCheck,
    FrontMatterConsistencyCheck,
    LanguageCoverageCheck,
    PostDescriptionCheck,
    PostFilenameCheck,
    TaxonomyCheck,
)
from hexo_multilingual_ci.models import CheckResult
from hexo_multilingual_ci.project import HexoProject
from hexo_multilingual_ci.reporter import ResultReporter
from hexo_multilingual_ci.runner import ValidationRunner

GLOSSARY_HEADER = "type,source_language,target_language,source,target,context,note\n"
SOURCE_DESCRIPTION = (
    "这是一篇用于测试多语言内容校验的中文文章摘要，内容涵盖实现思路、关键步骤、"
    "验证方法以及最终结论与分析。"
)
TARGET_DESCRIPTION = (
    "This English post description is long enough for multilingual validation "
    "and clearly summarizes the implementation, verification steps, and "
    "conclusions."
)
SOURCE_FRONT_MATTER = f"""\
title: 源文章
date: 2026-01-01 00:00:00
tags:
- 系统
categories:
- 笔记
description: {SOURCE_DESCRIPTION}
skip_multilingual_check: false
"""
TARGET_FRONT_MATTER = f"""\
title: Target post
date: 2026-01-01 00:00:00
tags:
- Systems
categories:
- Notes
description: {TARGET_DESCRIPTION}
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
    assert [result.checked for result in results] == [1, 1, 1, 1, 2, 2]
    assert [result.skipped for result in results] == [0, 0, 0, 0, 0, 0]


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
    assert [result.checked for result in results] == [0, 0, 0, 0, 2, 2]
    assert [result.skipped for result in results] == [1, 1, 1, 1, 0, 0]
    assert [[finding.path for finding in result.infos] for result in results] == [
        [Path("_posts") / "example.md"],
        [Path("_posts") / "example.md"],
        [Path("_posts") / "example.md"],
        [Path("_posts") / "example.md"],
        [],
        [],
    ]


def test_reporter_prints_each_skipped_path_once_as_info() -> None:
    path = Path("_posts") / "example.md"
    first = CheckResult("First")
    second = CheckResult("Second")
    first.skip(path)
    second.skip(path)
    output = StringIO()

    ResultReporter(
        Console(file=output, force_terminal=False, color_system=None)
    ).render([first, second])

    rendered = output.getvalue()
    assert "INFO _posts" in rendered
    assert "example.md: skipped because skip_multilingual_check is true" in rendered
    assert rendered.count("skipped because skip_multilingual_check is true") == 1


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


def test_description_check_requires_non_empty_descriptions(tmp_path: Path) -> None:
    source = SOURCE_FRONT_MATTER.replace(
        f"description: {SOURCE_DESCRIPTION}",
        "description:",
    )
    project, _ = make_project(tmp_path, source_front_matter=source)

    result = PostDescriptionCheck(project).run()

    assert not result.passed
    assert result.checked == 2
    assert [finding.message for finding in result.errors] == [
        "description must be a non-empty string"
    ]


@pytest.mark.parametrize(
    ("language", "length", "boundary", "limit"),
    [
        ("zh-CN", 49, "minimum", 50),
        ("zh-CN", 161, "maximum", 160),
        ("en", 119, "minimum", 120),
        ("en", 161, "maximum", 160),
    ],
)
def test_description_check_enforces_per_language_limits(
    tmp_path: Path,
    language: str,
    length: int,
    boundary: str,
    limit: int,
) -> None:
    source = SOURCE_FRONT_MATTER
    target = TARGET_FRONT_MATTER
    if language == "zh-CN":
        source = source.replace(
            f"description: {SOURCE_DESCRIPTION}",
            f"description: {'中' * length}",
        )
    else:
        target = target.replace(
            f"description: {TARGET_DESCRIPTION}",
            f"description: {'a' * length}",
        )
    project, _ = make_project(
        tmp_path,
        source_front_matter=source,
        target_front_matter=target,
    )

    result = PostDescriptionCheck(project).run()

    assert not result.passed
    assert [finding.message for finding in result.errors] == [
        f"description has {length} characters; {boundary} for {language} is {limit}",
    ]


def test_description_check_collapses_whitespace_before_counting(
    tmp_path: Path,
) -> None:
    description = f"{'a' * 119}{' ' * 100}b"
    target = TARGET_FRONT_MATTER.replace(
        f"description: {TARGET_DESCRIPTION}",
        f"description: {description}",
    )
    project, _ = make_project(tmp_path, target_front_matter=target)

    result = PostDescriptionCheck(project).run()

    assert result.passed


@pytest.mark.parametrize(
    "filename",
    [
        "Bad-name.md",
        "bad_name.md",
        "bad name.md",
        "bad--name.md",
        "-bad.md",
        "bad-.md",
        "bad.name.md",
    ],
)
def test_post_filename_check_rejects_noncanonical_names(
    tmp_path: Path, filename: str
) -> None:
    project, _ = make_project(tmp_path)
    source = tmp_path / "source" / "_posts" / "example.md"
    source.rename(source.with_name(filename))

    result = PostFilenameCheck(project).run()

    assert result.checked == 2
    assert [finding.path for finding in result.errors] == [
        Path("source") / "_posts" / filename
    ]
