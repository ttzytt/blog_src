"""Typer command-line interface."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console

from .checks import (
    ContentCompletenessCheck,
    FrontMatterConsistencyCheck,
    LanguageCoverageCheck,
    TaxonomyCheck,
)
from .models import CheckResult
from .project import HexoProject
from .reporter import ResultReporter
from .runner import ValidationRunner

app = typer.Typer(no_args_is_help=True, pretty_exceptions_show_locals=False)
console = Console(stderr=True)
ProjectRoot = Annotated[
    Path,
    typer.Option("--project-root", exists=True, file_okay=False, resolve_path=True),
]
OutputFormat = Annotated[str, typer.Option("--format", help="rich or json")]


def _project(root: Path) -> HexoProject:
    try:
        return HexoProject(root)
    except (OSError, UnicodeError, ValueError) as error:
        console.print(f"[bold red]ERROR[/bold red] {error}")
        raise typer.Exit(1) from error


def _finish(results: list[CheckResult], output_format: str) -> None:
    if output_format not in {"rich", "json"}:
        console.print("[bold red]ERROR[/bold red] --format must be rich or json")
        raise typer.Exit(2)
    reporter_console = Console() if output_format == "json" else console
    ResultReporter(reporter_console).render(results, output_format)
    if any(not result.passed for result in results):
        raise typer.Exit(1)


@app.command("check")
def check_all(
    project_root: ProjectRoot = Path(".."),
    glossary: Annotated[Path, typer.Option("--glossary")] = Path(
        "translation-glossary-zh-en.csv"
    ),
    source_language: Annotated[str | None, typer.Option()] = None,
    target_language: Annotated[str, typer.Option()] = "en",
    output_format: OutputFormat = "rich",
) -> None:
    project = _project(project_root)
    glossary_path = glossary if glossary.is_absolute() else project.root / glossary
    _finish(
        ValidationRunner(
            project, glossary_path, source_language, target_language
        ).all(),
        output_format,
    )


@app.command()
def coverage(
    project_root: ProjectRoot = Path(".."),
    strict: Annotated[bool, typer.Option("--strict/--no-strict")] = True,
    output_format: OutputFormat = "rich",
) -> None:
    result = LanguageCoverageCheck(_project(project_root), strict).run()
    _finish([result], output_format)


@app.command("front-matter")
def front_matter(
    project_root: ProjectRoot = Path(".."),
    source_language: Annotated[str | None, typer.Option()] = None,
    output_format: OutputFormat = "rich",
) -> None:
    project = _project(project_root)
    _finish(
        [FrontMatterConsistencyCheck(project, source_language).run()], output_format
    )


@app.command()
def content(
    project_root: ProjectRoot = Path(".."),
    source_language: Annotated[str | None, typer.Option()] = None,
    output_format: OutputFormat = "rich",
) -> None:
    project = _project(project_root)
    _finish([ContentCompletenessCheck(project, source_language).run()], output_format)


@app.command()
def taxonomy(
    project_root: ProjectRoot = Path(".."),
    glossary: Annotated[Path, typer.Option("--glossary")] = Path(
        "translation-glossary-zh-en.csv"
    ),
    source_language: Annotated[str, typer.Option()] = "zh-CN",
    target_language: Annotated[str, typer.Option()] = "en",
    output_format: OutputFormat = "rich",
) -> None:
    project = _project(project_root)
    glossary_path = glossary if glossary.is_absolute() else project.root / glossary
    _finish(
        [TaxonomyCheck(project, glossary_path, source_language, target_language).run()],
        output_format,
    )


def main() -> None:
    app()


if __name__ == "__main__":
    main()
