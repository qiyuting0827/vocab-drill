'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'pages-upload');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'functions', 'api'), { recursive: true });

const files = [
  'index.html',
  'words.js',
  'bank-select.js',
  'parser.js',
  'quiz.js',
  'students.js',
  'sync.js',
  '_worker.js',
];

files.forEach((name) => {
  fs.copyFileSync(path.join(root, name), path.join(out, name));
});
fs.copyFileSync(
  path.join(root, 'functions', 'api', 'sync.js'),
  path.join(out, 'functions', 'api', 'sync.js')
);

console.log(out);
