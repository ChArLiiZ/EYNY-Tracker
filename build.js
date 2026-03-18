const esbuild = require('esbuild');
const fs = require('fs');

const banner = `// ==UserScript==
// @name         EYNY Tracker
// @namespace    kuro-eyny
// @version      0.6.0
// @description  待看/已看/已下載/略過 管理（v0.6）
// @match        https://www*.eyny.com/forum.php?*
// @match        https://www*.eyny.com/forum-*.html
// @match        https://www*.eyny.com/thread-*.html
// @match        https://www*.eyny.com/search.php*
// @match        https://hgamefree.info/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
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
