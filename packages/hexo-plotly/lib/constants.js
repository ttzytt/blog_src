'use strict';

module.exports = {
  ASSET_FILENAMES: {
    runtime: 'hexo-plotly.js',
    stylesheet: 'hexo-plotly.css',
    plotly: 'plotly-3.7.0.min.js',
    mathjax: 'mathjax-3.2.2-tex-svg.js'
  },
  DEFAULT_ASSET_DIR: 'assets/hexo-plotly',
  DEFAULT_CDN_URL:
    'https://cdn.jsdelivr.net/npm/plotly.js@3.7.0/dist/plotly.min.js',
  DEFAULT_LOCALE_CDN_TEMPLATE:
    'https://cdn.plot.ly/plotly-locale-{locale}-latest.js',
  DEFAULT_MATHJAX_CDN_URL:
    'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js',
  DEFAULT_TIMEOUT_MS: 10000,
  PLOTLY_CHART_MARKER: 'data-hexo-plotly-chart',
  PLOTLY_LOADER_MARKER: 'data-hexo-plotly-loader'
};
