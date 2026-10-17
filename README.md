# Fresh Tracks

A skiing-themed rarity quiz: seven questions, 25 seconds per turn, and a skier who travels further down the mountain for rarer answers.

**Play:** https://flat-dive.onrender.com

## Start a run

Press **Start a new run**. Solo play starts immediately: no account, name, room code or archive selection is required. Seven distinct questions are chosen automatically.

The game remembers questions you have encountered in this browser. Unseen questions come first. After you have seen the whole bank, the least recently played questions return. Questions not reached in an abandoned run are still considered unseen. New tabs and later visits open the start screen; reloading an unfinished run in the same tab resumes it. Reloading a completed run returns to the start screen.

Progress lives in this browser's local storage. Clearing site data, switching browsers or using another device starts a separate history. An unfinished run uses session storage and also requires its server room to remain alive.

## Bring a friend

During any solo run, choose **Invite a friend**. Send the invite through your device's share sheet (including messaging apps), or copy the link. Opening it automatically joins that run. Your friend then presses **Start my run** to start their own timer. A six-character code can also be entered under **Taking a friend along?** on the home screen.

Everyone receives the same seven questions in the same order. Each player has an independent 25-second timer, and the shared scoreboard appears when a second skier joins. Up to 12 players can join. Names are optional and can be set before joining or starting.

## Questions and scoring

The included bank has **82 distinct questions and 60,672 recorded answer entries**. It covers daily, general knowledge, film, sport and geography questions from the user-supplied companion site [Krillion Answers](https://krillionanswers.com/answer-finder/). Its 294 historical question records were deduplicated by question text, with the latest recorded answer set retained. Repeated historical records do not count as new questions.

Scoring preserves recorded tiers: 10, 15, 30, 60, 85 or 100 points; a miss earns zero. Each point means ten metres skied, up to 7,000 metres. The on-screen tier names use the new skiing theme. Correctly recorded answers end the turn; unlisted answers can be retried until the timer expires. Answer sheets with search are available after all seven turns.

This is an independent game inspired by Krillion, not an exact remake or a live Krillion validator. Alternative spellings and answers absent from the recorded data may be rejected. The source endpoint does not provide aliases. Some questions have no recorded 100-point answer. The game does not invent missing tiers. The bank is finite; random combinations are not newly authored questions.

## Run locally

Requires Node.js 24 or newer. There are no third-party runtime dependencies.

```sh
npm test
npm start
```

The server listens on all interfaces on port 3000 (`PORT` overrides this). For a local home network, connect using the host computer's LAN address and port; the host must keep the server running and permit connections through its firewall. [Hosting instructions](HOSTING.md) explain the existing Render setup.

## Development and data refresh

- `server.js`: runs, invitations, deadlines and scoring.
- `questions.js`: answer lookup and selection, preferring unseen questions.
- `public/`: interface, mountain illustration, skier animation and device history.
- `data/questions.json`: recorded answers, original tiers, source URLs and retrieval metadata.
- `test/game.test.js`: solo, multiplayer, fresh selection, expiry, scoring and persistence tests.

Refreshing the recorded data is optional and never needed to start the server:

```sh
node --use-env-proxy scripts/import-questions.js
```

The importer checks coverage against the companion site's reported index size, verifies answer counts and tier values, removes repeated questions and writes only after validation succeeds. If the source grows beyond the current search coverage, it stops rather than silently saving a partial refresh. It needs network access to krillionanswers.com; the included bank works without that access.

Room state is in memory and clears on server restart or redeployment. Inactive rooms expire after six hours. Free Render hosting can sleep and take time to wake up. Device question history survives a server restart; active rooms and scores do not. Deploy one server instance because room state is not shared across instances.
