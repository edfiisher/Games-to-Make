# Put the game online

The project is prepared for a Render web service. No hosting account has been
connected and no deployment has been created.

1. Open [Deploy on Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fedfiisher%2FGames-to-Make).
2. Create or sign into a Render account. The link selects this GitHub project.
3. If requested, connect GitHub and allow Render to read `Games-to-Make`.
4. Render reads `render.yaml`. Review that it selects the **Free** plan before
   creating the service. Do not select a paid plan unless you want one.
5. After deployment succeeds, use the HTTPS address Render provides. Create a
   room and share that address and the room code with your flatmates.

If using **New → Web Service** instead, select Node, use
`node --version && npm test` as the build command, `npm start` as the start
command, and `NODE_VERSION=24.19.0` as an environment variable. The server reads
Render's `PORT` automatically. No passwords or API keys are required by the game.

The free service can sleep when idle, so opening it may take a while. Rooms and
scores are currently held in memory and disappear whenever the service restarts,
including during a deployment. Choose one server instance; rooms are not shared
across instances. A paid service and persistent storage are later improvements,
not prerequisites to trying this version together.

Room codes provide an invitation mechanism, not a password-protected website.
Anyone who has the game address can create a room. This is an early prototype,
not a hardened public game platform.

## What gets uploaded

Game source, the recorded archive data and its source attribution, tests, and
documentation. The upstream REA checkout and raw investigation downloads are
outside this repository and are not included. No credentials are required or
included. Whether these files are publicly visible depends on the repository's
GitHub visibility setting.
