/**
 * Build compact kanji dataset from OpenJLPT (CC BY-SA 4.0)
 * Source: https://github.com/evanclan/OpenJLPT
 * Enriched with Myanmar glosses via English→Myanmar keyword map.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');

const { EN_MY } = require('./en-my-glosses');

function myForMeanings(meanings) {
  const out = [];
  const seen = new Set();
  for (const m of meanings || []) {
    const key = String(m).trim();
    const hit = EN_MY[key] || EN_MY[key.toLowerCase()];
    if (hit && !seen.has(hit)) {
      seen.add(hit);
      out.push(hit);
    }
  }
  // fallback: map word-by-word for short glosses
  if (!out.length && meanings && meanings[0]) {
    const parts = String(meanings[0])
      .split(/[,;/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) {
      const hit = EN_MY[p] || EN_MY[p.toLowerCase()];
      if (hit && !seen.has(hit)) {
        seen.add(hit);
        out.push(hit);
      }
    }
  }
  return out;
}

function cleanReading(r) {
  return String(r || '')
    .replace(/[-.]/g, '')
    .replace(/\./g, '');
}

const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
const all = [];
const byLevel = {};

for (const lv of levels) {
  const raw = JSON.parse(
    fs.readFileSync(path.join(dataDir, `raw-kanji-${lv}.json`), 'utf8')
  );
  const items = raw.map((k, i) => {
    const meanings = k.meanings || [];
    return {
      c: k.character,
      lv: (k.level || lv).toUpperCase(),
      st: k.strokes || 0,
      on: (k.onyomi || []).slice(0, 4),
      kun: (k.kunyomi || []).slice(0, 5),
      en: meanings.slice(0, 4),
      my: myForMeanings(meanings).slice(0, 4),
      fr: k.freq || 9999,
      id: `${lv}-${String(i + 1).padStart(4, '0')}`,
    };
  });
  byLevel[lv] = items;
  all.push(...items);
  console.log(lv, items.length, 'with my:', items.filter((x) => x.my.length).length);
}

const out = {
  meta: {
    source: 'OpenJLPT (evanclan/OpenJLPT)',
    license: 'CC BY-SA 4.0',
    attribution:
      'Kanji data from OpenJLPT / KANJIDIC2 (EDRDG) + JLPT lists (Jonathan Waller / tanos.co.uk). Myanmar glosses added by Learn with MK.',
    counts: Object.fromEntries(levels.map((lv) => [lv, byLevel[lv].length])),
    generatedAt: new Date().toISOString(),
  },
  levels: byLevel,
};

const outPath = path.join(dataDir, 'kanji.json');
fs.writeFileSync(outPath, JSON.stringify(out));
console.log('wrote', outPath, Math.round(fs.statSync(outPath).size / 1024) + 'KB', 'total', all.length);
