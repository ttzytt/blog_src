"""Shared immutable domain models."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Any


class Severity(StrEnum):
    ERROR = "error"
    WARNING = "warning"


@dataclass(frozen=True)
class Finding:
    severity: Severity
    message: str
    path: Path | None = None


@dataclass
class CheckResult:
    name: str
    checked: int = 0
    skipped: int = 0
    findings: list[Finding] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)

    @property
    def errors(self) -> list[Finding]:
        return [item for item in self.findings if item.severity is Severity.ERROR]

    @property
    def warnings(self) -> list[Finding]:
        return [item for item in self.findings if item.severity is Severity.WARNING]

    @property
    def passed(self) -> bool:
        return not self.errors

    def error(self, message: str, path: Path | None = None) -> None:
        self.findings.append(Finding(Severity.ERROR, message, path))

    def warning(self, message: str, path: Path | None = None) -> None:
        self.findings.append(Finding(Severity.WARNING, message, path))
