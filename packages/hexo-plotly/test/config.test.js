'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getConfig, normalizeAssetDir } = require('../lib/config');

function createHexo(root = '/') {
  return {
    config: {
      root,
      url: 'https://example.com',
      plotly: {}
    }
  };
}

test('getConfig creates subdirectory-safe local asset URLs', () => {
  const config = getConfig(createHexo('/notes/'));

  assert.equal(
    config.urls.runtime,
    '/notes/assets/hexo-plotly/hexo-plotly.js'
  );
  assert.equal(
    config.urls.plotlyLocal,
    '/notes/assets/hexo-plotly/plotly-3.7.0.min.js'
  );
  assert.equal(config.timeoutMs, 10000);
});

test('getConfig accepts an arbitrary namespaced asset directory', () => {
  const hexo = createHexo('/');
  hexo.config.plotly.asset_dir = 'vendor/charts';
  const config = getConfig(hexo);

  assert.equal(config.routes.runtime, 'vendor/charts/hexo-plotly.js');
  assert.equal(config.urls.stylesheet, '/vendor/charts/hexo-plotly.css');
});

test('normalizeAssetDir rejects traversal and empty directories', () => {
  assert.throws(() => normalizeAssetDir('../assets'), /Invalid plotly\.asset_dir/u);
  assert.throws(() => normalizeAssetDir('./assets'), /Invalid plotly\.asset_dir/u);
  assert.throws(() => normalizeAssetDir('/'), /Invalid plotly\.asset_dir/u);
});
