# Flat Dive

A private, browser-based game inspired by Krillion's seven-round rarity game, with replayable archived daily dives. It is not an exact remake and is not affiliated with Krillion.

## Play locally

Requires Node.js 24 or newer. There are no external runtime dependencies.

```sh
npm start
```

Open port 3000 in your browser. Enter a name and leave the room code blank to create a room. Other players use the same server address and room code. On a shared home network, use the host computer's LAN address, with port 3000. The host computer must keep the server running, and its firewall must permit connections. The server listens on all interfaces. For Internet play, deploy it to a Node-compatible host with HTTPS; this repository has not been deployed.

For a shared Internet address, follow [the hosting instructions](HOSTING.md).
The included `render.yaml` prepares a free Render web service; it has not been
deployed.

[Deploy on Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fedfiisher%2FGames-to-Make)

Each player starts independently. The room creator chooses an archived date (or the independent practice set). Everyone joining that room gets the same seven prompts and sees the live scoreboard. Each prompt allows 25 seconds; unlisted answers can be retried until the timer expires. Valid answers earn 10, 15, 30, 60, 85 or 100 points. A point corresponds to ten metres of depth. The server enforces timers and scores. The answer sheets appear after the seventh round.

## Current limits

- Included: seven daily dives (11–17 October 2026), 49 questions, and 52,342 recorded answer entries.
- Four source questions have no recorded 100-point answer; the importer does not invent missing tiers.
- The included archive covers the complete daily dives available through the companion site search at import time. This is not the entire historical Krillion archive. Replaying a date repeats its questions.
- Archived answers and tiers are recorded by the independent companion site krillionanswers.com, not verified against the live Krillion validator. Aliases are not supplied by that endpoint. A valid answer or alternative spelling may be absent. The separately labelled practice set still uses locally curated tiers.
- No automatic spelling correction, automatic daily updates, accounts, saved history, themed packs or exact visual assets.
- Rooms and scores are in memory. Restarting the server clears them. The browser remembers a session only while the server retains it.
- Private rooms use an invitation code, not account authentication. This prototype has no production abuse controls.
- No public hosting deployment has been verified.

REA 6.5.0 was used to inspect the public browser client. Reference downloads and analysis are outside this project, under `/workspace/reference`. The original answer database and server implementation were not obtained. The visible rules and tier values are documented in `RESEARCH.md`.

## Development

```sh
npm test
npm start
```

`data/archive.json` contains recorded questions, answer tiers and source links. Refresh manually with `node --use-env-proxy scripts/import-archive.js` (network access to krillionanswers.com required). Import checks counts and rejects partial dives before writing. `questions.js` owns the independent practice answer data. `server.js` owns rooms, deadlines and scoring. `public/` contains the browser interface. Set `PORT` to change the listening port (default 3000).
