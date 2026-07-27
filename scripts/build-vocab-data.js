/**
 * Build compact JLPT vocabulary dataset from OpenJLPT (CC BY-SA 4.0)
 * Source: https://github.com/evanclan/OpenJLPT
 * Enriched with Myanmar glosses via English→Myanmar keyword map.
 */
const fs = require('fs');
const path = require('path');
const { EN_MY } = require('./en-my-glosses');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');

function lookupMy(raw) {
  const key = String(raw || '').trim();
  if (!key) return null;
  return (
    EN_MY[key] ||
    EN_MY[key.toLowerCase()] ||
    EN_MY[key.replace(/^to\s+/i, '').toLowerCase()] ||
    EN_MY[key.replace(/^(a|an|the)\s+/i, '').toLowerCase()] ||
    null
  );
}

function myForMeanings(meanings) {
  const out = [];
  const seen = new Set();
  for (const m of meanings || []) {
    const key = String(m).trim();
    const hit = lookupMy(key);
    if (hit && !seen.has(hit)) {
      seen.add(hit);
      out.push(hit);
      continue;
    }
    // Try semicolon / slash segments
    const parts = key.split(/[;/]/).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      const h = lookupMy(p);
      if (h && !seen.has(h)) {
        seen.add(h);
        out.push(h);
      }
    }
  }
  return out;
}

const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
const byLevel = {};
let totalMy = 0;
let total = 0;

for (const lv of levels) {
  const raw = JSON.parse(
    fs.readFileSync(path.join(dataDir, `raw-vocab-${lv}.json`), 'utf8')
  );
  const items = raw.map((v, i) => {
    const meanings = v.meanings || [];
    const my = myForMeanings(meanings).slice(0, 4);
    if (my.length) totalMy++;
    total++;
    const ex0 = v.examples && v.examples[0];
    return {
      w: v.word,
      r: v.reading || '',
      lv: (v.level || lv).toUpperCase(),
      en: meanings.slice(0, 4),
      my,
      ex: ex0 ? [{ ja: ex0.ja || '', en: ex0.en || '' }] : [],
      id: `${lv}-${String(i + 1).padStart(4, '0')}`,
    };
  });
  byLevel[lv] = items;
  console.log(
    lv,
    items.length,
    'with my:',
    items.filter((x) => x.my.length).length
  );
}

const out = {
  meta: {
    source: 'OpenJLPT (evanclan/OpenJLPT)',
    license: 'CC BY-SA 4.0',
    attribution:
      'Vocabulary from OpenJLPT / JMDict-style glosses + JLPT lists (Jonathan Waller / tanos.co.uk). Myanmar glosses added by Learn with MK.',
    counts: Object.fromEntries(levels.map((lv) => [lv, byLevel[lv].length])),
    generatedAt: new Date().toISOString(),
  },
  levels: byLevel,
};

const outPath = path.join(dataDir, 'vocab.json');
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(
  'wrote',
  outPath,
  Math.round(fs.statSync(outPath).size / 1024) + 'KB',
  'total',
  total,
  'with myanmar',
  totalMy
);
