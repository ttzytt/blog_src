"""Markdown structural metrics shared by completeness checks."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .frontmatter import HexoDocument

FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
MACHINE_WARNING = re.compile(
    r"\{%\s*note\s+danger\s+simple\s*%\}.*?\{%\s*endnote\s*%\}",
    re.DOTALL | re.IGNORECASE,
)
MARKDOWN_IMAGE = re.compile(r"!\[([^]]*)\]\([^\n)]*\)")
REFERENCE_IMAGE = re.compile(r"!\[([^]]*)\]\[[^]]*\]")
MARKDOWN_LINK = re.compile(r"(?<!!)\[([^]]+)\]\([^\n)]*\)")
REFERENCE_LINK = re.compile(r"(?<!!)\[([^]]+)\]\[[^]]*\]")
AUTOLINK = re.compile(r"<https?://[^>]+>", re.IGNORECASE)
HTML_IMAGE = re.compile(r"<img\b", re.IGNORECASE)
HTML_LINK = re.compile(r"<a\b", re.IGNORECASE)
HEXO_IMAGE = re.compile(r"\{%\s*(?:asset_img|image)\b", re.IGNORECASE)
INLINE_CODE = re.compile(r"(`+)(.+?)\1", re.DOTALL)
HTML_TAG = re.compile(r"</?[A-Za-z][^>]*>")
HEXO_TAG = re.compile(r"\{%.*?%\}", re.DOTALL)
URL = re.compile(r"https?://[^\s)>]+", re.IGNORECASE)
MARKDOWN_SYNTAX = re.compile(r"[*_~#>|{}\[\]()]")


@dataclass(frozen=True)
class ContentMetrics:
    characters: int
    code_fences: int
    images: int
    links: int


class MarkdownAnalyzer:
    def analyze(self, document: HexoDocument) -> ContentMetrics:
        body = MACHINE_WARNING.sub("", document.body, count=1)
        body = HTML_COMMENT.sub("", body)
        prose, fences = self._prose_and_fences(document, body)
        return ContentMetrics(
            self._character_count(prose),
            fences,
            len(MARKDOWN_IMAGE.findall(prose))
            + len(REFERENCE_IMAGE.findall(prose))
            + len(HTML_IMAGE.findall(prose))
            + len(HEXO_IMAGE.findall(prose)),
            len(MARKDOWN_LINK.findall(prose))
            + len(REFERENCE_LINK.findall(prose))
            + len(AUTOLINK.findall(prose))
            + len(HTML_LINK.findall(prose)),
        )

    def _prose_and_fences(self, document: HexoDocument, body: str) -> tuple[str, int]:
        prose: list[str] = []
        opening: tuple[str, int] | None = None
        fence_count = 0
        for line in body.splitlines(keepends=True):
            match = FENCE.match(line.rstrip("\r\n"))
            if opening is None:
                if match:
                    marker = match.group(1)
                    opening = marker[0], len(marker)
                    fence_count += 1
                else:
                    prose.append(line)
            elif match:
                marker = match.group(1)
                if (
                    marker[0] == opening[0]
                    and len(marker) >= opening[1]
                    and not match.group(2).strip()
                ):
                    opening = None
        if opening is not None:
            raise ValueError(f"{document.path}: unclosed fenced code block")
        return "".join(prose), fence_count

    def _character_count(self, prose: str) -> int:
        text = MARKDOWN_IMAGE.sub(r"\1", prose)
        text = REFERENCE_IMAGE.sub(r"\1", text)
        text = MARKDOWN_LINK.sub(r"\1", text)
        text = REFERENCE_LINK.sub(r"\1", text)
        text = AUTOLINK.sub("", text)
        text = INLINE_CODE.sub("", text)
        text = HTML_TAG.sub("", text)
        text = HEXO_TAG.sub("", text)
        text = URL.sub("", text)
        text = MARKDOWN_SYNTAX.sub("", text)
        return sum(character.isalnum() for character in text)
