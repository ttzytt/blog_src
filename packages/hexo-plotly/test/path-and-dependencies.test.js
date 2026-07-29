'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DependencyTracker, tagCodePaths } = require('../lib/dependencies');
const {
  isPathInside,
  resolveCodePath,
  translationPathFor
} = require('../lib/path');

test('code paths stay inside the site and use JavaScript files', () => {
  const baseDir = path.resolve('example-site');
  const hexo = { base_dir: baseDir };

  assert.equal(
    resolveCodePath(hexo, 'charts/example.js'),
    path.join(baseDir, 'charts', 'example.js')
  );
  assert.throws(
    () => resolveCodePath(hexo, '../outside.js'),
    /cannot leave/u
  );
  assert.throws(
    () => resolveCodePath(hexo, 'charts/example.json'),
    /\.js extension/u
  );
  assert.equal(
    translationPathFor(path.join(baseDir, 'charts', 'example.js')),
    path.join(baseDir, 'charts', 'example.i18n.yml')
  );
  assert.equal(isPathInside(baseDir, baseDir), false);
});

test('dependency discovery and invalidation cover code and adjacent i18n', async t => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hexo-plotly-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));

  const chartDirectory = path.join(baseDir, 'graph_code');
  const chartPath = path.join(chartDirectory, 'chart.js');
  fs.mkdirSync(chartDirectory);
  fs.writeFileSync(chartPath, 'Plotly.newPlot(target, []);');

  let saves = 0;
  const document = {
    source: '_posts/example.md',
    raw: '{% plotly example graph_code/chart.js 400 %}',
    content: '<p>old</p>',
    excerpt: '<p>old</p>',
    more: '<p>old</p>',
    async save() {
      saves += 1;
    }
  };
  const model = {
    toArray: () => [document],
    findOne: query => (query.source === document.source ? document : null)
  };
  const hexo = {
    base_dir: baseDir,
    model: name => (name === 'Post' ? model : null)
  };

  const dependencies = tagCodePaths(hexo, document.raw);
  assert.equal(dependencies.has(chartPath), true);
  assert.equal(
    dependencies.has(path.join(chartDirectory, 'chart.i18n.yml')),
    true
  );

  const tracker = new DependencyTracker(hexo);
  tracker.rebuild();
  assert.equal(await tracker.invalidate(chartPath), 1);
  assert.equal(document.content, null);
  assert.equal(document.excerpt, null);
  assert.equal(document.more, null);
  assert.equal(saves, 1);
});
