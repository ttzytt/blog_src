'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function resolveCodePath(hexo, filename) {
  if (!filename) {
    throw new Error('Plotly tag requires a JavaScript file path');
  }

  if (path.isAbsolute(filename)) {
    throw new Error(
      `Plotly code path must be relative to the Hexo site root: ${filename}`
    );
  }

  const codePath = path.resolve(hexo.base_dir, filename);
  if (!isPathInside(hexo.base_dir, codePath)) {
    throw new Error(`Plotly code path cannot leave the Hexo site root: ${filename}`);
  }

  if (path.extname(codePath).toLowerCase() !== '.js') {
    throw new Error(`Plotly code file must use the .js extension: ${filename}`);
  }

  return codePath;
}

async function assertRealPathInside(hexo, codePath, filename) {
  const [realBase, realCode] = await Promise.all([
    fs.realpath(hexo.base_dir),
    fs.realpath(codePath)
  ]);

  if (!isPathInside(realBase, realCode)) {
    throw new Error(
      `Plotly code path resolves outside the Hexo site root: ${filename}`
    );
  }

  return realCode;
}

function translationPathFor(codePath) {
  return codePath.replace(/\.js$/iu, '.i18n.yml');
}

module.exports = {
  assertRealPathInside,
  isPathInside,
  resolveCodePath,
  translationPathFor
};
