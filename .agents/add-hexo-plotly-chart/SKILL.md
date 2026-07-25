---
name: add-hexo-plotly-chart
description: Add, modify, or debug interactive Plotly charts in this Hexo Butterfly blog. Use when Codex must enable Plotly through post front matter, embed chart code with the custom Hexo tag, create chart files under graph_code or another approved folder, add sliders or buttons, reuse the shared light/dark theme and controls, diagnose Plotly build or preview warnings, or validate CDN/local fallback behavior.
---

# Add Hexo Plotly Chart

Build article-specific chart logic while preserving the blog-wide Plotly loader, controls, and visual language.

## Inspect the project contract

Before editing, read the current versions of:

- `_config.yml`, especially `plotly`.
- `scripts/plotly-tag.js`.
- `source/css/plotly-blog.css`.
- `source/js/plotly-blog-theme.js`.
- The target post and the closest existing chart under `source/graph_code/`.

Treat those files as the source of truth; this skill records conventions, not frozen implementations. Inspect `git status` and preserve unrelated work.

Never edit generated files under `public/`, installed packages under `node_modules/`, or the Butterfly theme to implement an article chart.

## Add or update a chart

1. Set the article front matter to:

   ```yaml
   plotly: true
   ```

2. Prefer this organization for new chart code:

   ```text
   source/graph_code/<post-name>/<chart-name>.js
   ```

   The tag accepts any repository-relative `.js` path inside the blog root. Do not incorrectly require every chart to live in `graph_code`.

3. Embed the file with a unique DOM id:

   ```text
   {% plotly chart-id source/graph_code/<post-name>/<chart-name>.js 400 %}
   ```

   The last argument is height in pixels and is optional. The tag supplies `target`, waits for `window.plotlyReady`, and catches rendering failures. Multiple charts on one page share one Plotly 3.7 loader.

4. Keep chart files focused on data and rendering. The execution environment provides `target`, `Plotly`, and `BlogPlotly`.

5. Use the shared helpers:

   - `BlogPlotly.createRangeControls(target, definitions)`
   - `BlogPlotly.setOutput(outputs, key, value, digits)`
   - `BlogPlotly.getColors()`
   - `BlogPlotly.baseLayout(colors)`
   - `BlogPlotly.axis(title, overrides, colors)`
   - `BlogPlotly.getPlotConfig()`
   - `BlogPlotly.observeTheme(render, target)`

   A typical control definition is:

   ```js
   const { inputs, outputs } = BlogPlotly.createRangeControls(target, [
     {
       key: 'amplitude',
       label: '振幅 A',
       unit: 'V',
       min: 0,
       max: 10,
       step: 0.1,
       value: 1
     }
   ]);
   ```

6. Render with the common layout:

   ```js
   const colors = BlogPlotly.getColors();
   const layout = {
     ...BlogPlotly.baseLayout(colors),
     xaxis: BlogPlotly.axis('时间 t (s)', { range: [0, 20] }, colors),
     yaxis: BlogPlotly.axis('电压 V(t) (V)', { rangemode: 'tozero' }, colors)
   };

   Plotly.react(target, traces, layout, BlogPlotly.getPlotConfig());
   BlogPlotly.observeTheme(render, target);
   ```

7. Use semantic shared colors such as `primary`, `warning`, and `accent`. Do not add a per-chart `palette()`, duplicate light/dark hex colors, generate controls with a large `innerHTML` block, or repeat inline control styles.

8. If a reusable visual token or control style is missing, extend `source/css/plotly-blog.css` for both light and dark modes. If reusable behavior is missing, extend `source/js/plotly-blog-theme.js`. Keep article-specific mathematics and traces in the chart file.

9. Give controls meaningful labels, units, limits, steps, defaults, and accessible names. Handle boundary values explicitly, such as duty cycles of zero and one or equal initial/final values.

## Preserve loader behavior

Keep the existing opt-in behavior:

- Only pages with `plotly: true` or an emitted Plotly chart marker load Plotly assets.
- Load the shared CSS and theme helper before article chart code.
- Prefer the configured Plotly CDN.
- Fall back to the same Plotly version hosted locally after an error or timeout.
- Load Plotly and the shared assets once per generated page.

Do not add Plotly globally to every blog page.

## Validate

Run syntax and whitespace checks:

```text
node --check <chart-file>
node --check source/js/plotly-blog-theme.js
node --check scripts/plotly-tag.js
git diff --check
```

When the target post has `published: false`, clean and generate with drafts so the page is actually exercised:

```text
npm run clean
npx hexo generate --config _config.yml,config-zh.yml --draft --bail
```

Inspect the generated HTML for the chart id, `data-plotly-chart`, shared CSS/helper references, and exactly one `data-plotly-loader`. After draft validation, clean and run the normal build so unpublished output does not remain:

```text
npm run clean
npm run build:zh
```

The tag inlines chart code at build time. If only a file under `graph_code` changes, Hexo may reuse a cached rendering even with `--force`; run `hexo clean` before the validation build.

Do not run multiple Hexo build/server processes against the same source database. Warnings such as `Trying to "create" css/plotly-blog.css, but the file already exists!` usually mean the source processor received a duplicate create event while an existing database record or watcher was active. Confirm there is only one preview server, stop it if necessary, then run `hexo clean`. Do not solve this warning by copying or renaming the shared assets.

## Handoff

Report the post and chart files changed, adjustable parameters and ranges, shared helpers or styles extended, and syntax/build results. State whether browser interaction was tested. Mention any remaining cache, draft, or multilingual limitation.
