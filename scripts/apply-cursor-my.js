/**
 * Apply Cursor-agent Myanmar gloss maps into kanji.json + vocab.json
 * Maps live in scripts/cursor-my-maps/*.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const mapDir = path.join(__dirname, 'cursor-my-maps');

function loadMaps() {
  const map = Object.create(null);
  // shared keyword map first (lower priority)
  try {
    const { EN_MY } = require('./en-my-glosses');
    Object.assign(map, EN_MY);
  } catch (e) {}
  if (!fs.existsSync(mapDir)) return map;
  for (const file of fs.readdirSync(mapDir).sort()) {
    // only finished map modules (skip _build helpers / temps)
    if (!file.endsWith('.js') || file.startsWith('_')) continue;
    const full = path.join(mapDir, file);
    delete require.cache[require.resolve(full)];
    const part = require(full);
    Object.assign(map, part);
  }
  return map;
}

function lookup(map, en) {
  const key = String(en || '').trim();
  if (!key) return null;
  if (map[key]) return map[key];
  const lower = key.toLowerCase();
  if (map[lower]) return map[lower];
  const noTo = lower.replace(/^to\s+/, '');
  if (noTo !== lower && map[noTo]) {
    const base = map[noTo];
    return /သည်$/.test(base) ? base : base + 'သည်';
  }
  const noArt = lower.replace(/^(a|an|the)\s+/, '');
  if (noArt !== lower && map[noArt]) return map[noArt];
  // first semicolon / slash segment
  const part = key.split(/[;/]/)[0].trim();
  if (part && part !== key) return lookup(map, part);
  return null;
}

function applyFile(fileName, map) {
  const p = path.join(dataDir, fileName);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let filled = 0;
  let improved = 0;
  for (const list of Object.values(data.levels || {})) {
    for (const item of list) {
      const next = [];
      const seen = new Set();
      for (const e of item.en || []) {
        const my = lookup(map, e);
        if (my && !seen.has(my)) {
          seen.add(my);
          next.push(my);
        }
      }
      if (!next.length) continue;
      const had = item.my && item.my.length;
      if (!had) {
        item.my = next.slice(0, 4);
        filled++;
      } else {
        // only fill empty slots / replace if first was missing quality? keep existing, merge new unique
        for (const m of next) {
          if (!item.my.includes(m) && item.my.length < 4) {
            item.my.push(m);
            improved++;
          }
        }
      }
    }
  }
  if (!data.meta) data.meta = {};
  data.meta.myanmarSource =
    (data.meta.myanmarSource || '') +
    (data.meta.myanmarSource ? ' · ' : '') +
    'Cursor agent gloss maps (scripts/cursor-my-maps)';
  data.meta.myanmarUpdatedAt = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(data));
  return { filled, improved };
}

const map = loadMaps();
console.log('map entries', Object.keys(map).length);
const k = applyFile('kanji.json', map);
const v = applyFile('vocab.json', map);
console.log('kanji filled', k.filled, 'merged', k.improved);
console.log('vocab filled', v.filled, 'merged', v.improved);

function count(file) {
  const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  let m = 0,
    t = 0;
  for (const list of Object.values(data.levels)) {
    for (const x of list) {
      t++;
      if (x.my && x.my.length) m++;
    }
  }
  return m + '/' + t;
}
console.log('coverage kanji', count('kanji.json'), 'vocab', count('vocab.json'));
