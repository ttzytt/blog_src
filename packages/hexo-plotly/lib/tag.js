'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { PLOTLY_CHART_MARKER } = require('./constants');
const { escapeHtml, serializeForInlineScript } = require('./html');
const { loadChartTranslation } = require('./i18n');
const { assertRealPathInside, resolveCodePath } = require('./path');

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

function registerTag(hexo, config, i18n) {
  hexo.extend.tag.register(
    'plotly',
    async function plotlyTag(args) {
      const [chartId, filename, ...remainingArgs] = args;
      const articlePath =
        this.source || this.path || this.title || 'unknown article';
      let height = '420';

      if (remainingArgs.length > 0 && !remainingArgs[0].includes('=')) {
        height = remainingArgs.shift();
      }
      const options = parseTagOptions(remainingArgs, articlePath);

      if (config.requireFrontMatter && this.plotly !== true) {
        throw new Error(
          `Plotly tag in "${articlePath}" requires "plotly: true" in Front Matter`
        );
      }

      if (!chartId || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(chartId)) {
        throw new Error(
          `Invalid Plotly chart id "${chartId || ''}" in "${articlePath}"`
        );
      }

      if (!/^\d+$/u.test(height) || Number(height) <= 0) {
        throw new Error(
          `Invalid Plotly chart height "${height}" in "${articlePath}"`
        );
      }

      const requestedCodePath = resolveCodePath(hexo, filename);
      let codePath;
      try {
        codePath = await assertRealPathInside(
          hexo,
          requestedCodePath,
          filename
        );
      } catch (error) {
        error.message =
          `Cannot resolve Plotly code file "${filename}" for "${articlePath}": ` +
          error.message;
        throw error;
      }

      const chartTranslation = await loadChartTranslation(
        hexo,
        i18n,
        codePath,
        this,
        options.lang
      );
      let code;
      try {
        code = await fs.readFile(codePath, 'utf8');
      } catch (error) {
        error.message =
          `Cannot read Plotly code file "${filename}" for "${articlePath}": ` +
          error.message;
        throw error;
      }

      const safeCode = code.replace(/<\/script/giu, '<\\/script');
      const chartIdLiteral = serializeForInlineScript(chartId);
      const chartFilenameLiteral = serializeForInlineScript(
        path.basename(filename)
      );
      const common = i18n.common(this, options.lang).messages;
      const failureTextLiteral = serializeForInlineScript(common.load_failed);
      const chartI18nLiteral = serializeForInlineScript({
        locale: chartTranslation.locale,
        common: {
          controlSeparator: common.control_separator,
          linearScale: common.linear_scale,
          logarithmicScale: common.logarithmic_scale
        },
        text: chartTranslation.text
      });
      const mathJaxEnabled = this.plotly_mathjax === true;

      return [
        `<div id="${escapeHtml(chartId)}" ${PLOTLY_CHART_MARKER} data-plotly-chart data-hexo-plotly-mathjax="${mathJaxEnabled}" data-plotly-mathjax="${mathJaxEnabled}" data-plotly-locale="${escapeHtml(chartTranslation.locale)}" aria-busy="true" style="width:100%;height:${height}px">`,
        '  <div class="hexo-plotly-loading plotly-chart__loading" role="status" aria-live="polite">',
        '    <span class="hexo-plotly-spinner" aria-hidden="true"></span>',
        `    <span>${escapeHtml(common.loading)}</span>`,
        '  </div>',
        '</div>',
        '<script>',
        '(() => {',
        `  const target = document.getElementById(${chartIdLiteral});`,
        `  const chartI18n = Object.freeze(${chartI18nLiteral});`,
        '  const ready = window.hexoPlotlyReady || window.plotlyMathReady ||',
        '    Promise.reject(new Error(\'Hexo Plotly loader was not initialized\'));',
        '  ready.then(() => {',
        '    if (!target) throw new Error(\'Plotly chart container was not found\');',
        '    const loading = target.querySelector(\'.hexo-plotly-loading\');',
        safeCode,
        '    const renderReady = target.plotlyRenderReady || Promise.resolve();',
        '    return renderReady.then(() => {',
        '      loading?.remove();',
        '      target.setAttribute(\'aria-busy\', \'false\');',
        '    });',
        '  }).catch(error => {',
        `    console.error('[Hexo Plotly] Failed to render chart ' + ${chartFilenameLiteral} + '.', error);`,
        '    if (target) {',
        `      target.textContent = ${failureTextLiteral};`,
        '      target.setAttribute(\'aria-busy\', \'false\');',
        '      target.setAttribute(\'role\', \'alert\');',
        '    }',
        '  });',
        '})();',
        '</script>'
      ].join('\n');
    },
    { async: true }
  );
}

module.exports = {
  parseTagOptions,
  registerTag
};
