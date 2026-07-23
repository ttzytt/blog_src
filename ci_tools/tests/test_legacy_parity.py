"""Compare the package against the retained standalone implementation."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

from hexo_multilingual_ci.checks import (
    ContentCompletenessCheck,
    FrontMatterConsistencyCheck,
    LanguageCoverageCheck,
    TaxonomyCheck,
)
from hexo_multilingual_ci.markdown import MarkdownAnalyzer
from hexo_multilingual_ci.project import HexoProject

CI_TOOLS_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = CI_TOOLS_ROOT.parent


def load_legacy_module(name: str) -> ModuleType:
    path = CI_TOOLS_ROOT / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"legacy_{name}", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load legacy module {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


sys.path.insert(0, str(CI_TOOLS_ROOT))
legacy_content = load_legacy_module("check_content_completeness")
legacy_front_matter = load_legacy_module("check_front_matter_consistency")
legacy_coverage = load_legacy_module("check_language_coverage")
legacy_taxonomy = load_legacy_module("check_translation_taxonomy")
legacy_control = load_legacy_module("multilingual_front_matter")


def project() -> HexoProject:
    return HexoProject(PROJECT_ROOT)


def test_language_discovery_matches_legacy() -> None:
    current = project()
    legacy = legacy_coverage.discover_languages(PROJECT_ROOT)
    assert {
        language: tree.root for language, tree in current.languages.items()
    } == legacy


def test_skip_decisions_match_legacy_for_every_path() -> None:
    current = project()
    for relative_path in current.all_relative_paths():
        paths = [tree.root / relative_path for tree in current.languages.values()]
        assert current.path_is_skipped(relative_path) == (
            legacy_control.multilingual_path_is_skipped(*paths)
        )


def test_taxonomy_values_match_legacy_for_every_document() -> None:
    current = project()
    check = TaxonomyCheck(
        current,
        PROJECT_ROOT / "translation-glossary-zh-en.csv",
        "zh-CN",
        "en",
    )
    for language in current.languages:
        for path in current.markdown_files(language).values():
            assert check._taxonomy(path) == legacy_taxonomy.taxonomy_values(path)


def test_content_metrics_match_legacy_for_every_document() -> None:
    current = project()
    analyzer = MarkdownAnalyzer()
    for language in current.languages:
        for path in current.markdown_files(language).values():
            actual = analyzer.analyze(current.document(path))
            expected = legacy_content.metrics(path)
            assert (
                actual.characters,
                actual.code_fences,
                actual.images,
                actual.links,
            ) == (
                expected.characters,
                expected.code_fences,
                expected.images,
                expected.links,
            )


def test_current_repository_results_match_legacy_baseline() -> None:
    current = project()
    results = [
        TaxonomyCheck(
            current,
            PROJECT_ROOT / "translation-glossary-zh-en.csv",
            "zh-CN",
            "en",
        ).run(),
        LanguageCoverageCheck(current, strict=True).run(),
        FrontMatterConsistencyCheck(current, "zh-CN").run(),
        ContentCompletenessCheck(current, "zh-CN").run(),
    ]
    assert all(result.passed for result in results)

    source_root = current.languages["zh-CN"].root
    target_root = current.languages["en"].root
    for relative_path in current.markdown_files("zh-CN"):
        target = target_root / relative_path
        if target.is_file():
            assert not legacy_front_matter.compare_pair(
                source_root / relative_path, target
            )
