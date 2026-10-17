# Question data provenance

Snapshot prepared 17 October 2026. This independent game is not affiliated with Krillion.

## Recorded questions

`recorded.json` was seeded with 82 unique prompt variants from the public [Krillion Answers companion](https://krillionanswers.com/answer-finder/). Daily updates now use [Krillion Game](https://krillion-game.com/), with the exact provider and dated answer link retained on each changed question. Existing lists remain when their answers are unchanged. The compiler merges three near-identical legacy prompt pairs into 79 distinct recorded questions and maps retired IDs for device history. It preserves source URLs, dates, answer text and published tiers. These are publicly recorded lists, not a live official validator or a claim of complete original answer keys. The original game may keep unrevealed answer sheets private.

## Original questions and factual snapshots

`curated/definitions.mjs` defines 121 finite, scoped question sets with source links and notes. The additional bank spans geography, chemistry, space, culture, language, sports and other bounded reference sets. Review changing facts before extending dated sets. A source link identifies the reference; it does not imply an endorsement.

| Local snapshot | Source and transformations | Data terms |
| --- | --- | --- |
| `facts/countries.json` | [mledoze/countries](https://github.com/mledoze/countries/blob/master/countries.json): selected fields, filtered to the 193 UN member states. The upstream Vatican City UN-member flag was explicitly corrected by excluding VAT. Borders in questions also exclude non-members. | ODbL 1.0; country-derived data remains available under ODbL. |
| `facts/elements.json` | [Bowserinator/Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON/blob/master/PeriodicTableJSON.json): selected element fields; 118 elements. Classifications follow this dataset, and phases mean its stated reference conditions. | CC BY-SA 3.0; element-derived data is distributed under the same terms. |
| `facts/constellations.json` | [Astropy constellation names](https://github.com/astropy/astropy/blob/main/astropy/coordinates/data/constellation_names.dat), based on the 88 official IAU constellations via VizieR. Names extracted to JSON. | Astropy BSD license retained. |
| `house-frequency.json` | English Zipf values extracted with [wordfreq 3.1.1](https://github.com/rspeer/wordfreq), Robyn Speer and contributors. One offline value per distinct canonical answer; no runtime dependency. | Extracted data CC BY-SA 4.0; wordfreq software Apache 2.0. Upstream dataset attribution is retained. |

License texts and wordfreq's underlying data acknowledgments are in `licenses/`. These licenses apply to the stated components and their derived data; no blanket license for third-party recorded content is asserted. Editable derived data is provided here, including definition logic and the compiled bank. The public `/sources` page provides attribution during play.

## House scoring

English word frequency estimates familiarity, not actual answer popularity. The compiler ranks each answer set, assigns house tiers and selects one gem around the less familiar fifth. These are editorial ratings, not official Krillion scores or measured player statistics. Recorded tiers are never replaced by these ratings. Unknown answers are not invented by an AI at runtime.

Regenerate the compiled bank with `npm run build:bank`. To regenerate offline frequency values, install `wordfreq==3.1.1` in a separate authoring environment and run `scripts/rate-house.py`; Python is unnecessary for hosting, imports or gameplay.

The scheduled alternative-source import was verified in [run 39061519874](https://github.com/edfiisher/Games-to-Make/actions/runs/39061519874). It reads public pages/JSON, checks sizes, all published preview scores, and full dated question pages when homepage previews are stale. It does not execute third-party scripts. See [source research](../docs/DAILY-SOURCES.md).
