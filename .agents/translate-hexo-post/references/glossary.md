# Persistent Translation Tables

Use a project-owned CSV glossary, not a file inside the installed skill, so mappings persist across articles and skill updates. Maintain explicit source and target locale columns; do not assume every mapping is safely reversible.

Use this exact schema:

```csv
type,source_language,target_language,source,target,context,note
```

Valid `type` values are `category`, `tag`, and `term`. Use standard CSV quoting when values contain commas, quotes, or newlines.

## Taxonomy

Record every category and tag, including intentionally unchanged values:

```csv
type,source_language,target_language,source,target,context,note
category,zh-CN,en,题解,Solution Write-ups,,
tag,zh-CN,en,操作系统,Operating Systems,,
```

Treat an existing source entry as locked. Preserve capitalization and plurality exactly. Complete taxonomy coverage is mandatory so a program can verify every article.

## Unambiguous terminology

Use `term` rows for ordinary terminology and leave the last two fields empty:

```csv
term,zh-CN,en,页表,page table,,
term,zh-CN,en,上下文切换,context switch,,
```

Do not add context or notes merely to fill columns.

## Ambiguous terminology

Use context and notes only when the same source term legitimately requires different translations or when a constraint is necessary to avoid misuse:

```csv
term,zh-CN,en,树,tree,Data structures,Use for the graph-theory structure.
term,zh-CN,en,树,hierarchy,UI organization,Do not use for graph-theory content.
```

Before adding a contextual mapping, verify that one general mapping cannot serve all occurrences. Keep context short and operational.

## Applying and updating mappings

1. Load all existing entries for the current direction before translating.
2. Extract recurring technical terms, proper nouns, categories, and tags from the complete source.
3. Apply existing entries exactly.
4. Choose a conventional faithful translation for a new unambiguous term and add a `term` row.
5. Ask the user when a new taxonomy or term has multiple materially different plausible translations that affect future articles.
6. Add context/notes only to resolve that ambiguity.
7. Run the taxonomy validator and re-scan prose terminology before saving.

Do not silently change an established mapping. Reject duplicate or conflicting rows. If an existing mapping appears wrong, report it and request permission before replacing it.
