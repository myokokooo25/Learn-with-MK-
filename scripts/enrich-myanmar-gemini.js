/**
 * Enrich kanji.json + vocab.json Myanmar glosses via Gemini.
 *
 * Usage:
 *   set GEMINI_API_KEY=your_key
 *   npm run my:enrich
 *
 * Options:
 *   --missing-only   only fill empty `my` (default)
 *   --all            retranslate every unique English gloss
 *   --limit=N        process at most N unique glosses this run
 *   --batch=40       glosses per Gemini request
 *
 * Progress is saved to data/gemini-my-cache.json so runs can resume.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const cachePath = path.join(dataDir, 'gemini-my-cache.json');
const kanjiPath = path.join(dataDir, 'kanji.json');
const vocabPath = path.join(dataDir, 'vocab.json');

function loadDotEnv(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadDotEnv('.env.local');
loadDotEnv('.env');

const args = process.argv.slice(2);
const ALL = args.includes('--all');
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const BATCH = Number((args.find((a) => a.startsWith('--batch=')) || '').split('=')[1] || 40);
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  console.error(`
Missing Gemini API key.

1) Get a key: https://aistudio.google.com/apikey
2) PowerShell:
   $env:GEMINI_API_KEY = "YOUR_KEY"
   npm run my:enrich

Or put GEMINI_API_KEY=... in a .env.local file (gitignored) and re-run.
`);
  process.exit(1);
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function saveJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj));
}

function loadCache() {
  if (!fs.existsSync(cachePath)) return { map: {}, meta: { updatedAt: null } };
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch (e) {
    return { map: {}, meta: { updatedAt: null } };
  }
}

function saveCache(cache) {
  cache.meta = cache.meta || {};
  cache.meta.updatedAt = new Date().toISOString();
  cache.meta.model = MODEL;
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 0));
}

function collectGlosses(datasets, missingOnly) {
  const need = new Set();
  for (const data of datasets) {
    for (const list of Object.values(data.levels || {})) {
      for (const item of list) {
        const hasMy = item.my && item.my.length;
        if (missingOnly && hasMy) continue;
        for (const e of item.en || []) {
          const t = String(e).trim();
          if (t) need.add(t);
        }
      }
    }
  }
  return [...need];
}

async function translateBatch(glosses) {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(MODEL) +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);

  const prompt =
    `You are a Japanese-learning lexicographer translating English JLPT glosses into natural Myanmar (Burmese).\n` +
    `Rules:\n` +
    `- Output ONLY a JSON array of objects: [{"en":"...","my":"..."}]\n` +
    `- Keep the same order and same "en" strings exactly.\n` +
    `- Myanmar should be short study glosses (1–6 words), natural for learners.\n` +
    `- For verbs like "to eat", use Myanmar verb form (e.g. စားသည်).\n` +
    `- If a gloss has multiple senses separated by ";", translate the main sense or join with "/" .\n` +
    `- Do not use English letters in "my" except rare loanwords.\n` +
    `- No markdown fences.\n\n` +
    `Glosses:\n` +
    JSON.stringify(glosses);

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('Gemini HTTP ' + res.status + ': ' + t.slice(0, 400));
  }
  const json = await res.json();
  const text =
    (((json.candidates || [])[0] || {}).content || {}).parts || []
  )
    .map((p) => p.text || '')
    .join('');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) throw new Error('Bad JSON from Gemini: ' + text.slice(0, 200));
    parsed = JSON.parse(m[0]);
  }
  if (!Array.isArray(parsed)) throw new Error('Expected array from Gemini');
  const out = {};
  for (const row of parsed) {
    if (!row || !row.en || !row.my) continue;
    out[String(row.en).trim()] = String(row.my).trim();
  }
  return out;
}

function applyCache(data, cache, missingOnly) {
  let filled = 0;
  let touched = 0;
  for (const list of Object.values(data.levels || {})) {
    for (const item of list) {
      const hasMy = item.my && item.my.length;
      if (missingOnly && hasMy) continue;
      const next = [];
      const seen = new Set();
      for (const e of item.en || []) {
        const key = String(e).trim();
        const my = cache.map[key];
        if (my && !seen.has(my)) {
          seen.add(my);
          next.push(my);
        }
      }
      if (next.length) {
        if (!hasMy || !missingOnly) {
          item.my = next.slice(0, 4);
          touched++;
          if (!hasMy) filled++;
        }
      }
    }
  }
  return { filled, touched };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const kanji = loadJson(kanjiPath);
  const vocab = loadJson(vocabPath);
  const cache = loadCache();
  cache.map = cache.map || {};

  const missingOnly = !ALL;
  let todo = collectGlosses([kanji, vocab], missingOnly).filter((g) => !cache.map[g]);
  if (LIMIT > 0) todo = todo.slice(0, LIMIT);

  console.log(
    'mode:',
    missingOnly ? 'missing-only' : 'all',
    '| todo glosses:',
    todo.length,
    '| cache size:',
    Object.keys(cache.map).length,
    '| model:',
    MODEL
  );

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    process.stdout.write(
      `batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(todo.length / BATCH)} (${batch.length})... `
    );
    try {
      const map = await translateBatch(batch);
      let n = 0;
      for (const [en, my] of Object.entries(map)) {
        if (my) {
          cache.map[en] = my;
          n++;
        }
      }
      saveCache(cache);
      console.log('ok +' + n);
    } catch (err) {
      console.log('FAIL');
      console.error(err.message || err);
      console.error('Progress saved. Re-run the same command to resume.');
      process.exit(1);
    }
    await sleep(800);
  }

  const kStats = applyCache(kanji, cache, missingOnly);
  const vStats = applyCache(vocab, cache, missingOnly);
  if (!kanji.meta) kanji.meta = {};
  if (!vocab.meta) vocab.meta = {};
  kanji.meta.myanmarSource =
    'Gemini (' + MODEL + ') + Learn with MK keyword map; cache data/gemini-my-cache.json';
  vocab.meta.myanmarSource =
    'Gemini (' + MODEL + ') + Learn with MK keyword map; cache data/gemini-my-cache.json';
  kanji.meta.myanmarUpdatedAt = new Date().toISOString();
  vocab.meta.myanmarUpdatedAt = new Date().toISOString();

  saveJson(kanjiPath, kanji);
  saveJson(vocabPath, vocab);

  // recount
  let km = 0,
    kt = 0,
    vm = 0,
    vt = 0;
  for (const list of Object.values(kanji.levels))
    for (const x of list) {
      kt++;
      if (x.my && x.my.length) km++;
    }
  for (const list of Object.values(vocab.levels))
    for (const x of list) {
      vt++;
      if (x.my && x.my.length) vm++;
    }

  console.log('kanji applied: filled', kStats.filled, 'touched', kStats.touched, '→', km + '/' + kt);
  console.log('vocab applied: filled', vStats.filled, 'touched', vStats.touched, '→', vm + '/' + vt);
  console.log('done. cache →', cachePath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
