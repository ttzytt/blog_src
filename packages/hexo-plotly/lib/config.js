'use strict';

const path = require('node:path');
const { url_for: urlFor } = require('hexo-util');
const {
  ASSET_FILENAMES,
  DEFAULT_ASSET_DIR,
  DEFAULT_CDN_URL,
  DEFAULT_LOCALE_CDN_TEMPLATE,
  DEFAULT_MATHJAX_CDN_URL,
  DEFAULT_TIMEOUT_MS
} = require('./constants');

function normalizeAssetDir(value) {
  const normalized = String(value || DEFAULT_ASSET_DIR)
    .replaceAll('\\', '/')
    .replace(/^\/+|\/+$/gu, '');

  if (
    !normalized ||
    normalized.split('/').some(part => part === '.' || part === '..' || !part)
  ) {
    throw new Error(`Invalid plotly.asset_dir: ${value}`);
  }

  return normalized;
}

function routePath(assetDir, filename) {
  return path.posix.join(assetDir, filename);
}

function configuredUrl(value, fallback) {
  if (value === false || value === null) return null;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getConfig(hexo) {
  const raw = hexo.config.plotly || {};
  const assetDir = normalizeAssetDir(raw.asset_dir);
  const configuredTimeout = Number(raw.timeout_ms);
  const timeoutMs =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? Math.floor(configuredTimeout)
      : DEFAULT_TIMEOUT_MS;
  const siteAssetUrl = filename =>
    urlFor.call(hexo, routePath(assetDir, filename));

  return {
    assetDir,
    routes: {
      runtime: routePath(assetDir, ASSET_FILENAMES.runtime),
      stylesheet: routePath(assetDir, ASSET_FILENAMES.stylesheet),
      plotly: routePath(assetDir, ASSET_FILENAMES.plotly),
      mathjax: routePath(assetDir, ASSET_FILENAMES.mathjax),
      localeDir: routePath(assetDir, 'locales')
    },
    urls: {
      runtime: configuredUrl(
        raw.runtime_url || raw.theme_url,
        siteAssetUrl(ASSET_FILENAMES.runtime)
      ),
      stylesheet: configuredUrl(
        raw.stylesheet_url,
        siteAssetUrl(ASSET_FILENAMES.stylesheet)
      ),
      plotlyCdn: configuredUrl(raw.cdn_url, DEFAULT_CDN_URL),
      plotlyLocal: configuredUrl(
        raw.local_url,
        siteAssetUrl(ASSET_FILENAMES.plotly)
      ),
      mathJaxCdn: configuredUrl(
        raw.mathjax_cdn_url,
        DEFAULT_MATHJAX_CDN_URL
      ),
      mathJaxLocal: configuredUrl(
        raw.mathjax_local_url,
        siteAssetUrl(ASSET_FILENAMES.mathjax)
      ),
      localeCdnTemplate: configuredUrl(
        raw.locale_cdn_template,
        DEFAULT_LOCALE_CDN_TEMPLATE
      )
    },
    timeoutMs,
    watch: raw.watch !== false,
    requireFrontMatter: raw.require_front_matter !== false,
    stopInputPropagation: raw.stop_input_propagation === true,
    i18n: raw.i18n && typeof raw.i18n === 'object' ? raw.i18n : {}
  };
}

module.exports = {
  getConfig,
  normalizeAssetDir,
  routePath
};
