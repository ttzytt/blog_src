# Hexo Multilingual CI

Typed, class-based multilingual validation for the parent Hexo project.

```shell
uv --directory ci_tools run multilingual-ci check --project-root ..
uv --directory ci_tools run multilingual-ci coverage --project-root .. --strict
uv --directory ci_tools run pytest
```

The package uses PyYAML for Hexo configuration and front matter, Typer for the
command line, and Rich for diagnostics. `uv.lock` pins both runtime and
development dependencies. The original standalone scripts remain in this
directory as the behavioral comparison baseline; production npm and GitHub
Actions entry points use the `multilingual-ci` command.

The parity suite compares language discovery, skip decisions, parsed taxonomy,
Markdown metrics, front matter results, and aggregate counts against those
retained scripts for every current article.
