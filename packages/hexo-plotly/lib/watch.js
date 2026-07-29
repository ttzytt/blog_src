'use strict';

const path = require('node:path');
const { watch } = require('hexo-fs');
const { isPathInside } = require('./path');

function isWatchMode(hexo) {
  const command = hexo.env?.cmd;
  const args = hexo.env?.args || {};
  return (
    command === 'server' ||
    command === 's' ||
    args.watch === true ||
    args.w === true
  );
}

class ExternalDependencyWatcher {
  constructor(hexo, tracker, enabled) {
    this.hexo = hexo;
    this.tracker = tracker;
    this.enabled = enabled && isWatchMode(hexo);
    this.watcher = null;
    this.watchedDirectories = new Set();
    this.processing = new Set();
  }

  externalDirectories() {
    const directories = new Set();
    for (const filename of this.tracker.files()) {
      if (!isPathInside(this.hexo.source_dir, filename)) {
        directories.add(path.dirname(filename));
      }
    }
    return directories;
  }

  async sync() {
    if (!this.enabled) return;

    const nextDirectories = this.externalDirectories();
    if (!this.watcher && nextDirectories.size > 0) {
      this.watcher = await watch([...nextDirectories], {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 150,
          pollInterval: 50
        }
      });
      this.attachEvents();
      this.watchedDirectories = nextDirectories;
      return;
    }
    if (!this.watcher) return;

    const added = [...nextDirectories].filter(
      directory => !this.watchedDirectories.has(directory)
    );
    const removed = [...this.watchedDirectories].filter(
      directory => !nextDirectories.has(directory)
    );
    if (added.length > 0) this.watcher.add(added);
    if (removed.length > 0) await this.watcher.unwatch(removed);
    this.watchedDirectories = nextDirectories;
  }

  attachEvents() {
    const handle = filename => this.handleChange(filename);
    this.watcher
      .on('add', handle)
      .on('change', handle)
      .on('unlink', handle)
      .on('error', error => {
        this.hexo.log.error(
          { error },
          'Hexo Plotly dependency watcher failed'
        );
      });
  }

  async handleChange(filename) {
    const normalized = path.resolve(filename);
    if (!this.tracker.has(normalized) || this.processing.has(normalized)) return;

    this.processing.add(normalized);
    try {
      const count = await this.tracker.invalidate(normalized);
      if (count > 0) {
        this.hexo.log.info(
          'Plotly dependency changed; invalidated %d article(s): %s',
          count,
          path.relative(this.hexo.base_dir, normalized)
        );
        // Hexo's watch loop regenerates after source/theme process events.
        // External chart files are outside those boxes, so notify Hexo through
        // the same internal event used by its source watcher.
        this.hexo.source.emit('processAfter', {
          type: 'update',
          path: normalized
        });
      }
    } finally {
      this.processing.delete(normalized);
    }
  }

  async close() {
    if (!this.watcher) return;
    await this.watcher.close();
    this.watcher = null;
    this.watchedDirectories.clear();
  }
}

function registerWatch(hexo, config, tracker) {
  const externalWatcher = new ExternalDependencyWatcher(
    hexo,
    tracker,
    config.watch
  );

  hexo.extend.processor.register(
    sourcePath => {
      const filename = path.resolve(hexo.source_dir, sourcePath);
      return tracker.has(filename) ? {} : undefined;
    },
    async file => {
      if (file.type === 'skip') return;
      const count = await tracker.invalidate(file.source);
      if (count > 0) {
        hexo.log.info(
          'Plotly dependency changed; invalidated %d article(s): %s',
          count,
          file.path
        );
      }
    }
  );

  hexo.extend.filter.register(
    'before_generate',
    async () => {
      tracker.rebuild();
      await externalWatcher.sync();
    },
    1
  );

  hexo.extend.filter.register('before_exit', () => externalWatcher.close());
  hexo.once('exit', () => {
    externalWatcher.close().catch(error => {
      hexo.log.warn({ error }, 'Could not close Hexo Plotly dependency watcher');
    });
  });

  return externalWatcher;
}

module.exports = {
  ExternalDependencyWatcher,
  isWatchMode,
  registerWatch
};
