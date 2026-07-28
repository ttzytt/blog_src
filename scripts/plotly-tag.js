/* global hexo */

'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const yaml = require('js-yaml');

const DEFAULT_CDN_URL = 'https://cdn.jsdelivr.net/npm/plotly.js@3.7.0/dist/plotly.min.js';
const DEFAULT_LOCAL_URL = '/js/vendor/plotly-3.7.0.min.js';
const DEFAULT_MATHJAX_CDN_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
const DEFAULT_MATHJAX_LOCAL_URL = '/js/vendor/mathjax-3.2.2-tex-svg.js';
const DEFAULT_THEME_URL = '/js/plotly-blog-theme.js';
const DEFAULT_STYLESHEET_URL = '/css/plotly-blog.css';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_LOCALE = 'zh-CN';
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

function requestedLanguages(context, override) {
  const configuredLanguages = Array.isArray(hexo.config.language)
    ? hexo.config.language
    : [hexo.config.language];
  const languages = [
    override,
    context?.lang,
    context?.language,
    ...configuredLanguages
  ];
  const candidates = [];

  for (const language of languages) {
    if (!language) continue;
    const normalized = String(language).trim().replaceAll('_', '-');
    if (!normalized) continue;

    candidates.push(normalized);
    const baseLanguage = normalized.split('-')[0];
    if (baseLanguage !== normalized) candidates.push(baseLanguage);
  }

  return [...new Set(candidates)];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseChartTranslations(source, filename) {
  let parsed;
  try {
    parsed = yaml.load(source);
  } catch (error) {
    throw new Error(`Cannot parse Plotly translation file "${filename}": ${error.message}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error(`Plotly translation file "${filename}" must contain a YAML mapping`);
  }

  const defaultLocale =
    typeof parsed.default === 'string' && parsed.default.trim()
      ? parsed.default.trim()
      : DEFAULT_LOCALE;
  const translations = Object.fromEntries(
    Object.entries(parsed).filter(([locale]) => locale !== 'default')
  );
  const locales = Object.keys(translations);

  if (locales.length === 0) {
    throw new Error(`Plotly translation file "${filename}" does not define any locales`);
  }

  for (const locale of locales) {
    const messages = translations[locale];
    if (!isPlainObject(messages)) {
      throw new Error(`Plotly locale "${locale}" in "${filename}" must be a mapping`);
    }

    for (const [key, value] of Object.entries(messages)) {
      if (typeof value !== 'string') {
        throw new Error(
          `Plotly translation "${locale}.${key}" in "${filename}" must be a string`
        );
      }
    }
  }

  const referenceLocale = Object.hasOwn(translations, defaultLocale)
    ? defaultLocale
    : locales[0];
  const referenceKeys = Object.keys(translations[referenceLocale]).sort();

  for (const locale of locales) {
    const keys = Object.keys(translations[locale]).sort();
    if (
      keys.length !== referenceKeys.length ||
      keys.some((key, index) => key !== referenceKeys[index])
    ) {
      throw new Error(
        `Plotly locale "${locale}" in "${filename}" must define the same keys as ` +
        `"${referenceLocale}"`
      );
    }
  }

  return { defaultLocale, translations };
}

function selectChartTranslation(table, context, override) {
  const locales = Object.keys(table.translations);
  const localeLookup = new Map(
    locales.map(locale => [locale.toLowerCase(), locale])
  );
  const candidates = [
    ...requestedLanguages(context, override),
    table.defaultLocale,
    DEFAULT_LOCALE,
    'en'
  ];

  for (const candidate of candidates) {
    const locale = localeLookup.get(candidate.toLowerCase());
    if (locale) {
      return {
        locale,
        text: table.translations[locale]
      };
    }
  }

  const locale = locales[0];
  return {
    locale,
    text: table.translations[locale]
  };
}

async function loadChartTranslation(codePath, context, override) {
  const translationPath = codePath.replace(/\.js$/iu, '.i18n.yml');
  const relativePath = path.relative(hexo.base_dir, translationPath);
  let source;

  try {
    source = await fs.readFile(translationPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        locale: requestedLanguages(context, override)[0] || DEFAULT_LOCALE,
        text: {}
      };
    }
    throw new Error(
      `Cannot read Plotly translation file "${relativePath}": ${error.message}`
    );
  }

  return selectChartTranslation(
    parseChartTranslations(source, relativePath),
    context,
    override
  );
}

function parseTagOptions(args, articlePath) {
  const options = {};

  for (const argument of args) {
    const separator = argument.indexOf('=');
    if (separator <= 0 || separator === argument.length - 1) {
      throw new Error(
        `Invalid Plotly tag option "${argument}" in "${articlePath}"; use key=value`
      );
    }

    const key = argument.slice(0, separator);
    const value = argument.slice(separator + 1);
    if (key !== 'lang') {
      throw new Error(`Unknown Plotly tag option "${key}" in "${articlePath}"`);
    }
    if (Object.hasOwn(options, key)) {
      throw new Error(`Duplicate Plotly tag option "${key}" in "${articlePath}"`);
    }
    if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u.test(value)) {
      throw new Error(`Invalid Plotly language "${value}" in "${articlePath}"`);
    }
    options[key] = value;
  }

  return options;
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

function plotlyTranslation(context, key, override) {
  registerPlotlyTranslations();

  const languages = [
    ...requestedLanguages(context, override),
    'default'
  ];

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
    const hasTimeout = Number.isFinite(timeout) && timeout > 0;
    let settled = false;
    let timer = null;

    const cleanUp = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
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
    if (hasTimeout) {
      timer = window.setTimeout(
        () => fail('Timed out loading ' + label + ' after ' + timeout + 'ms: ' + source),
        timeout
      );
    }
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

  const loadPlotlyWithFallback = () => (
    loadScript(cdnUrl, timeoutMs, plotlyIsReady, 'Plotly').catch(cdnError => {
      console.warn(
        '[Plotly] Plotly CDN unavailable or slow; trying the local fallback.',
        cdnError
      );
      return loadScript(localUrl, timeoutMs, plotlyIsReady, 'Plotly').catch(localError => {
        console.warn(
          '[Plotly] Plotly local fallback unavailable or slow; retrying the CDN without a timeout.',
          localError
        );
        return loadScript(cdnUrl, null, plotlyIsReady, 'Plotly');
      });
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

  window.plotlyReady = window.plotlyReady || loadPlotlyWithFallback()
    .then(() => window.Plotly);

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
//   {% plotly chart-id path/to/chart.js [height] [lang=en] %}
//
// The path is relative to the blog root, not to a mandatory Plotly directory.
// The included file runs inside a function where `target` is the chart div.
hexo.extend.tag.register('plotly', async function plotlyTag(args) {
  const [chartId, filename, ...remainingArgs] = args;
  const articlePath = this.source || this.path || this.title || 'unknown article';
  let height = '420';

  if (remainingArgs.length > 0 && !remainingArgs[0].includes('=')) {
    height = remainingArgs.shift();
  }
  const options = parseTagOptions(remainingArgs, articlePath);

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
  const chartTranslation = await loadChartTranslation(
    codePath,
    this,
    options.lang
  );
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
  const loadingText = plotlyTranslation(this, 'loading', options.lang);
  const failureText = plotlyTranslation(this, 'load_failed', options.lang);
  const failureTextLiteral = serializeForInlineScript(failureText);
  const chartI18nLiteral = serializeForInlineScript({
    locale: chartTranslation.locale,
    common: {
      controlSeparator: plotlyTranslation(
        this,
        'control_separator',
        options.lang
      ),
      linearScale: plotlyTranslation(this, 'linear_scale', options.lang),
      logarithmicScale: plotlyTranslation(
        this,
        'logarithmic_scale',
        options.lang
      )
    },
    text: chartTranslation.text
  });
  const mathJaxEnabled = this.plotly_mathjax === true;

  return [
    `<div id="${safeChartId}" ${PLOTLY_CHART_MARKER} data-plotly-mathjax="${mathJaxEnabled}" data-plotly-locale="${escapeHtmlAttribute(chartTranslation.locale)}" aria-busy="true" style="width:100%;height:${height}px">`,
    '  <div class="plotly-chart__loading" role="status" aria-live="polite">',
    '    <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>',
    `    <span>${escapeHtmlAttribute(loadingText)}</span>`,
    '  </div>',
    '</div>',
    '<script>',
    '(() => {',
    `  const target = document.getElementById(${chartIdLiteral});`,
    `  const chartI18n = Object.freeze(${chartI18nLiteral});`,
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
