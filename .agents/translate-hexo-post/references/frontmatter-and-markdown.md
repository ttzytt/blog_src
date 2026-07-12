# Front Matter and Markdown Policy

## Front matter

Start by copying the complete raw source front matter. Preserve its YAML representation rather than parsing and serializing the whole mapping. Keep delimiters, every field including explicit empty fields, key order, indentation, comments, quoting, blank lines, and scalar/flow-list/block-list forms. Never recreate a shorter target mapping from memory or from a generic template.

Translate reader-visible values, including these fields when present:

- `title`
- `subtitle`
- `description`
- `summary`
- `excerpt`
- `categories`
- `tags`
- `keywords`

Update `lang` or `language` to the target locale when the project uses that field for routing.

Preserve operational and identity metadata exactly unless project instructions explicitly say otherwise, including:

- `date`, `updated`, `layout`, `permalink`, `abbrlink`
- `cover`, `top_img`, `thumbnail`
- `sticky`, `published`, `comments`, `toc`, `toc_number`, `toc_style_simple`
- `mathjax`, `katex`, `copyright`

Also preserve related empty or less common fields such as copyright subfields, `aplayer`, `highlight_shrink`, and `aside`. Copy unknown operational fields exactly. The source-language front matter is authoritative even when a target value seems more convenient.

Leave an unknown field unchanged unless it is unambiguously reader-visible natural language. Ask when changing it could affect routing, rendering, or identity.

Run the repository front matter consistency validator after writing the target. Its configured localized-field allowlist is the project authority. Do not add an exception merely to make a mismatched translation pass.

Translate category and tag leaf values while retaining their original scalar or list representation. Apply the persistent taxonomy mapping before choosing any new translation.

## Protected Markdown and Hexo syntax

Preserve the structure and delimiters of:

- Headings, lists, block quotes, tables, footnotes, and definition references.
- Fenced and indented code blocks.
- Inline code.
- Markdown and HTML links; translate labels and preserve external destinations. Keep site-local destinations root-relative and free of production hostnames.
- Images; translate alt text when meaningful but preserve paths and attributes.
- Raw HTML tags and attributes that are not reader-visible prose.
- Math delimiters and formula contents.
- Hexo tags such as `{% note %}`, `{% tabs %}`, `{% codeblock %}`, and their closing tags.

The target must retain exactly the same number of fenced code blocks, rendered images, and rendered links as the source, excluding the required machine-warning link. Do not combine adjacent blocks or replace a source structure with prose. Run the project content-completeness validator to verify both these counts and the configured language-pair character ratio.

Never translate syntax tokens, filenames, anchors, URLs, commands, identifiers, API names, or formula variables merely because they resemble natural language.

The required machine-translation warning is a new Hexo block and must remain outside front matter.

For paired language files, preserve the same path relative to each configured source root. Build the warning's source-language destination from the stable route and express it as a root-relative path such as `/posts/example/` or `/en/posts/example/`. Shared site assets should likewise use root-relative paths unless the project deliberately stores a language-local copy.
