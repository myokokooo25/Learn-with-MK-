# Learn with MK — 文法

Japanese grammar reference (JLPT N5–N1) with Japanese and Burmese explanations, plus study tools.

## Run (web)

```bash
npm install
npm run serve
```

Or: `npx serve .` / open `index.html` in a browser.

## Android app

The same UI is wrapped with **Capacitor**. See **[ANDROID.md](./ANDROID.md)** for full steps.

Short version (needs [Android Studio](https://developer.android.com/studio)):

```bash
npm install
npm run web:sync
npx cap add android
npm run cap:sync
npm run android:open
```

Then run or build an APK from Android Studio.

## Study features

**Grammar**
- Progress tracking (Learning / Mastered) with per-level %
- Favorites, quizzes (N5–N1), SRS review, TTS, notes, print, PWA

**Kanji (dashboard)**
- JLPT N5–N1 kanji grid (2,211 characters)
- Onyomi / kunyomi / English / Myanmar / stroke count
- Stroke-order diagram (KanjiVG, when online)
- Save / Learning / Mastered per kanji
- Search by character, reading, English, or Myanmar

**Vocabulary · 語彙 (dashboard)**
- JLPT N5–N1 word list (8,334 entries from OpenJLPT)
- Reading / English / Myanmar / example sentence
- Save / Learning / Mastered per word
- Search by word, reading, English, or Myanmar

Toggle **Grammar | Kanji | Vocab** in the header. Data sources: see [DATA_ATTRIBUTION.md](./DATA_ATTRIBUTION.md).

Progress is stored in your browser / WebView (`localStorage`).
