"""Hexo project discovery and cached article access."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .frontmatter import FrontMatterParser, HexoDocument, UniqueKeySafeLoader


@dataclass(frozen=True)
class LanguageTree:
    language: str
    root: Path


@dataclass
class HexoProject:
    root: Path
    parser: FrontMatterParser = field(default_factory=FrontMatterParser)
    _documents: dict[Path, HexoDocument] = field(default_factory=dict, init=False)

    def __post_init__(self) -> None:
        self.root = self.root.resolve()
        self.languages = self._discover_languages()
        if len(self.languages) < 2:
            raise ValueError("fewer than two language source roots were discovered")

    def _load_yaml(self, path: Path) -> dict[str, Any]:
        if not path.is_file():
            raise ValueError(f"missing {path}")
        try:
            value = yaml.load(
                path.read_text(encoding="utf-8-sig"), Loader=UniqueKeySafeLoader
            )
        except yaml.YAMLError as error:
            raise ValueError(f"{path}: invalid YAML: {error}") from error
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValueError(f"{path}: configuration must be a YAML mapping")
        return value

    def _discover_languages(self) -> dict[str, LanguageTree]:
        base = self._load_yaml(self.root / "_config.yml")
        default_language = str(base.get("language") or "default")
        default_source = str(base.get("source_dir") or "source")
        languages = {
            default_language: LanguageTree(default_language, self.root / default_source)
        }
        for config_path in sorted(self.root.glob("config-*.yml")):
            config = self._load_yaml(config_path)
            if not config.get("source_dir"):
                continue
            language = str(
                config.get("language") or config_path.stem.removeprefix("config-")
            )
            tree = LanguageTree(language, self.root / str(config["source_dir"]))
            previous = languages.get(language)
            if previous is not None and previous.root != tree.root:
                raise ValueError(
                    f"language {language!r} has multiple source roots: "
                    f"{previous.root} and {tree.root}"
                )
            languages[language] = tree
        for tree in languages.values():
            if not tree.root.is_dir():
                raise ValueError(
                    f"source root for {tree.language} does not exist: {tree.root}"
                )
        return languages

    @property
    def default_language(self) -> str:
        return next(iter(self.languages))

    def markdown_files(self, language: str) -> dict[Path, Path]:
        tree = self.languages[language]
        return {path.relative_to(tree.root): path for path in tree.root.rglob("*.md")}

    def all_relative_paths(self) -> set[Path]:
        return set().union(
            *(set(self.markdown_files(language)) for language in self.languages)
        )

    def document(self, path: Path) -> HexoDocument:
        resolved = path.resolve()
        if resolved not in self._documents:
            self._documents[resolved] = self.parser.parse(resolved)
        return self._documents[resolved]

    def variants(self, relative_path: Path) -> Iterator[tuple[str, Path]]:
        for language, tree in self.languages.items():
            path = tree.root / relative_path
            if path.is_file():
                yield language, path

    def path_is_skipped(self, relative_path: Path) -> bool:
        return any(
            self.document(path).skips_multilingual_check
            for _, path in self.variants(relative_path)
        )
