---
name: add-hexo-plotly-chart
description: Add, modify, localize, or debug interactive Plotly charts in this Hexo Butterfly blog. Use when Codex must enable Plotly or optional Plotly MathJax through post front matter, embed chart code with the custom Hexo tag, create chart files under graph_code or another approved folder, add sliders, scale-switching buttons, reference curves, or adjacent i18n data for multilingual posts, reuse the shared light/dark theme and controls, diagnose Plotly build or preview warnings, or validate CDN/local fallback behavior.
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
- For a multilingual chart, the closest existing `.i18n.yml` and the
  `plotly_i18n` section in `_config.yml`.

Treat those files as the source of truth; this skill records conventions, not frozen implementations. Inspect `git status` and preserve unrelated work.

Never edit generated files under `public/`, installed packages under `node_modules/`, or the Butterfly theme to implement an article chart.

## Add or update a chart

1. Enable Plotly in the article front matter:

   ```yaml
   plotly: true
   ```

   Add the separate MathJax switch only when Plotly titles, axes, legends,
   annotations, or external controls contain TeX:

   ```yaml
   plotly: true
   plotly_mathjax: true
   ```

   Do not confuse `plotly_mathjax` with Butterfly's `mathjax` or `katex`
   fields for article-body formulas. Omit `plotly_mathjax` for plain-text
   charts so the page does not download MathJax.

2. Prefer this organization for new chart code:

   ```text
   source/graph_code/<post-name>/<chart-name>.js
   ```

   The tag accepts any repository-relative `.js` path inside the blog root. Do not incorrectly require every chart to live in `graph_code`.

3. Embed the file with a unique DOM id:

   ```text
   {% plotly chart-id source/graph_code/<post-name>/<chart-name>.js 400 %}
   ```

   The last argument is height in pixels and is optional. The tag supplies
   `target`, waits for `window.plotlyMathReady`, and catches rendering
   failures. `window.plotlyMathReady` always waits for Plotly and also waits
   for MathJax when `plotly_mathjax: true`. Multiple charts on one page share
   one Plotly 3.7 loader and, when enabled, one MathJax 3 loader.

4. Keep chart files focused on data and rendering. The execution environment provides
   `target`, `Plotly`, `BlogPlotly`, and `chartI18n`.

5. Use the shared helpers:

   - `BlogPlotly.createRangeControls(target, definitions)`
   - `BlogPlotly.setOutput(outputs, key, value, digits)`
   - `BlogPlotly.getColors()`
   - `BlogPlotly.baseLayout(colors)`
   - `BlogPlotly.axis(title, overrides, colors)`
   - `BlogPlotly.axisScaleButtons(options, colors)`
   - `BlogPlotly.getPlotConfig()`
   - `BlogPlotly.initializeMathChart(target, controls, render)`
   - `BlogPlotly.observeTheme(render, target)`

   A typical control definition is:

   ```js
   const { inputs, outputs } = BlogPlotly.createRangeControls(target, [
     {
       key: 'amplitude',
       label: '振幅',
       mathLabel: 'A',
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

   target.plotlyRenderReady = Plotly.react(
     target,
     traces,
     layout,
     BlogPlotly.getPlotConfig()
   );
   BlogPlotly.observeTheme(render, target);
   ```

   For a MathJax chart, typeset the external controls before Plotly's initial
   render:

   ```js
   BlogPlotly.initializeMathChart(target, container, render);
   ```

   This serializes MathJax startup across charts and keeps the loading
   indicator visible until Plotly has finished rendering.

7. Use semantic shared colors such as `primary`, `warning`, and `accent`. Do not add a per-chart `palette()`, duplicate light/dark hex colors, generate controls with a large `innerHTML` block, or repeat inline control styles.

8. If a reusable visual token or control style is missing, extend `source/css/plotly-blog.css` for both light and dark modes. If reusable behavior is missing, extend `source/js/plotly-blog-theme.js`. Keep article-specific mathematics and traces in the chart file.

9. Give controls meaningful labels, units, limits, steps, defaults, and accessible names. Handle boundary values explicitly, such as duty cycles of zero and one or equal initial/final values.

## Add multilingual chart text

When a chart appears in translated posts, keep one JavaScript implementation and place
reader-visible chart text in an adjacent file with the same basename:

```text
source/graph_code/<post-name>/<chart-name>.js
source/graph_code/<post-name>/<chart-name>.i18n.yml
```

Use a flat mapping and define the same keys for every locale:

```yaml
default: zh-CN
zh-CN:
  dutyCycle: 占空比
  power: 功率
en:
  dutyCycle: Duty cycle
  power: Power
```

Read the selected messages from `chartI18n`:

```js
const { common, text } = chartI18n;

BlogPlotly.createRangeControls(target, [
  {
    key: 'dutyCycle',
    label: text.dutyCycle,
    mathLabel: 'D',
    min: 0,
    max: 1,
    step: 0.01,
    value: 0.5
  }
], {
  separator: common.controlSeparator
});
```

Localize titles, axis labels, legends, annotations, hover text, controls, scale-switching
buttons, and accessibility labels. Use `chartI18n.common.linearScale` and
`chartI18n.common.logarithmicScale` for `axisScaleButtons()` labels. Keep common loading,
failure, scale-button, and separator translations in `_config.yml` under `plotly_i18n`;
keep chart-specific text in the adjacent file.

The tag selects the locale from an explicit `lang=...` option, article language, or current
Hexo site language, with the translation file's `default` as fallback. Usually reuse the
same tag in both language trees without an override:

```text
{% plotly chart-id source/graph_code/<post-name>/<chart-name>.js 400 %}
```

Use `lang=en` only when a chart must override the article or site language. Do not create a
second chart JavaScript file solely for translation. A monolingual chart does not require an
`.i18n.yml`, but add one before creating a translated counterpart.

## Add logarithmic and linear scale switching

For a chart whose frequency axis starts logarithmic, preserve the current scale
across slider updates and theme changes:

```js
const frequencyAxisType =
  target.layout?.xaxis?.type === 'linear' ? 'linear' : 'log';
const frequencyAxisRange = frequencyAxisType === 'linear'
  ? [frequencyMin, frequencyMax]
  : [Math.log10(frequencyMin), Math.log10(frequencyMax)];

const layout = {
  xaxis: BlogPlotly.axis('$f$', {
    type: frequencyAxisType,
    range: frequencyAxisRange
  }, colors),
  updatemenus: BlogPlotly.axisScaleButtons({
    currentType: frequencyAxisType,
    logarithmicRange: [
      Math.log10(frequencyMin),
      Math.log10(frequencyMax)
    ],
    linearRange: [frequencyMin, frequencyMax]
  }, colors)
};
```

Use regular traces for mathematical reference curves. Give actual and
reference curves distinct semantic colors and dash styles, and keep them in
the legend rather than encoding them only as anonymous layout shapes.

## Preserve loader behavior

Keep the existing opt-in behavior:

- Only pages with `plotly: true` or an emitted Plotly chart marker load Plotly assets.
- Only pages with `plotly_mathjax: true` load MathJax for Plotly.
- Load the shared CSS and theme helper before article chart code.
- Prefer the configured Plotly CDN.
- Fall back to the same Plotly version hosted locally after an error or timeout.
- Apply the same CDN-first/local-fallback policy to MathJax when enabled.
- Keep MathJax SVG `fontCache: 'local'`; Plotly clones formula SVGs and can
  lose page-global glyph references.
- Load Plotly, optional MathJax, and the shared assets once per generated page.

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

Inspect the generated HTML for the chart id, `data-plotly-chart`, the expected
`data-plotly-mathjax` and `data-plotly-locale` values, the selected
`chartI18n` messages, shared CSS/helper references, and exactly one
`data-plotly-loader`. For multilingual charts, inspect at least one generated
page for each supported locale and confirm that `.i18n.yml` files are not
published as static assets. After draft validation, clean and run the normal
multilingual build so unpublished output does not remain:

```text
npm run clean
npm run build
```

The tag inlines chart code at build time. If only a file under `graph_code` changes, Hexo may reuse a cached rendering even with `--force`; run `hexo clean` before the validation build.

Do not run multiple Hexo build/server processes against the same source database. Warnings such as `Trying to "create" css/plotly-blog.css, but the file already exists!` usually mean the source processor received a duplicate create event while an existing database record or watcher was active. Confirm there is only one preview server, stop it if necessary, then run `hexo clean`. Do not solve this warning by copying or renaming the shared assets.

## Handoff

Report the post and chart files changed, adjustable parameters and ranges, shared helpers or styles extended, and syntax/build results. State whether browser interaction was tested. Mention any remaining cache, draft, or multilingual limitation.
