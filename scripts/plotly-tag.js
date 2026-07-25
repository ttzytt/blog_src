/* global hexo */

'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_CDN_URL = 'https://cdn.plot.ly/plotly-3.7.0.min.js';
const DEFAULT_LOCAL_URL = '/js/vendor/plotly-3.7.0.min.js';
const DEFAULT_THEME_URL = '/js/plotly-blog-theme.js';
const DEFAULT_STYLESHEET_URL = '/css/plotly-blog.css';
const DEFAULT_TIMEOUT_MS = 5000;
const PLOTLY_LOADER_MARKER = 'data-plotly-loader';
const PLOTLY_CHART_MARKER = 'data-plotly-chart';

function escapeHtmlAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function serializeForInlineScript(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function resolveCodePath(filename) {
  if (!filename) {
    throw new Error('Plotly tag requires a JavaScript file path');
  }

  if (path.isAbsolute(filename)) {
    throw new Error(`Plotly code path must be relative to the blog root: ${filename}`);
  }

  const codePath = path.resolve(hexo.base_dir, filename);
  if (!isPathInside(hexo.base_dir, codePath)) {
    throw new Error(`Plotly code path cannot leave the blog root: ${filename}`);
  }

  if (path.extname(codePath).toLowerCase() !== '.js') {
    throw new Error(`Plotly code file must use the .js extension: ${filename}`);
  }

  return codePath;
}

function plotlyConfig() {
  const config = hexo.config.plotly || {};
  const configuredTimeout = Number(config.timeout_ms);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? Math.floor(configuredTimeout)
    : DEFAULT_TIMEOUT_MS;

  return {
    cdnUrl: config.cdn_url || DEFAULT_CDN_URL,
    localUrl: config.local_url || DEFAULT_LOCAL_URL,
    themeUrl: config.theme_url || DEFAULT_THEME_URL,
    stylesheetUrl: config.stylesheet_url || DEFAULT_STYLESHEET_URL,
    timeoutMs
  };
}

function registerPlotlyTranslations() {
  const translations = hexo.config.plotly?.i18n;
  if (!translations || typeof translations !== 'object') return;

  for (const [language, messages] of Object.entries(translations)) {
    if (!messages || typeof messages !== 'object') continue;

    // hexo-i18n's set() replaces a locale instead of merging it. Preserve the
    // Butterfly translations already loaded for that locale before adding the
    // project-owned Plotly namespace.
    const existing = hexo.theme.i18n.get(language);
    hexo.theme.i18n.set(language, {
      ...existing,
      plotly: messages
    });
  }
}

function plotlyTranslation(context, key) {
  registerPlotlyTranslations();

  const configuredLanguages = Array.isArray(hexo.config.language)
    ? hexo.config.language
    : [hexo.config.language];
  const languages = [
    context?.lang,
    context?.language,
    ...configuredLanguages,
    'default'
  ].filter(Boolean);

  return hexo.theme.i18n._p([...new Set(languages)])(`plotly.${key}`);
}

// Theme language files are processed after project scripts are loaded. Merge
// custom translations immediately before every build (including live rebuilds)
// so Butterfly's locale data is present and remains intact.
hexo.on('generateBefore', registerPlotlyTranslations);

function plotlyLoaderHtml() {
  const {
    cdnUrl,
    localUrl,
    themeUrl,
    stylesheetUrl,
    timeoutMs
  } = plotlyConfig();

  return `<link rel="stylesheet" href="${escapeHtmlAttribute(stylesheetUrl)}" data-plotly-styles>
<script src="${escapeHtmlAttribute(themeUrl)}" data-plotly-theme></script>
<script ${PLOTLY_LOADER_MARKER}>
(() => {
  if (window.plotlyReady) return;

  const cdnUrl = ${serializeForInlineScript(cdnUrl)};
  const localUrl = ${serializeForInlineScript(localUrl)};
  const timeoutMs = ${serializeForInlineScript(timeoutMs)};

  const loadScript = (source, timeout) => new Promise((resolve, reject) => {
    if (window.Plotly) {
      resolve(window.Plotly);
      return;
    }

    const script = document.createElement('script');
    let settled = false;
    let timer;

    const cleanUp = () => {
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      cleanUp();
      resolve(window.Plotly);
    };

    const fail = message => {
      if (settled) return;
      settled = true;
      cleanUp();
      script.remove();
      reject(new Error(message));
    };

    script.src = source;
    script.async = true;
    script.dataset.plotlySource = source;
    script.onload = () => {
      if (window.Plotly) {
        succeed();
      } else {
        fail('Plotly script loaded without exposing window.Plotly: ' + source);
      }
    };
    script.onerror = () => fail('Failed to load Plotly script: ' + source);

    document.head.appendChild(script);
    timer = window.setTimeout(
      () => fail('Timed out loading Plotly script after ' + timeout + 'ms: ' + source),
      timeout
    );
  });

  window.plotlyReady = loadScript(cdnUrl, timeoutMs).catch(cdnError => {
    console.warn('[Plotly] CDN unavailable or slow; trying the local fallback.', cdnError);
    return loadScript(localUrl, timeoutMs);
  });
})();
</script>`;
}

// Inject Plotly only into opted-in article pages. The HTML marker fallback also
// covers a chart included in a home-page excerpt or another generated listing.
hexo.extend.filter.register('after_render:html', function injectPlotly(html, locals) {
  const pageOptedIn = locals?.page?.plotly === true;
  const containsChart = html.includes(PLOTLY_CHART_MARKER);

  if ((!pageOptedIn && !containsChart) || html.includes(PLOTLY_LOADER_MARKER)) {
    return html;
  }

  return html.replace('</head>', `${plotlyLoaderHtml()}\n</head>`);
});

// Usage:
//   {% plotly chart-id path/to/chart.js [height] %}
//
// The path is relative to the blog root, not to a mandatory Plotly directory.
// The included file runs inside a function where `target` is the chart div.
hexo.extend.tag.register('plotly', async function plotlyTag(args) {
  const [chartId, filename, height = '420'] = args;
  const articlePath = this.source || this.path || this.title || 'unknown article';

  if (this.plotly !== true) {
    throw new Error(
      `Plotly tag in "${articlePath}" requires "plotly: true" in Front Matter`
    );
  }

  if (!chartId || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(chartId)) {
    throw new Error(`Invalid Plotly chart id "${chartId || ''}" in "${articlePath}"`);
  }

  if (!/^\d+$/u.test(height) || Number(height) <= 0) {
    throw new Error(`Invalid Plotly chart height "${height}" in "${articlePath}"`);
  }

  const codePath = resolveCodePath(filename);
  let code;
  try {
    code = await fs.readFile(codePath, 'utf8');
  } catch (error) {
    error.message = `Cannot read Plotly code file "${filename}" for "${articlePath}": ${error.message}`;
    throw error;
  }

  // A literal closing script tag would terminate the generated inline script.
  const safeCode = code.replace(/<\/script/giu, '<\\/script');
  const safeChartId = escapeHtmlAttribute(chartId);
  const chartIdLiteral = JSON.stringify(chartId);
  const loadingText = plotlyTranslation(this, 'loading');
  const failureText = plotlyTranslation(this, 'load_failed');
  const failureTextLiteral = serializeForInlineScript(failureText);

  return [
    `<div id="${safeChartId}" ${PLOTLY_CHART_MARKER} aria-busy="true" style="width:100%;height:${height}px">`,
    '  <div class="plotly-chart__loading" role="status" aria-live="polite">',
    '    <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>',
    `    <span>${escapeHtmlAttribute(loadingText)}</span>`,
    '  </div>',
    '</div>',
    '<script>',
    '(() => {',
    `  const target = document.getElementById(${chartIdLiteral});`,
    '  const ready = window.plotlyReady || Promise.reject(new Error(\'Plotly loader was not initialized\'));',
    '  ready.then(() => {',
    '    if (!target) throw new Error(\'Plotly chart container was not found\');',
    '    const loading = target.querySelector(\'.plotly-chart__loading\');',
    safeCode,
    '    loading?.remove();',
    '    target.setAttribute(\'aria-busy\', \'false\');',
    '  }).catch(error => {',
    `    console.error('[Plotly] Failed to render chart ${chartIdLiteral}.', error);`,
    '    if (target) {',
    `      target.textContent = ${failureTextLiteral};`,
    '      target.setAttribute(\'aria-busy\', \'false\');',
    '      target.setAttribute(\'role\', \'alert\');',
    '    }',
    '  });',
    '})();',
    '</script>'
  ].join('\n');
}, { async: true });
