"""Rich diagnostics and machine-readable reporting."""

from __future__ import annotations

import json
from dataclasses import dataclass

from rich.console import Console
from rich.table import Table

from .models import CheckResult, Severity


@dataclass
class ResultReporter:
    console: Console

    def render(self, results: list[CheckResult], output_format: str = "rich") -> None:
        if output_format == "json":
            self.console.print_json(
                json.dumps(
                    [
                        {
                            "name": result.name,
                            "passed": result.passed,
                            "checked": result.checked,
                            "skipped": result.skipped,
                            "details": result.details,
                            "findings": [
                                {
                                    "severity": finding.severity.value,
                                    "path": str(finding.path) if finding.path else None,
                                    "message": finding.message,
                                }
                                for finding in result.findings
                            ],
                        }
                        for result in results
                    ]
                )
            )
            return

        for result in results:
            for finding in result.findings:
                style = "bold red" if finding.severity is Severity.ERROR else "yellow"
                location = f"{finding.path}: " if finding.path else ""
                self.console.print(
                    f"[{style}]{finding.severity.value.upper()}[/{style}] "
                    f"{location}{finding.message}"
                )
        table = Table(title="Multilingual validation")
        table.add_column("Check")
        table.add_column("Status")
        table.add_column("Checked", justify="right")
        table.add_column("Skipped", justify="right")
        table.add_column("Warnings", justify="right")
        for result in results:
            status = "[green]PASS[/green]" if result.passed else "[red]FAIL[/red]"
            table.add_row(
                result.name,
                status,
                str(result.checked),
                str(result.skipped),
                str(len(result.warnings)),
            )
        self.console.print(table)
