const esbuild = require('esbuild');
const fs = require('fs');

const banner = `// ==UserScript==
// @name         EYNY Tracker
// @namespace    kuro-eyny
// @version      0.4.0
// @description  待看/已看/已下載管理（v0.4）
// @match        https://www*.eyny.com/forum.php?*
// @match        https://www*.eyny.com/forum-*.html
// @match        https://www*.eyny.com/thread-*.html
// @match        https://www*.eyny.com/search.php*
// @grant        none
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
    console.log('Build complete: dist/eyny-tracker.user.js');
  });
}
