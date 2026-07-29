'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const registerAssets = require('../lib/assets');
const { loaderHtml } = require('../lib/loader');
const { parseTagOptions } = require('../lib/tag');

test('generated locale assets are browser scripts rather than CommonJS', () => {
  let generateAssets;
  const hexo = {
    extend: {
      generator: {
        register(name, generator) {
          assert.equal(name, 'hexo-plotly-assets');
          generateAssets = generator;
        }
      }
    }
  };
  const config = {
    routes: {
      runtime: 'assets/runtime.js',
      stylesheet: 'assets/styles.css',
      plotly: 'assets/plotly.js',
      mathjax: 'assets/mathjax.js',
      localeDir: 'assets/locales'
    }
  };

  registerAssets(hexo, config);
  const locale = generateAssets().find(
    route => route.path === 'assets/locales/zh-cn.js'
  );
  const source = locale.data();

  assert.match(source, /window\.Plotly\.register/u);
  assert.doesNotMatch(source, /module\.exports/u);
});

test('loader emits escaped, subdirectory-safe boot options', () => {
  const hexo = {
    config: {
      root: '/en/',
      url: 'https://example.com'
    }
  };
  const config = {
    routes: { localeDir: 'assets/locales' },
    urls: {
      stylesheet: '/en/assets/styles.css',
      runtime: '/en/assets/runtime.js',
      plotlyCdn: 'https://example.com/plotly.js',
      plotlyLocal: '/en/assets/plotly.js',
      mathJaxCdn: 'https://example.com/mathjax.js',
      mathJaxLocal: '/en/assets/mathjax.js',
      localeCdnTemplate: 'https://example.com/{locale}.js'
    },
    stopInputPropagation: false,
    timeoutMs: 1234
  };
  const i18n = { plotlyLocale: () => 'zh-cn' };
  const html = loaderHtml(hexo, config, i18n, {}, true);

  assert.match(html, /data-hexo-plotly-loader/u);
  assert.equal(
    html.includes('"localeLocalUrl":"/en/assets/locales/zh-cn.js"'),
    true
  );
  assert.match(html, /"locale":"zh-CN"/u);
  assert.match(html, /"mathJaxEnabled":true/u);
  assert.match(html, /"timeoutMs":1234/u);
});

test('tag options reject unknown, duplicate, and invalid language values', () => {
  assert.deepEqual(parseTagOptions(['lang=en-US'], 'post.md'), {
    lang: 'en-US'
  });
  assert.throws(
    () => parseTagOptions(['locale=en'], 'post.md'),
    /Unknown Plotly tag option/u
  );
  assert.throws(
    () => parseTagOptions(['lang=en', 'lang=zh-CN'], 'post.md'),
    /Duplicate Plotly tag option/u
  );
  assert.throws(
    () => parseTagOptions(['lang=../../en'], 'post.md'),
    /Invalid Plotly language/u
  );
});
