# Hexo Multilingual CI

Typed, class-based multilingual validation for the parent Hexo project.

```shell
uv --directory ci_tools run multilingual-ci check --project-root ..
uv --directory ci_tools run multilingual-ci coverage --project-root .. --strict
uv --directory ci_tools run pytest
```

The package uses PyYAML for Hexo configuration and front matter, Typer for the
command line, and Rich for diagnostics. `uv.lock` pins both runtime and
development dependencies. Production npm and GitHub Actions entry points use
the `multilingual-ci` command.

Tests use isolated Hexo project fixtures so that rule behavior does not depend
on the repository's current articles.

`skip_multilingual_check: true` is a path-wide opt-out: when any existing
language variant sets it, taxonomy, coverage, front matter, and content checks
all skip that relative path.
