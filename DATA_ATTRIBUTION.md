# Data attribution

## Kanji dataset

Kanji entries (character, JLPT level, stroke count, onyomi, kunyomi, English meanings)
are derived from **[OpenJLPT](https://github.com/evanclan/OpenJLPT)** by evanclan.

- License: **CC BY-SA 4.0**
- Underlying sources credited by OpenJLPT:
  - [KANJIDIC2](https://www.edrdg.org/wiki/KANJIDIC_Project.html) (EDRDG, CC BY-SA)
  - JLPT level lists from [Jonathan Waller / tanos.co.uk](https://www.tanos.co.uk/jlpt/) (CC BY)

Myanmar glosses in `data/kanji.json` were added by **Learn with MK** by mapping common
English KANJIDIC glosses to Burmese. Coverage is strongest for N5 and common N4–N1 terms;
where no Myanmar gloss exists, the English meaning is shown.

## Stroke order diagrams

Stroke-order SVGs are loaded at runtime from **[KanjiVG](https://github.com/KanjiVG/kanjivg)**
via jsDelivr CDN when the device is online (KanjiVG license: CC BY-SA 3.0).
Stroke **counts** are always available offline from the local JSON.
