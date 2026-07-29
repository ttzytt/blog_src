'use strict';

const registerAssets = require('./assets');
const { getConfig } = require('./config');
const { DependencyTracker } = require('./dependencies');
const { createI18n } = require('./i18n');
const { registerLoader } = require('./loader');
const { registerTag } = require('./tag');
const { registerWatch } = require('./watch');

const REGISTERED = Symbol.for('hexo-plotly.registered');

function register(hexo) {
  if (hexo[REGISTERED]) return hexo[REGISTERED];

  const config = getConfig(hexo);
  const i18n = createI18n(hexo, config);
  const tracker = new DependencyTracker(hexo);

  registerAssets(hexo, config);
  registerTag(hexo, config, i18n);
  registerLoader(hexo, config, i18n);
  const watcher = registerWatch(hexo, config, tracker);

  const state = Object.freeze({ config, i18n, tracker, watcher });
  Object.defineProperty(hexo, REGISTERED, {
    configurable: false,
    enumerable: false,
    value: state,
    writable: false
  });
  return state;
}

module.exports = register;
