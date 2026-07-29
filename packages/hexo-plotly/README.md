# hexo-plotly

A theme-neutral Hexo tag plugin for article-specific Plotly charts. It provides:

- conditional, once-per-page Plotly 3.7.0 loading;
- CDN-first loading with a generated local fallback;
- optional MathJax 3.2.2 loading per article;
- one chart implementation shared by translated posts;
- Plotly modebar localization;
- reusable controls, colors, light/dark theme helpers, and loading UI;
- dependency-aware regeneration during `hexo server` and `hexo generate --watch`.

## Install

```sh
npm install hexo-plotly
```

Hexo loads packages whose names start with `hexo-` from the site's dependencies.
No theme template changes are required.

## Use

Enable Plotly in an article:

```yaml
---
plotly: true
plotly_mathjax: true # only if the chart or its controls use TeX
---
```

Embed a trusted repository-relative JavaScript file:

```text
{% plotly chart-id source/graph_code/post/chart.js 420 %}
```

The height is optional. The file may live anywhere below the Hexo site root; it
does not have to be under `graph_code`. Absolute paths, paths outside the site,
non-JavaScript files, and symlinks that escape the site are rejected.

The chart file executes in the generated page with these bindings:

- `target`: the chart container;
- `Plotly`: the loaded Plotly API;
- `HexoPlotly`: shared plugin helpers;
- `BlogPlotly`: compatibility alias for `HexoPlotly`;
- `chartI18n`: selected common and chart-specific messages.

For example:

```js
const colors = HexoPlotly.getColors();
const { container, inputs, outputs } = HexoPlotly.createRangeControls(
  target,
  [{
    key: 'amplitude',
    label: chartI18n.text.amplitude,
    mathLabel: 'A',
    min: 0,
    max: 10,
    step: 0.1,
    value: 1
  }],
  { separator: chartI18n.common.controlSeparator }
);

function render() {
  HexoPlotly.setOutput(outputs, 'amplitude', inputs.amplitude.value);
  const layout = {
    ...HexoPlotly.baseLayout(colors),
    xaxis: HexoPlotly.axis('x', {}, colors),
    yaxis: HexoPlotly.axis('y', {}, colors)
  };
  target.plotlyRenderReady = Plotly.react(
    target,
    [{ x: [0, 1], y: [0, Number(inputs.amplitude.value)] }],
    layout,
    HexoPlotly.getPlotConfig()
  );
}

inputs.amplitude.addEventListener('input', render);
render();
HexoPlotly.observeTheme(render, target);
```

Chart code is inlined into the article and must be trusted. Do not embed
unreviewed third-party JavaScript.

## Chart localization

Place a YAML file beside the chart code:

```text
source/graph_code/post/chart.js
source/graph_code/post/chart.i18n.yml
```

```yaml
default: zh-CN
zh-CN:
  amplitude: 振幅
en:
  amplitude: Amplitude
```

Every locale must contain the same flat set of string keys. The locale is
selected from an optional `lang=...` tag option, article `lang`/`language`,
then the Hexo site language:

```text
{% plotly chart-id source/graph_code/post/chart.js 420 lang=en %}
```

The JavaScript stays language-independent and reads strings from
`chartI18n.text`. The plugin also loads the matching official Plotly locale for
modebar labels. English needs no extra locale script.

## Configuration

All fields are optional:

```yaml
plotly:
  asset_dir: assets/hexo-plotly
  cdn_url: https://cdn.jsdelivr.net/npm/plotly.js@3.7.0/dist/plotly.min.js
  local_url:
  mathjax_cdn_url: https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js
  mathjax_local_url:
  locale_cdn_template: https://cdn.plot.ly/plotly-locale-{locale}-latest.js
  runtime_url:
  stylesheet_url:
  timeout_ms: 10000
  watch: true
  require_front_matter: true
  stop_input_propagation: false
  filter_priority: 10
  i18n:
    en:
      loading: Loading chart...
```

`local_url` and `mathjax_local_url` default to version-matched assets generated
by the plugin. Set a URL field to `false` to disable that source. Plotly uses:

1. configured CDN with `timeout_ms`;
2. local fallback with the same timeout;
3. the CDN again without a time limit if both attempts fail.

MathJax and locale bundles use CDN then local fallback. `asset_dir` is a Hexo
route namespace and works with a non-root `root`, such as `/en/`.

`stop_input_propagation` exists for themes that attach page effects to bubbling
range-input events; most themes should leave it disabled.

## Theme integration

The plugin does not import or modify a Hexo theme. Its CSS reacts to common
`data-theme`, `data-color-mode`, `data-scheme`, `.dark`, and `.light` signals,
plus `prefers-color-scheme`. A theme can provide an exact visual match by
overriding these variables:

```css
:root {
  --hexo-plotly-text: #363636;
  --hexo-plotly-grid: rgba(0, 0, 0, 0.12);
  --hexo-plotly-primary: #1f77b4;
  --hexo-plotly-warning: #d48806;
  --hexo-plotly-accent: #6f42c1;
  --hexo-plotly-control-bg: rgba(255, 255, 255, 0.82);
  --hexo-plotly-control-border: rgba(0, 0, 0, 0.16);
}
```

No Font Awesome, Butterfly helper, or theme i18n registry is required.

## Live preview

During `hexo server` or `hexo generate --watch`, the plugin tracks every chart
JavaScript file and adjacent `.i18n.yml` used by a Post or Page. A dependency
change invalidates the rendered article so Hexo does not reuse stale inlined
HTML.

Files inside `source_dir` are handled by Hexo's normal source watcher. Referenced
files elsewhere inside the site root are watched by a narrowly scoped watcher.
The latter uses a Hexo internal regeneration event because Hexo's public Box API
only watches source and theme directories; this is covered by tests but is the
most version-sensitive part of the plugin.

## Development

```sh
npm test
npm run check
npm pack --dry-run
```

The package requires Node.js 20.19 or newer and Hexo 7 or 8.
