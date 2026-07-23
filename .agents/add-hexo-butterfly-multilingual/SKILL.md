---
name: add-hexo-butterfly-multilingual
description: Add or maintain isolated multilingual support for a Hexo Butterfly site. Use when Codex must configure language-specific source and URL roots, localize Butterfly UI, preserve same-page language switching, merge builds, migrate custom styling across Butterfly versions, validate translated taxonomy, front matter, body completeness, and language coverage, or update CI and deployment. Use $translate-hexo-post for individual post or page translations.
---

# Add Hexo Butterfly Multilingual Support

Implement project-level multilingual structure, configuration, builds, navigation, deployment, and validation. Keep the existing default-language site stable.

## Project guidance

If the repository provides a multilingual design document, read it completely before changing the project. Treat it as architectural background and reconcile it with the current Hexo and Butterfly versions, the actual configuration, and verified behavior. Do not preserve an outdated implementation detail merely because it appears in an older guide.

Prefer isolated Hexo source trees and language URL roots. Derive directory names, locale codes, and URL prefixes from the repository rather than assuming a particular language pair.

## Boundaries

- Do not move or rename the existing `source/` tree.
- Do not change existing default-language URLs, stable post identifiers, or deployment destinations.
- Do not install a Hexo multilingual plugin unless the user explicitly requests a plugin-based design.
- Do not mix languages in one Hexo content database.
- Do not copy untranslated posts into a translated source tree for publication.
- Do not claim that Butterfly's `language` setting translates or isolates content.
- Keep internal links deploy-environment independent. Do not hard-code the production host for links between language versions or shared site assets.
- Preserve the current page when switching languages whenever corresponding files share the same relative route. Selecting the already active language must be a no-op.
- Preserve unrelated user changes and existing project conventions.

## Per-file translation

This skill does not translate article prose itself.

Invoke `$translate-hexo-post` for each selected post or page. Let it handle front matter fidelity, the CSV glossary, code comments, generated annotations, and the source-language warning.

Before delegation, provide `$translate-hexo-post` with:

- The source and target languages.
- The source file and corresponding target path.
- The root-relative public path of the source-language page.
- The project glossary path for that language direction.
- The stable URL identity that must remain unchanged, such as `abbrlink`, slug, or explicit permalink.

Only publish completed translations. Use the coverage validator to identify missing counterparts; do not fill a language tree with untranslated copies.

## Phase 1: Audit the existing project

Inspect before editing:

1. Hexo and Butterfly versions in package metadata and lockfiles.
2. `_config.yml` and `_config.butterfly.yml`.
3. `language`, `url`, `root`, `source_dir`, `public_dir`, theme, permalink, and pretty-URL settings.
4. Whether `hexo-abbrlink`, explicit permalinks, slugs, or another stable URL mechanism is active.
5. Whether `post_asset_folder` is enabled and how posts reference images/downloads.
6. Existing `source/` pages, including tags, categories, about, links, gallery, and other custom pages.
7. Search, Feed, Sitemap, archive, pagination, and related generators.
8. Package scripts, deployment scripts, and every relevant GitHub Actions workflow.
9. Existing multilingual files or partial changes.
10. The current worktree diff, so user changes are not overwritten.
11. The generated HTML and current Butterfly DOM for custom CSS and client-side behavior.

Resolve conflicts between the guide and the actual project explicitly. Prefer adapting the guide to verified project conventions over replacing working configuration wholesale.

## Phase 2: Establish the language layout

For each additional language, establish only the required structure, for example:

```text
source-<language>/
  _posts/
  tags/index.md
  categories/index.md
config-<language>.yml
```

Mirror additional custom pages only when they are needed and translated. Preserve each page's relative path and Butterfly-dependent front matter such as `layout`, `type`, `comments`, and image settings.

Do not manually create archive pages or individual tag/category pages when Hexo generators produce them. Keep the translated `_posts/` directory empty until real translations are available. Use a repository-appropriate placeholder only when an empty directory must be tracked.

## Phase 3: Configure the additional build

Keep `_config.yml` as the default-language base. Create a minimal language override rather than duplicating the complete configuration.

Ensure each override provides the verified equivalents of:

```yaml
language: <locale>
url: <site-url>/<language-prefix>
root: /<language-prefix>/
source_dir: source-<language>
public_dir: public/<language-prefix>
```

Do not put a space after the comma in Hexo's merged config argument:

```text
--config _config.yml,config-en.yml
```

Place language-specific Butterfly settings under the language override's `theme_config`. Do not assume Hexo automatically loads an arbitrarily named theme configuration file.

Use root-relative paths for site-local menus and resources. A path such as `/en/about/` is deploy-host independent; a production-domain URL is not. Ensure generated links contain exactly one language prefix.

## Phase 4: Implement language switching

Implement the switcher in the smallest theme-supported extension point available. It must:

- Add or remove the target language prefix from `location.pathname` while retaining the rest of the current route.
- Preserve `location.search` and `location.hash`.
- Use the current origin, not a hard-coded deployment hostname.
- Treat a click on the active language as `preventDefault()` with no navigation.
- Behave consistently in desktop and mobile navigation.
- Fall back to a language root only when the project explicitly cannot guarantee paired routes.

When files keep identical relative paths across source roots, the route transformation should map `/posts/id/` to `/<language-prefix>/posts/id/` and back. Do not introduce an article mapping table unless paths actually diverge.

## Phase 5: Preserve URL identity and assets

Keep corresponding filenames and stable permalink inputs aligned across languages. Preserve an existing `abbrlink`, slug, or explicit permalink so corresponding output follows this pattern:

```text
/posts/<stable-id>/
/en/posts/<stable-id>/
```

Treat `translation_key` as optional project metadata. Do not add or depend on it unless the user requests article pairing or the project already uses it.

Audit every asset strategy:

- Keep root-relative shared resources shared when the final build makes them available to both roots.
- Copy or synchronize post asset folders when relative references require a language-local counterpart.
- Preserve working image and download paths during translation.
- Validate CSS, JavaScript, fonts, diagrams, and downloads under the additional language root.

## Phase 6: Migrate Butterfly configuration and custom CSS

Before copying settings from an older site or tutorial, compare them with the installed Butterfly version and its official documentation or theme source. In current Butterfly releases, common migrations include:

- Search configuration under `search.use` plus the matching provider block.
- Image preview through the current `lightbox` option.
- Code-window styling through current `code_blocks` options such as `macStyle`.

Confirm exact keys against the installed version; these examples are not substitutes for version inspection.

Keep custom CSS as source content, normally under `source/css/`, so Hexo copies it into the generated site. Reference it with a root-relative URL. Never edit generated `public/css/index.css`: generated bundles are disposable build artifacts and a separately referenced custom stylesheet remains a separate output file.

When upgrading Butterfly, inspect generated HTML or the installed theme templates before adapting custom selectors. Update selectors to the current DOM, cover light and dark modes where relevant, and test desktop and mobile layouts. In particular, verify article/card transparency, code-block shadows, backgrounds, navigation, and overlays instead of assuming legacy class names still exist.

## Phase 7: Compose the build and deployment

Use separate Hexo processes/configurations while merging output into one deployable `public/` tree. Preserve the conceptual order:

```text
hexo clean
build default language -> public/
build additional languages -> their public subdirectories
deploy public/
```

Add clear per-language package scripts, then make the main build run all languages without cleaning away earlier output. Clean once at the beginning. If a wrapper script is required for safe output merging, explain why theme/Hexo configuration alone cannot compose multiple processes, keep the script small, always clean temporary directories, and surface error text even when a child process exits successfully.

Update CI to run the composed build and continue deploying only `public/`. Preserve unrelated deployment behavior, credentials, commit metadata, and existing safety checks.

Prevent Search, Feed, Sitemap, archive, pagination, tags, and categories from overwriting another language or ingesting its posts.

## Phase 8: Add programmatic multilingual checks

Store translations in a machine-readable CSV glossary with the exact header:

```csv
type,source_language,target_language,source,target,context,note
```

Use `tag` and `category` rows for front matter taxonomy and `term` rows for body terminology. Keep `context` and `note` empty unless ambiguity requires them. Taxonomy rows form exact mappings, including intentionally unchanged values.

Add a typed, standard-library Python checker that parses the CSV, rejects malformed or conflicting mappings, requires every source tag/category to have a mapping, and verifies every existing counterpart uses the exact mapped taxonomy. Report unused mappings as warnings.

Add a second typed Python checker that discovers language source roots from Hexo configuration and compares Markdown relative paths across all languages. It should warn about missing counterparts by default and support a strict mode for complete repositories and CI.

Add a third typed Python checker that treats one configured source language as authoritative for paired front matter. Require the same field set, allow only explicitly localized fields such as titles and translated taxonomy to differ, and compare dates, covers, top images, route identity, rendering switches, explicit empty fields, and other operational metadata. Files with no front matter in either language may be skipped; having front matter on only one side is an error.

Add a fourth typed Python checker for body completeness. Configure an explicit directional target/source character coefficient for every supported language direction and calculate `minimum target characters = source characters * coefficient`. For the alphanumeric prose counter, a conservative starting point is `1.5` for `zh-CN -> en` and `1 / 1.5` for `en -> zh-CN`; evaluate other language pairs explicitly. Measure prose after excluding front matter, the mandatory machine-warning block, fenced code, URLs, and markup syntax. Fail when the target prose falls below the calculated minimum. Also require exact equality of fenced code block, rendered image, and rendered link counts, excluding the warning's source-language link. Keep this checker structural and deterministic: it must flag likely omissions without pretending to judge translation quality, and its thresholds must not be weakened to accommodate known incomplete translations.

Support one shared top-level YAML escape hatch, `skip_multilingual_check: true`, across coverage, taxonomy, front matter, and body-completeness validation. Require an actual boolean rather than a quoted string, apply the opt-out to the whole relative path when any existing language variant declares it, and report skipped counts. Document it as an exceptional, explicit author decision; never insert it automatically to conceal missing or incomplete work.

Use the latest stable Python release supported by the CI runner, pin that version explicitly in CI, compile-check the scripts, and run all validators before building. Use modern type annotations throughout and organize scripts around small parsing, validation, reporting, argument-parsing, and `main() -> int` functions. Prefer the standard library so validation does not require a new dependency environment.

## Phase 9: Validate

Run the repository's real install/build checks. Do not stop at YAML inspection.

Verify at minimum:

- The default site still builds at `/`.
- The additional site builds at `/en/` or the requested language root.
- Each language homepage, archives, tags, and categories exist below its configured root.
- Default and translated homepages, archives, taxonomy, search indexes, feeds, and sitemaps contain only their own language content.
- Default-language URL paths are unchanged from the pre-change baseline.
- Corresponding translated posts retain stable URL identifiers.
- Language links preserve the current route, query, and fragment; active-language links do nothing.
- CSS, JavaScript, fonts, images, diagrams, and downloads do not produce broken paths.
- CI still deploys the complete `public/` directory exactly once.
- No untranslated default-language post is published under the translated root.
- Every source tag/category has a CSV mapping and existing counterparts use the mapped values.
- Every paired front matter field allowed to differ is explicitly localized; all operational metadata matches the source language.
- Every translated body meets its configured language character coefficient and preserves fenced code block, image, and link counts.
- The language coverage checker reports no missing files when strict completeness is required.
- Custom CSS is served with a CSS MIME type and targets the current Butterfly DOM.

Prefer a static server rooted at the merged `public/` directory when interactive preview is requested. A one-config `hexo server` does not represent a composed multilingual deployment.

## Handoff

Report:

- Languages and URL roots configured.
- Files created or changed.
- Existing behavior deliberately preserved.
- Build and validation results.
- Content/pages still awaiting translation.
- Any posts that can next be translated with `$translate-hexo-post`.
- Any missing counterparts or taxonomy mismatches reported by the validators.
- Deferred features such as `hreflang`, canonical refinements, or route mapping when filenames diverge.
