/**
 * JS Linting
 */

let colors = require('mocha/lib/reporters/base').colors;
colors['pass'] = '1;36';
colors['error stack'] = '1;36';
colors['fast'] = '1;36';
colors['light'] = '1;36';
colors['diff gutter'] = '1;36';

require('mocha-eslint')([
  'common',
  'config',
  'models',
  'routes',
  'test',
  'app/app.js'
]);
