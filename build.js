const esbuild = require('esbuild');
const pkg = require('./package.json');

// Read version from package.json (CI updates this via npm version before build)
const version = pkg.version || '0.0.0';

const banner = `// ==UserScript==
// @name         EYNY Tracker
// @namespace    kuro-eyny
// @version      ${version}
// @description  待看/已看/已下載/略過 管理（v${version}）
// @match        https://www*.eyny.com/forum.php?*
// @match        https://www*.eyny.com/forum-*.html
// @match        https://www*.eyny.com/thread-*.html
// @match        https://www*.eyny.com/search.php*
// @match        https://hgamefree.info/*
// @downloadURL  https://github.com/ChArLiiZ/EYNY-Tracker/releases/latest/download/eyny-tracker.user.js
// @updateURL    https://github.com/ChArLiiZ/EYNY-Tracker/releases/latest/download/eyny-tracker.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      api.github.com
// @connect      gist.githubusercontent.com
// ==/UserScript==`;

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  outfile: 'dist/eyny-tracker.user.js',
  banner: { js: banner },
  charset: 'utf8',
};

if (watch) {
  esbuild.context(buildOptions).then(ctx => {
    ctx.watch();
    console.log('Watching for changes...');
  });
} else {
  esbuild.build(buildOptions).then(() => {
    console.log(`Build complete: dist/eyny-tracker.user.js (v${version})`);
  });
}
