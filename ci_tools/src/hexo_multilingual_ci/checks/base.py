"""Base validation abstraction."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from ..models import CheckResult
from ..project import HexoProject


@dataclass
class ProjectCheck(ABC):
    project: HexoProject

    @abstractmethod
    def run(self) -> CheckResult: ...
