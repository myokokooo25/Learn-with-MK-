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

const kanjiSrc = path.join(root, 'data', 'kanji.json');
if (fs.existsSync(kanjiSrc)) {
  fs.copyFileSync(kanjiSrc, path.join(www, 'data', 'kanji.json'));
  console.log('copied data/kanji.json');
}

console.log('www ready →', www);
