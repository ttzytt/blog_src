'use strict';

const path = require('node:path');
const { url_for: urlFor } = require('hexo-util');
const {
  PLOTLY_CHART_MARKER,
  PLOTLY_LOADER_MARKER
} = require('./constants');
const { escapeHtml, serializeForInlineScript } = require('./html');
const {
  plotlyLocaleRegistrationName
} = require('./plotly-locales');

function localeCdnUrl(template, locale) {
  if (!template || locale === 'en') return null;
  return template.replaceAll('{locale}', encodeURIComponent(locale));
}

function loaderHtml(hexo, config, i18n, context, mathJaxEnabled) {
  const plotlyLocaleFile = i18n.plotlyLocale(context);
  const plotlyLocale = plotlyLocaleRegistrationName(plotlyLocaleFile);
  const localeLocalUrl =
    plotlyLocaleFile === 'en'
      ? null
      : urlFor.call(
          hexo,
          path.posix.join(config.routes.localeDir, `${plotlyLocaleFile}.js`)
        );
  const bootOptions = {
    plotlyCdnUrl: config.urls.plotlyCdn,
    plotlyLocalUrl: config.urls.plotlyLocal,
    mathJaxCdnUrl: config.urls.mathJaxCdn,
    mathJaxLocalUrl: config.urls.mathJaxLocal,
    localeCdnUrl: localeCdnUrl(
      config.urls.localeCdnTemplate,
      plotlyLocaleFile
    ),
    localeLocalUrl,
    locale: plotlyLocale,
    mathJaxEnabled,
    stopInputPropagation: config.stopInputPropagation,
    timeoutMs: config.timeoutMs
  };

  return [
    `<link rel="stylesheet" href="${escapeHtml(config.urls.stylesheet)}" data-hexo-plotly-styles>`,
    `<script src="${escapeHtml(config.urls.runtime)}" data-hexo-plotly-runtime></script>`,
    `<script ${PLOTLY_LOADER_MARKER} data-plotly-loader data-hexo-plotly-mathjax="${mathJaxEnabled}">`,
    '(() => {',
    `  const options = ${serializeForInlineScript(bootOptions)};`,
    '  if (!window.HexoPlotly || typeof window.HexoPlotly.boot !== \'function\') {',
    '    const error = new Error(\'Hexo Plotly runtime failed to load\');',
    '    window.hexoPlotlyReady = Promise.reject(error);',
    '    window.plotlyMathReady = window.hexoPlotlyReady;',
    '    return;',
    '  }',
    '  window.HexoPlotly.boot(options);',
    '})();',
    '</script>'
  ].join('\n');
}

function registerLoader(hexo, config, i18n) {
  hexo.extend.filter.register(
    'after_render:html',
    function injectPlotly(html, locals) {
      const page = locals?.page || {};
      const pageOptedIn = page.plotly === true;
      const containsChart =
        html.includes(PLOTLY_CHART_MARKER) ||
        html.includes('data-plotly-chart');
      const mathJaxEnabled =
        page.plotly_mathjax === true ||
        html.includes('data-hexo-plotly-mathjax="true"') ||
        html.includes('data-plotly-mathjax="true"');

      if (
        (!pageOptedIn && !containsChart) ||
        html.includes(PLOTLY_LOADER_MARKER)
      ) {
        return html;
      }

      const injection = loaderHtml(
        hexo,
        config,
        i18n,
        page,
        mathJaxEnabled
      );
      if (/<\/head>/iu.test(html)) {
        return html.replace(/<\/head>/iu, `${injection}\n</head>`);
      }
      return `${injection}\n${html}`;
    },
    Number(hexo.config.plotly?.filter_priority) || 10
  );
}

module.exports = {
  loaderHtml,
  registerLoader
};
