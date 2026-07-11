---
name: translate-hexo-post
description: Translate or update one Hexo Markdown post or page between language source trees while preserving copied front matter and Markdown/Hexo structure. Use after writing a page in any language to create its counterpart, maintain exact CSV-backed taxonomy and terminology mappings, translate code comments, annotate meaningful source-language strings in code, add a root-relative machine-translation warning, and run taxonomy, coverage, and front matter consistency checks.
---

# Translate a Hexo Post

Translate exactly one Hexo Markdown post or page at a time. Use this skill for every newly created language counterpart and whenever a source page changes enough that its counterpart must be synchronized. Produce a faithful translation, not an edited or improved version.

Read [references/frontmatter-and-markdown.md](references/frontmatter-and-markdown.md) and [references/glossary.md](references/glossary.md) before translating.

## Required inputs

Establish these values before writing:

- Source file.
- Source and target languages.
- Target file path.
- Root-relative public path of the source-language page.
- Persistent CSV glossary path for this language direction.

Infer values from project configuration and existing language counterparts when reliable. Ask the user when the source path, destination, or glossary location cannot be determined safely. Never emit a placeholder source link or a production-domain dependency.

Discover the default source directory from `_config.yml` and additional source directories from language config files. Preserve the complete path relative to the source root so corresponding files and generated routes remain aligned. Do not overwrite an existing target silently; inspect it and preserve intentional target-side changes.

## Workflow

1. Read the complete source before translating.
2. Separate front matter, Markdown prose, protected syntax, code, math, raw HTML, and Hexo tags.
3. Load the persistent CSV taxonomy and terminology glossary.
4. Scan the whole article for categories, tags, proper nouns, technical terms, repeated phrases, code comments, and meaningful source-language strings in code.
5. Resolve new taxonomy and terminology mappings before translating prose. Reuse locked mappings exactly. Record new mappings.
6. Copy the complete source front matter verbatim, then change only fields that the project permits to be localized. Never construct a shortened target front matter.
7. Translate the body faithfully. For a long article, split only at safe Markdown block boundaries and apply the same locked glossary to every chunk.
8. Insert the required machine-translation warning as the first rendered body block.
9. Translate code comments and add generated annotations for meaningful source-language strings as specified below.
10. Compare source and target for completeness, fidelity, structure, protected syntax, and glossary compliance.
11. Run the taxonomy and front matter consistency checkers immediately after translation. Run the language-coverage checker and the repository's build command when available and proportionate. Report any validation not run.

## Translation fidelity

- Preserve meaning, facts, logic, tone, emphasis, uncertainty, and rhetorical strength.
- Make only grammatical changes required by the target language.
- Do not rewrite, polish, optimize, summarize, reorganize, simplify, elaborate, or improve the author's expression.
- Do not add background, examples, transitions, explanations, or translator's notes.
- Do not silently correct factual, technical, or stylistic mistakes. Report a suspected source error separately without changing its meaning.
- Preserve paragraph and sentence correspondence where the target language permits.
- Preserve all Markdown and Hexo structures. Translate reader-visible prose, headings, link labels, image alt text, table prose, and captions.
- Preserve URLs, link destinations, anchors, image paths, filenames, identifiers, commands, math, and non-comment code unless a rule below explicitly permits a change.

The warning and generated code-string annotations are the only mandatory additions to source content.

## CSV glossary and taxonomy

Use a glossary with this exact header:

```csv
type,source_language,target_language,source,target,context,note
```

- Use `category` and `tag` for front matter taxonomy and `term` for body terminology.
- Treat category/tag mappings as exact. Preserve their order and list/scalar form in the translated front matter.
- Record intentionally unchanged taxonomy values too, so completeness remains programmatically checkable.
- Leave `context` and `note` empty unless a mapping is ambiguous or constrained by a special usage.
- Quote fields according to CSV rules; never split a field merely because its text contains punctuation.
- Reject duplicate or conflicting mappings instead of choosing one silently.

Before completing the file, run the project's taxonomy validator. A missing source mapping or a target taxonomy that differs from its mapped value is an error, not a stylistic choice.

## Machine-translation warning

Insert this block immediately after the closing front matter delimiter and before every other rendered block:

```text
{% note danger simple %}
<warning translated into the target language, including a Markdown link to the source-language version>
{% endnote %}
```

Express this meaning faithfully in the target language:

> The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the source-language version.

Turn “source-language version” into a root-relative Markdown link and name the actual source language, for example `[Chinese source version](/posts/example/)`. Derive the path from Hexo configuration and the stable route; do not hard-code the production domain. Include the warning exactly once. The warning is required for every machine-translated post or page.

Derive date-based routes only after copying the source `date` exactly. Never infer a target date from the translation date, filename, article topic, or neighboring posts.

All other site-local links and shared asset references should also be root-relative unless the project's route design specifically requires a language-local relative link. Never introduce a deployment hostname into translated content.

## Code handling

Translate every natural-language code comment into the target language while preserving:

- The language's comment syntax.
- Comment placement and indentation.
- Code identifiers, API names, commands, and exact technical tokens inside comments.
- Directives or machine-consumed comment syntax that would break if translated.

Do not translate non-comment code. When a string literal contains meaningful source-language text, preserve the literal and add a nearby syntax-valid comment in the target language that explains it. Mark every such added comment with the exact prefix `[generated by LLM]` so it cannot be mistaken for the author's comment.

Examples:

```cpp
puts("文件不存在");
// [generated by LLM] The preceding Chinese string means "The file does not exist."
```

```python
print("文件不存在")
# [generated by LLM] The preceding Chinese string means "The file does not exist."
```

Use the target programming language's comment syntax. Place the annotation only where it cannot change execution or invalidate the example. Annotate user-visible messages, labels, prompts, sample prose, and other semantically meaningful strings. Do not annotate opaque data, hashes, encoded content, regex fragments, URLs, paths, localization keys, or strings whose source-language characters are not semantically meaningful in context.

Do not alter a string literal to localize runnable code unless the user explicitly requests code localization.

## Review checklist

Before finishing, verify all of the following:

- The source file is unchanged.
- The target is in the intended language directory and retains the relative path.
- Front matter keys, order, scalar/list forms, quoting style, comments, and delimiters are preserved.
- Reader-visible front matter is translated and immutable metadata is copied exactly, including explicit empty fields.
- Dates, update timestamps, covers, top images, routing identity, rendering switches, comments, table-of-contents settings, math settings, and copyright settings match the source.
- The warning is the first rendered block, appears once, names the actual source language, and links to the real source page.
- Existing category, tag, and terminology mappings are followed exactly; new mappings are recorded.
- No source section, paragraph, list item, table row, footnote, or caption is omitted or duplicated.
- Code comments are translated.
- Meaningful source-language strings in code have syntax-valid `[generated by LLM]` annotations.
- URLs, paths, anchors, code, math, raw HTML structure, and Hexo tag structure remain valid.
- No unsolicited rewriting, polishing, explanation, or factual correction was introduced.
- The taxonomy validator passes for the new pair.
- The front matter consistency validator passes for the new pair.
- The language-coverage checker was run; missing counterparts are reported as warnings during incremental work and treated as errors when the repository requires complete coverage.

## Project validation

Use the repository-provided typed Python validators rather than duplicating their logic manually:

1. Run the taxonomy/glossary checker after every translated file.
2. Run the front matter consistency checker after every translated file. Treat the source-language file as authoritative and do not suppress a mismatch by weakening the checker.
3. Run the language-coverage checker in warning mode while translation is incomplete.
4. Run coverage in strict mode once all configured language trees are expected to be complete and in CI.
5. Run the composed multilingual build when the change can affect rendering, routes, Hexo tags, or assets.

The project-level multilingual skill owns creation and CI integration of these validators; this skill consumes them. If they are absent, report that gap rather than inventing a project-specific layout without authorization.

Report the source path, target path, language direction, root-relative source path used by the warning, glossary entries added, validation performed, and any unresolved ambiguity.
