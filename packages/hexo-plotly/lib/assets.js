'use strict';

const path = require('node:path');
const { createReadStream } = require('hexo-fs');
const { availablePlotlyLocales, localeDirectory } = require('./plotly-locales');

function assetRoute(route, source) {
  return {
    path: route,
    data: () => createReadStream(source)
  };
}

function localeRoute(route, locale) {
  return {
    path: route,
    data: () => {
      const localeData = require(path.join(localeDirectory(), `${locale}.js`));
      const serialized = JSON.stringify(localeData)
        .replaceAll('\u2028', '\\u2028')
        .replaceAll('\u2029', '\\u2029');

      return [
        '(() => {',
        "  'use strict';",
        '  if (!window.Plotly || typeof window.Plotly.register !== \'function\') {',
        `    throw new Error('Plotly must load before locale ${locale}');`,
        '  }',
        `  window.Plotly.register(${serialized});`,
        '})();',
        ''
      ].join('\n');
    }
  };
}

function registerAssets(hexo, config) {
  const assetDirectory = path.join(__dirname, '..', 'assets');
  const plotlySource = require.resolve('plotly.js-dist-min/plotly.min.js');
  const mathJaxSource = require.resolve('mathjax/es5/tex-svg.js');

  hexo.extend.generator.register('hexo-plotly-assets', () => {
    const routes = [
      assetRoute(
        config.routes.runtime,
        path.join(assetDirectory, 'hexo-plotly.js')
      ),
      assetRoute(
        config.routes.stylesheet,
        path.join(assetDirectory, 'hexo-plotly.css')
      ),
      assetRoute(config.routes.plotly, plotlySource),
      assetRoute(config.routes.mathjax, mathJaxSource)
    ];

    for (const locale of availablePlotlyLocales()) {
      routes.push(
        localeRoute(
          path.posix.join(config.routes.localeDir, `${locale}.js`),
          locale
        )
      );
    }

    return routes;
  });
}

module.exports = registerAssets;
