'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolveCodePath, translationPathFor } = require('./path');

const PLOTLY_TAG = /\{%\s*plotly\s+([^%]*?)\s*%\}/gu;

function documentKey(modelName, source) {
  return `${modelName}:${source}`;
}

function tagCodePaths(hexo, raw) {
  const dependencies = new Set();

  for (const match of String(raw || '').matchAll(PLOTLY_TAG)) {
    const args = match[1].trim().split(/\s+/u);
    const filename = args[1];
    if (!filename) continue;

    try {
      const codePath = resolveCodePath(hexo, filename);
      if (!fs.existsSync(codePath)) continue;
      dependencies.add(codePath);
      dependencies.add(translationPathFor(codePath));
    } catch {
      // Tag rendering reports invalid paths with article context. Dependency
      // discovery deliberately ignores them so watch mode can still start.
    }
  }

  return dependencies;
}

class DependencyTracker {
  constructor(hexo) {
    this.hexo = hexo;
    this.byFile = new Map();
    this.documents = new Map();
  }

  rebuild() {
    this.byFile.clear();
    this.documents.clear();
    this.addModel('Post');
    this.addModel('Page');
  }

  addModel(modelName) {
    const model = this.hexo.model(modelName);
    if (!model) return;

    for (const document of model.toArray()) {
      const source = document.source;
      if (!source) continue;
      const key = documentKey(modelName, source);
      const entry = { key, modelName, source };
      const dependencies = tagCodePaths(this.hexo, document.raw);
      this.documents.set(key, { ...entry, dependencies });

      for (const dependency of dependencies) {
        const normalized = path.resolve(dependency);
        if (!this.byFile.has(normalized)) this.byFile.set(normalized, new Set());
        this.byFile.get(normalized).add(entry);
      }
    }
  }

  has(filename) {
    return this.byFile.has(path.resolve(filename));
  }

  files() {
    return [...this.byFile.keys()];
  }

  async invalidate(filename) {
    const normalized = path.resolve(filename);
    const affected = this.byFile.get(normalized);
    if (!affected || affected.size === 0) return 0;

    let count = 0;
    for (const entry of affected) {
      const model = this.hexo.model(entry.modelName);
      const document = model?.findOne({ source: entry.source });
      if (!document) continue;

      document.content = null;
      document.excerpt = null;
      document.more = null;
      await document.save();
      count += 1;
    }
    return count;
  }
}

module.exports = {
  DependencyTracker,
  tagCodePaths
};
