"""Hexo Markdown and YAML front matter parsing."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from yaml.constructor import ConstructorError
from yaml.resolver import BaseResolver

SKIP_FIELD = "skip_multilingual_check"


class UniqueKeySafeLoader(yaml.SafeLoader):
    """Safe YAML loader that rejects duplicate mapping keys like js-yaml."""


UniqueKeySafeLoader.yaml_implicit_resolvers = {
    character: [
        (tag, pattern) for tag, pattern in resolvers if tag != "tag:yaml.org,2002:bool"
    ]
    for character, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}
UniqueKeySafeLoader.add_implicit_resolver(  # type: ignore[no-untyped-call]
    "tag:yaml.org,2002:bool",
    re.compile(r"^(?:true|false)$", re.IGNORECASE),
    list("tTfF"),
)


def _construct_unique_mapping(
    loader: UniqueKeySafeLoader,
    node: yaml.MappingNode,
    deep: bool = False,
) -> dict[Any, Any]:
    mapping: dict[Any, Any] = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        try:
            duplicate = key in mapping
        except TypeError as error:
            raise ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                "found an unhashable key",
                key_node.start_mark,
            ) from error
        if duplicate:
            raise ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                f"found duplicate key {key!r}",
                key_node.start_mark,
            )
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


UniqueKeySafeLoader.add_constructor(
    BaseResolver.DEFAULT_MAPPING_TAG,
    _construct_unique_mapping,
)


@dataclass(frozen=True)
class HexoDocument:
    path: Path
    front_matter: dict[str, Any] | None
    body: str

    @property
    def skips_multilingual_check(self) -> bool:
        if self.front_matter is None or SKIP_FIELD not in self.front_matter:
            return False
        value = self.front_matter[SKIP_FIELD]
        if type(value) is not bool:
            raise ValueError(
                f"{self.path}: {SKIP_FIELD} must be the YAML boolean true or false "
                "(not a quoted string)"
            )
        return value


class FrontMatterParser:
    """Parse Hexo's leading YAML front matter with PyYAML."""

    def parse(self, path: Path) -> HexoDocument:
        text = path.read_text(encoding="utf-8-sig")
        lines = text.splitlines(keepends=True)
        if not lines or lines[0].strip() != "---":
            return HexoDocument(path, None, text)

        closing_index = next(
            (
                index
                for index, line in enumerate(lines[1:], start=1)
                if line.strip() == "---"
            ),
            None,
        )
        if closing_index is None:
            raise ValueError(f"{path}: missing closing front matter delimiter")

        raw = "".join(lines[1:closing_index])
        try:
            loaded = yaml.load(raw, Loader=UniqueKeySafeLoader)
        except yaml.YAMLError as error:
            raise ValueError(f"{path}: invalid YAML front matter: {error}") from error
        if loaded is None:
            data: dict[str, Any] = {}
        elif not isinstance(loaded, dict):
            raise ValueError(f"{path}: front matter must be a YAML mapping")
        else:
            if not all(isinstance(key, str) for key in loaded):
                raise ValueError(f"{path}: front matter keys must be strings")
            data = loaded
        return HexoDocument(path, data, "".join(lines[closing_index + 1 :]))
