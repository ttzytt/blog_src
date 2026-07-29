'use strict';

const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const yaml = require('js-yaml');
const { selectPlotlyLocale } = require('./plotly-locales');
const { translationPathFor } = require('./path');

const DEFAULT_LOCALE = 'en';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLanguage(language) {
  return String(language || '').trim().replaceAll('_', '-');
}

function requestedLanguages(hexo, context, override) {
  const configured = Array.isArray(hexo.config.language)
    ? hexo.config.language
    : [hexo.config.language];
  const languages = [
    override,
    context?.lang,
    context?.language,
    ...configured
  ];
  const candidates = [];

  for (const language of languages) {
    const normalized = normalizeLanguage(language);
    if (!normalized) continue;
    candidates.push(normalized);

    const baseLanguage = normalized.split('-')[0];
    if (baseLanguage !== normalized) candidates.push(baseLanguage);
  }

  return [...new Set(candidates)];
}

function selectLocale(availableLocales, candidates, fallback = DEFAULT_LOCALE) {
  const lookup = new Map(
    availableLocales.map(locale => [locale.toLowerCase(), locale])
  );

  for (const candidate of [...candidates, fallback]) {
    const normalized = candidate.toLowerCase();
    const exact = lookup.get(normalized);
    if (exact) return exact;

    const base = normalized.split('-')[0];
    const baseMatch =
      lookup.get(base) ||
      availableLocales.find(locale =>
        locale.toLowerCase().startsWith(`${base}-`)
      );
    if (baseMatch) return baseMatch;
  }

  return availableLocales[0];
}

function loadBuiltInTranslations() {
  const localeDirectory = path.join(__dirname, '..', 'locales');
  return Object.fromEntries(
    fs
      .readdirSync(localeDirectory, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.yml'))
      .map(entry => {
        const locale = entry.name.slice(0, -4);
        const filename = path.join(localeDirectory, entry.name);
        const messages = yaml.load(fs.readFileSync(filename, 'utf8'));
        return [locale, messages];
      })
  );
}

function validateCommonOverrides(overrides) {
  for (const [locale, messages] of Object.entries(overrides)) {
    if (!isPlainObject(messages)) {
      throw new Error(`plotly.i18n.${locale} must be a mapping`);
    }
    for (const [key, value] of Object.entries(messages)) {
      if (typeof value !== 'string') {
        throw new Error(`plotly.i18n.${locale}.${key} must be a string`);
      }
    }
  }
}

function createI18n(hexo, config) {
  const builtIns = loadBuiltInTranslations();
  validateCommonOverrides(config.i18n);
  const commonTranslations = { ...builtIns };

  for (const [locale, messages] of Object.entries(config.i18n)) {
    commonTranslations[locale] = {
      ...(commonTranslations[locale] || {}),
      ...messages
    };
  }

  function common(context, override) {
    const candidates = requestedLanguages(hexo, context, override);
    const locale = selectLocale(Object.keys(commonTranslations), candidates);
    return {
      locale,
      messages: commonTranslations[locale]
    };
  }

  function pageLocale(context, override) {
    const candidates = requestedLanguages(hexo, context, override);
    return candidates[0] || common(context, override).locale;
  }

  function plotlyLocale(context, override) {
    return selectPlotlyLocale(requestedLanguages(hexo, context, override));
  }

  return {
    common,
    pageLocale,
    plotlyLocale,
    requestedLanguages: (context, override) =>
      requestedLanguages(hexo, context, override)
  };
}

function parseChartTranslations(source, filename) {
  let parsed;
  try {
    parsed = yaml.load(source);
  } catch (error) {
    throw new Error(
      `Cannot parse Plotly translation file "${filename}": ${error.message}`
    );
  }

  if (!isPlainObject(parsed)) {
    throw new Error(
      `Plotly translation file "${filename}" must contain a YAML mapping`
    );
  }

  const defaultLocale =
    typeof parsed.default === 'string' && parsed.default.trim()
      ? normalizeLanguage(parsed.default)
      : DEFAULT_LOCALE;
  const translations = Object.fromEntries(
    Object.entries(parsed).filter(([locale]) => locale !== 'default')
  );
  const locales = Object.keys(translations);

  if (locales.length === 0) {
    throw new Error(
      `Plotly translation file "${filename}" does not define any locales`
    );
  }

  for (const locale of locales) {
    const messages = translations[locale];
    if (!isPlainObject(messages)) {
      throw new Error(
        `Plotly locale "${locale}" in "${filename}" must be a mapping`
      );
    }

    for (const [key, value] of Object.entries(messages)) {
      if (typeof value !== 'string') {
        throw new Error(
          `Plotly translation "${locale}.${key}" in "${filename}" must be a string`
        );
      }
    }
  }

  const referenceLocale = Object.hasOwn(translations, defaultLocale)
    ? defaultLocale
    : locales[0];
  const referenceKeys = Object.keys(translations[referenceLocale]).sort();

  for (const locale of locales) {
    const keys = Object.keys(translations[locale]).sort();
    if (
      keys.length !== referenceKeys.length ||
      keys.some((key, index) => key !== referenceKeys[index])
    ) {
      throw new Error(
        `Plotly locale "${locale}" in "${filename}" must define the same keys as ` +
          `"${referenceLocale}"`
      );
    }
  }

  return { defaultLocale, translations };
}

function selectChartTranslation(table, candidates) {
  const locales = Object.keys(table.translations);
  const locale = selectLocale(
    locales,
    [...candidates, table.defaultLocale],
    table.defaultLocale
  );
  return {
    locale,
    text: table.translations[locale]
  };
}

async function loadChartTranslation(hexo, i18n, codePath, context, override) {
  const translationPath = translationPathFor(codePath);
  const relativePath = path.relative(hexo.base_dir, translationPath);
  let source;

  try {
    source = await fsPromises.readFile(translationPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        locale: i18n.pageLocale(context, override),
        text: {}
      };
    }
    throw new Error(
      `Cannot read Plotly translation file "${relativePath}": ${error.message}`
    );
  }

  return selectChartTranslation(
    parseChartTranslations(source, relativePath),
    i18n.requestedLanguages(context, override)
  );
}

module.exports = {
  createI18n,
  loadChartTranslation,
  normalizeLanguage,
  parseChartTranslations,
  requestedLanguages,
  selectChartTranslation,
  selectLocale
};
