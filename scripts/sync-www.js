const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');

const files = [
  'index.html',
  'app-features.css',
  'app-features.js',
  'kanji-app.css',
  'kanji-app.js',
  'vocab-app.css',
  'vocab-app.js',
  'manifest.webmanifest',
  'sw.js',
  'icon.svg',
];

fs.mkdirSync(www, { recursive: true });
fs.mkdirSync(path.join(www, 'data'), { recursive: true });

for (const file of files) {
  const src = path.join(root, file);
  const dest = path.join(www, file);
  if (!fs.existsSync(src)) {
    console.warn('skip missing:', file);
    continue;
  }
  fs.copyFileSync(src, dest);
  console.log('copied', file);
}

['kanji.json', 'vocab.json'].forEach(function (name) {
  const src = path.join(root, 'data', name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(www, 'data', name));
    console.log('copied data/' + name);
  }
});

console.log('www ready →', www);
