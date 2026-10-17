# Counterline

A skiing-themed rarity quiz: seven questions, 25 seconds per turn, and a skier who travels further down the mountain for rarer answers.

**Play:** https://counterline.onrender.com

## Start a run

Press **Play solo** to prepare an untimed run. Seven distinct questions are chosen automatically, but the first question stays hidden. Invite friends or take your time, then press **Start timer** to reveal it and begin your 25 seconds. No account, name, room code or archive selection is required.

The game remembers questions you have encountered in this browser. Unseen questions come first. After you have seen the whole bank, the least recently played questions return. Questions not reached in an abandoned run are still considered unseen. New tabs and later visits open the start screen; reloading an unfinished run in the same tab resumes it. Reloading a completed run returns to the start screen.

Progress lives in this browser's local storage. Clearing site data, switching browsers or using another device starts a separate history. An unfinished run uses session storage and also requires its server room to remain alive.

## Bring a friend

Before starting your timer or between turns, choose **Invite friends**. Invitations are disabled during a timed answer so sharing cannot accidentally consume your turn. Send the invite through your device's share sheet (including messaging apps), or copy the link. Opening it automatically joins that run. Your friend then presses **Start timer** to reveal the first question and start their own clock. A six-character code can also be entered under **Play with friends** on the home screen.

Everyone receives the same seven questions in the same order. Each player has an independent 25-second timer, and the shared scoreboard appears when a second skier joins. Up to 12 players can join. Names are optional. Friends joining by link can change their generated name on the ready screen, before starting their timer. Choosing **Create a group run** on the home screen opens the invitation immediately.

The Counterline rename retains question history and names saved under the previous branding. Sound preference is saved on this device. An existing room still needs to be alive to resume; deployment resets rooms.

## Questions and scoring

Krillion’s [FAQ](https://krillion.io/faq) describes merging dictionaries, wiki pages and other reference datasets into answer sets. Its rarity ratings use measurable frequency where practical, and otherwise combine LLM assistance with a manual pass. Our original sets use the offline reference-and-frequency approach below, with explicit house scoring.

The included bank has **200 distinct questions and 62,195 answer entries**: 79 recorded questions from [Krillion Answers](https://krillionanswers.com/answer-finder/) and [Krillion Game](https://krillion-game.com/) and 121 original questions built from bounded reference sets. Three repeated legacy prompts are merged, with old history IDs remapped. Topics include geography, science, language, music, literature, sport, space, animals and food. Selection prefers unseen questions and a mixture of topics. Repeated historical records and random combinations do not count as new questions.

Recorded questions preserve their published tiers: 10, 15, 30, 60, 85 or 100 points; a miss earns zero. Each point means ten metres skied, up to 7,000 metres. The score guide explains all six tiers; results and the shared scoreboard show points, while the mountain shows distance. Correctly recorded answers end the turn; unlisted answers can be retried until the timer expires. Answer sheets with search are available after all seven turns.

This is an independent game inspired by Krillion, not an exact remake or a live Krillion validator. Case, accents and punctuation are normalized. Known alternate names and close spellings are offered as a **Did you mean…?** correction. For example, gondola suggests Cable car station for the station question. **Accept & submit** scores the recorded answer; **Keep typing** dismisses it. Corrections retain the original deadline and must be accepted before time runs out. Ambiguous or unrelated guesses are not converted into arbitrary answers. The source endpoint does not provide aliases; supported alternate names are maintained locally, so unknown synonyms may still be rejected. Some questions have no recorded 100-point answer. Recorded questions do not acquire invented tiers. Our original questions use **house rarity tiers**, based on offline English word frequency as a familiarity proxy, with one designated gem per set. These are not measured player popularity or official Krillion scores. Question notes and the [sources page](https://counterline.onrender.com/sources) explain scope and scoring; [data provenance](data/SOURCES.md) retains source and license details. The bank is finite.

## Run locally

Requires Node.js 24 or newer. There are no third-party runtime dependencies.

```sh
npm test
npm start
```

The server listens on all interfaces on port 3000 (`PORT` overrides this). For a local home network, connect using the host computer's LAN address and port; the host must keep the server running and permit connections through its firewall. [Hosting instructions](HOSTING.md) explain the existing Render setup.

## Development and data refresh

- `server.js`: runs, invitations, deadlines and scoring; paginated answer sheets are available only after completion.
- `questions.js`: unseen-first selection and lazily compiled, bounded answer-matching indexes.
- `answer-matching.js`: alternate names, conservative spelling suggestions and contextual short forms.
- `data/recorded.json`: retained public answer records and their original tiers.
- `data/curated/definitions.mjs` and `data/facts/`: original question definitions and source snapshots.
- `data/house-frequency.json`: precomputed familiarity ratings; no AI or frequency service is called during play.
- `data/questions.json`: compact, compiled bank used by the server.
- `scripts/build-bank.js`: validates and reproducibly compiles both kinds of question.
- `scripts/sync-daily.js`: imports dated public lists from Krillion Game, with safe merging and checkpoints.
- `scripts/sync-recorded.js`: optional legacy index importer; its former source blocks GitHub runners.
- `test/`: game, correction, finite-set integrity and safe-import tests.

```sh
npm run build:bank
npm test
npm run profile
npm run sync:questions
```

Only the final command requires network access. When this workspace needs its environment proxy, use `node --use-env-proxy scripts/sync-daily.js`. `node scripts/sync-daily.js --check` validates without saving. The old `scripts/import-questions.js` entry point delegates to the new daily importer; `npm run sync:legacy` retains the former provider importer for optional use.

The daily importer reads [Krillion Game](https://krillion-game.com/), its dated archive and its public answer API. It validates seven distinct dated prompts, list sizes, answer records and tier/score pairs. Every visible answer preview must agree. If a homepage preview is stale, a changed list must be corroborated by the full dated question page. Unresolved contradictions fail without writing the saved bank; an API list identical to existing data may simply retain that data. No account or original-site private endpoint is used. Older questions and stable IDs are retained. Requests are spaced by at least one second; missed days catch up chronologically in batches of up to seven.

`.github/workflows/daily-questions.yml` is **enabled at 06:17 UTC daily** (07:17 during British Summer Time, 06:17 in winter). Its [first successful hosted run](https://github.com/edfiisher/Games-to-Make/actions/runs/39061519874) fetched and validated 4,108 answer entries, passed all 30 tests, and pushed the updated bank. It refreshes changed lists and adds distinct new prompts; repeated questions are not counted as new. A saved checkpoint avoids rescanning the entire archive. An identical same-day import makes no commit. Checkpoint-only commits carry `[skip render]`, avoiding needless deployment; changed playable banks use a normal commit.

The live service is **counterline**. Its **Render → Settings → Auto-Deploy → On Commit** setting controls automatic deployment of future bank commits. See [hosting](HOSTING.md). The workflow is operational on GitHub; dashboard settings cannot be inspected from this workspace. Schedules are best effort, source formats can change, and GitHub can disable public-repository schedules after 60 days without activity.

To grow toward 1,000, add clearly scoped sets with authoritative sources and alternate names to the definitions, regenerate familiarity values offline with `scripts/rate-house.py` (authoring-only dependency: `wordfreq==3.1.1`), rebuild, review the answer sets and run tests. Avoid counting paraphrases as new questions. Runtime requires neither Python nor wordfreq. New recorded questions can grow the bank automatically; original questions still need factual review.

## Storage and performance

The compiled 200-question bank is about **3.6 MB** (3.4 MiB); all data including retained records and licenses is about 7 MB. It stays on the server. Browsers receive seven prompts and small state updates; answer sheets are searched and loaded in pages of at most 100 answers. The skier is inline vector artwork, with no image download or animation dependency.

Matching indexes compile only for played questions. Their cache is bounded by 16 questions and 30,000 keys, except a single oversized question can remain. A local profile loaded the bank in about 40 ms, used about 51 MiB RSS initially and peaked around 205 MiB after walking all questions. These are local measurements, not a guarantee of Render latency or simultaneous-player capacity. Re-run `npm run profile` when expanding the bank. There are no third-party runtime dependencies or per-answer API costs.

Room state is in memory and clears on server restart or redeployment. Inactive rooms expire after six hours. Free Render hosting can sleep and take time to wake up. Device question history survives a server restart; active rooms and scores do not. Deploy one server instance because room state is not shared across instances.

## Graphics and rewards

The skier uses original flat SVG artwork in `public/index.html`, matching the mountain's palette and shapes. `public/skier.js` bends the knees and elbows with a two-bone joint rig; boots stay on the skis, arms lead alternating pole plants, and the torso shifts weight through turns. `public/descent.js` follows the route with smoothly steered skis, takeoff anticipation, tucked jumps and flexed landings. Standout answers add a vertical-axis 360 and gold snow stars. Snow comes from grounded edges and landings. Six rarity profiles vary movement and powder, while the score card and optional sound also vary by tier.

One animation loop owns both the quiet idle stance and scored travel. Polling does not restart it. Idle motion draws at 30fps; movement pauses while the mountain is offscreen or the tab is hidden. Reduced motion freezes the articulated pose, skips travel and particles, and updates the score position immediately.


## Review and maintenance

The [18-area review](docs/REVIEW.md) records before/after scores, implemented improvements, evidence and remaining limits. The [import access guide](docs/IMPORT-ACCESS.md) explains the source-side HTTP 403 and includes a ready-to-send permission request.

The interface uses plain labels and two short introductory sentences. On phones the start controls appear before the illustration. Keyboard focus follows phase changes, timers avoid continuous screen-reader announcements, and contrast meets the automated checks. Results provide source links and retry failed answer loads. A reconnecting notice explains that timed questions continue during a connection failure; returning to the tab refreshes state immediately. Sound remains opt-in.

Static files use content-based ETags, so repeat visits can revalidate unchanged files with empty 304 responses. API state remains uncached. Files are cached for the server process lifetime; restart Node after editing to apply changes.
