/* global hexo */

'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_CDN_URL = 'https://cdn.plot.ly/plotly-3.7.0.min.js';
const DEFAULT_LOCAL_URL = '/js/vendor/plotly-3.7.0.min.js';
const DEFAULT_MATHJAX_CDN_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
const DEFAULT_MATHJAX_LOCAL_URL = '/js/vendor/mathjax-3.2.2-tex-svg.js';
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
    mathJaxCdnUrl: config.mathjax_cdn_url || DEFAULT_MATHJAX_CDN_URL,
    mathJaxLocalUrl: config.mathjax_local_url || DEFAULT_MATHJAX_LOCAL_URL,
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

function plotlyLoaderHtml(mathJaxEnabled) {
  const {
    cdnUrl,
    localUrl,
    mathJaxCdnUrl,
    mathJaxLocalUrl,
    themeUrl,
    stylesheetUrl,
    timeoutMs
  } = plotlyConfig();

  return `<link rel="stylesheet" href="${escapeHtmlAttribute(stylesheetUrl)}" data-plotly-styles>
<script src="${escapeHtmlAttribute(themeUrl)}" data-plotly-theme></script>
<script ${PLOTLY_LOADER_MARKER} data-plotly-mathjax="${mathJaxEnabled}">
(() => {
  if (window.plotlyMathReady) return;

  const mathJaxEnabled = ${serializeForInlineScript(mathJaxEnabled)};
  const cdnUrl = ${serializeForInlineScript(cdnUrl)};
  const localUrl = ${serializeForInlineScript(localUrl)};
  const mathJaxCdnUrl = ${serializeForInlineScript(mathJaxCdnUrl)};
  const mathJaxLocalUrl = ${serializeForInlineScript(mathJaxLocalUrl)};
  const timeoutMs = ${serializeForInlineScript(timeoutMs)};

  const loadScript = (source, timeout, isReady, label) => new Promise((resolve, reject) => {
    if (isReady()) {
      resolve();
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
      if (isReady()) {
        succeed();
      } else {
        fail(label + ' loaded without exposing its browser API: ' + source);
      }
    };
    script.onerror = () => fail('Failed to load ' + label + ': ' + source);

    document.head.appendChild(script);
    timer = window.setTimeout(
      () => fail('Timed out loading ' + label + ' after ' + timeout + 'ms: ' + source),
      timeout
    );
  });

  const loadWithFallback = (cdnSource, localSource, isReady, label) => (
    loadScript(cdnSource, timeoutMs, isReady, label).catch(cdnError => {
      console.warn(
        '[Plotly] ' + label + ' CDN unavailable or slow; trying the local fallback.',
        cdnError
      );
      return loadScript(localSource, timeoutMs, isReady, label);
    })
  );

  const plotlyIsReady = () => Boolean(window.Plotly);
  const mathJaxIsReady = () => {
    const version = window.MathJax && window.MathJax.version;
    const majorVersion = Number.parseInt((version || '').split('.')[0], 10);
    return majorVersion === 3 && typeof window.MathJax.typesetPromise === 'function';
  };

  if (mathJaxEnabled && (!window.MathJax || !window.MathJax.version)) {
    const existingConfig = window.MathJax || {};
    window.MathJax = {
      ...existingConfig,
      tex: {
        ...existingConfig.tex,
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']]
      },
      svg: {
        ...existingConfig.svg,
        fontCache: 'local'
      }
    };
  }

  window.plotlyReady = window.plotlyReady || loadWithFallback(
    cdnUrl,
    localUrl,
    plotlyIsReady,
    'Plotly'
  ).then(() => window.Plotly);

  if (mathJaxEnabled) {
    window.mathJaxReady = window.mathJaxReady || loadWithFallback(
      mathJaxCdnUrl,
      mathJaxLocalUrl,
      mathJaxIsReady,
      'MathJax'
    ).then(() => window.MathJax.startup.promise)
      .then(() => window.MathJax);

    window.plotlyMathReady = Promise.all([
      window.plotlyReady,
      window.mathJaxReady
    ]).then(([plotly]) => plotly);
  } else {
    window.mathJaxReady = window.mathJaxReady || Promise.resolve(null);
    window.plotlyMathReady = window.plotlyReady;
  }
})();
</script>`;
}

// Inject Plotly only into opted-in article pages. The HTML marker fallback also
// covers a chart included in a home-page excerpt or another generated listing.
hexo.extend.filter.register('after_render:html', function injectPlotly(html, locals) {
  const pageOptedIn = locals?.page?.plotly === true;
  const containsChart = html.includes(PLOTLY_CHART_MARKER);
  const mathJaxEnabled =
    locals?.page?.plotly_mathjax === true ||
    html.includes('data-plotly-mathjax="true"');

  if ((!pageOptedIn && !containsChart) || html.includes(PLOTLY_LOADER_MARKER)) {
    return html;
  }

  return html.replace(
    '</head>',
    () => `${plotlyLoaderHtml(mathJaxEnabled)}\n</head>`
  );
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
  const mathJaxEnabled = this.plotly_mathjax === true;

  return [
    `<div id="${safeChartId}" ${PLOTLY_CHART_MARKER} data-plotly-mathjax="${mathJaxEnabled}" aria-busy="true" style="width:100%;height:${height}px">`,
    '  <div class="plotly-chart__loading" role="status" aria-live="polite">',
    '    <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>',
    `    <span>${escapeHtmlAttribute(loadingText)}</span>`,
    '  </div>',
    '</div>',
    '<script>',
    '(() => {',
    `  const target = document.getElementById(${chartIdLiteral});`,
    '  const ready = window.plotlyMathReady || Promise.reject(new Error(\'Plotly loader was not initialized\'));',
    '  ready.then(() => {',
    '    if (!target) throw new Error(\'Plotly chart container was not found\');',
    '    const loading = target.querySelector(\'.plotly-chart__loading\');',
    safeCode,
    '    const renderReady = target.plotlyRenderReady || Promise.resolve();',
    '    return renderReady.then(() => {',
    '      loading?.remove();',
    '      target.setAttribute(\'aria-busy\', \'false\');',
    '    });',
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
