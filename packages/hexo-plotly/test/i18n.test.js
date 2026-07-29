'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  parseChartTranslations,
  selectChartTranslation,
  selectLocale
} = require('../lib/i18n');
const {
  plotlyLocaleRegistrationName,
  selectPlotlyLocale
} = require('../lib/plotly-locales');

test('chart translations use exact, base-language, then default fallback', () => {
  const table = parseChartTranslations(
    [
      'default: zh-CN',
      'zh-CN:',
      '  title: 标题',
      'en:',
      '  title: Title'
    ].join('\n'),
    'chart.i18n.yml'
  );

  assert.deepEqual(selectChartTranslation(table, ['en-US']), {
    locale: 'en',
    text: { title: 'Title' }
  });
  assert.deepEqual(selectChartTranslation(table, ['fr']), {
    locale: 'zh-CN',
    text: { title: '标题' }
  });
});

test('chart translations require the same string keys in every locale', () => {
  assert.throws(
    () =>
      parseChartTranslations(
        [
          'zh-CN:',
          '  title: 标题',
          'en:',
          '  title: Title',
          '  axis: Axis'
        ].join('\n'),
        'chart.i18n.yml'
      ),
    /must define the same keys/u
  );

  assert.throws(
    () =>
      parseChartTranslations(
        ['en:', '  title:', '    nested: value'].join('\n'),
        'chart.i18n.yml'
      ),
    /must be a string/u
  );
});

test('common and Plotly locale selection handles regional languages', () => {
  assert.equal(
    selectLocale(['en', 'zh-CN', 'zh-TW'], ['zh-Hans-CN']),
    'zh-CN'
  );
  assert.equal(selectPlotlyLocale(['zh-CN']), 'zh-cn');
  assert.equal(plotlyLocaleRegistrationName('zh-cn'), 'zh-CN');
  assert.equal(selectPlotlyLocale(['en-US']), 'en');
});
