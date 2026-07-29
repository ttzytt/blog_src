'use strict';

const fs = require('node:fs');
const path = require('node:path');

let cachedLocaleDirectory;
let cachedLocales;

function localeDirectory() {
  if (!cachedLocaleDirectory) {
    cachedLocaleDirectory = path.dirname(
      require.resolve('plotly.js-locales/package.json')
    );
  }
  return cachedLocaleDirectory;
}

function availablePlotlyLocales() {
  if (!cachedLocales) {
    cachedLocales = fs
      .readdirSync(localeDirectory(), { withFileTypes: true })
      .filter(
        entry =>
          entry.isFile() &&
          entry.name.endsWith('.js') &&
          entry.name !== 'index.js'
      )
      .map(entry => entry.name.slice(0, -3))
      .sort();
  }
  return cachedLocales;
}

function selectPlotlyLocale(candidates) {
  const locales = availablePlotlyLocales();
  const lookup = new Map(locales.map(locale => [locale.toLowerCase(), locale]));

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    if (normalized === 'en' || normalized.startsWith('en-')) return 'en';

    const exact = lookup.get(normalized);
    if (exact) return exact;

    const base = normalized.split('-')[0];
    const baseMatch =
      lookup.get(base) || locales.find(locale => locale.startsWith(`${base}-`));
    if (baseMatch) return baseMatch;
  }

  return 'en';
}

function plotlyLocaleRegistrationName(locale) {
  if (locale === 'en') return 'en';

  const localeData = require(path.join(localeDirectory(), `${locale}.js`));
  return typeof localeData.name === 'string' && localeData.name
    ? localeData.name
    : locale;
}

module.exports = {
  availablePlotlyLocales,
  localeDirectory,
  plotlyLocaleRegistrationName,
  selectPlotlyLocale
};
