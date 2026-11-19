#!/usr/bin/env node
/* Bundelt src/* tot één script: dist/esails-keuzehulp.js
   Gebruik: node tools/build.js */
const fs = require('fs');
const path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, '..', 'src', p), 'utf8');
const css = src('style.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '').trim();
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const out = [
  `/*! eSails Keuzehulp v${pkg.version} — gebouwd ${new Date().toISOString()} — bron: src/ (niet in dit bestand wijzigen) */`,
  src('core.js'),
  src('catalog.js').replace(/return (\{[\s\S]*\});\s*\}\);\s*$/, (m, j) => 'return ' + JSON.stringify(JSON.parse(j)) + ';\n});\n'),
  src('pakket.js'),
  src('live.js'),
  `(function(w){w.ESKH_CSS=${JSON.stringify(css)};})(window);`,
  src('ui.js')
].join('\n;\n');

// Alles naar ASCII (\uXXXX): werkt ook als de host geen charset=utf-8 meestuurt.
const ascii = out.replace(/[^\x00-\x7f]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
const file = path.join(__dirname, '..', 'dist', 'esails-keuzehulp.js');
fs.writeFileSync(file, ascii);
console.log('dist/esails-keuzehulp.js', (ascii.length / 1024).toFixed(1) + ' kB');
