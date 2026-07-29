/* global hexo */

'use strict';

const register = require('./lib/register');

if (typeof hexo !== 'undefined') {
  register(hexo);
}

module.exports = register;
