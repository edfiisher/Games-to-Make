# Hosting Counterline

The live game address is **https://counterline.onrender.com**, on the Render service **counterline**. Use this address for new games and invitations.

The service uses Node 24.19.0, builds with `npm test` and starts with `npm start`. The game reads Render's `PORT` automatically and needs no game API keys. A normal push to GitHub's `main` branch triggers deployment when automatic deploys are enabled in Render.

The owner created the Counterline service through Render's dashboard using the same GitHub repository. Update that service for future releases. The root `render.yaml` still describes the earlier `flat-dive` Blueprint; it has been left unchanged to avoid altering a separate service. Do not apply it as the configuration for the new service. The [address guide](docs/CHANGE-ADDRESS.md) records its dashboard settings.

Free hosting may sleep when idle. Rooms and scores are in memory and disappear on restart or deployment. Inactive rooms expire after six hours. Browser question history is stored on each device and survives server restarts. Use one server instance; rooms are not shared between instances.

Anyone with the game address can start a solo run. Invite codes let friends join the same seven-question run but do not make the whole website password protected.

After deployment, check `/api/info` for `name: "Counterline"`, `version: 5` and `questionCount: 200` (or higher after imports), then verify the untimed ready screen, starting the timer, sharing an invitation before a turn, confirming a suggested correction, and scoring an answer. A successful deployment or open port alone does not verify those behaviours.


## Daily question updates

The daily workflow is enabled at **06:17 UTC** (07:17 during British Summer Time; 06:17 in winter). It imports from the public [Krillion Game](https://krillion-game.com/) companion, validates the records, runs tests and commits real changes. A [successful hosted run](https://github.com/edfiisher/Games-to-Make/actions/runs/39061519874) verified the complete fetch/build/test/push sequence. It processes duplicate prompts once and retains older questions. Source failure or unresolved score contradictions leave the saved bank untouched.

The previous provider, krillionanswers.com, returned HTTP 403 to GitHub; it is no longer required for scheduled imports. Public data from it is retained. See [source research](docs/DAILY-SOURCES.md) and [current import status](docs/IMPORT-ACCESS.md).

## Automatic Render deployment

Dashboard settings for the Counterline service:

1. Open Render → **counterline → Settings**.
2. Under **Build & Deploy**, confirm the connected GitHub repository is `edfiisher/Games-to-Make`, branch **main**.
3. Set **Auto-Deploy → On Commit** and save.
4. If a release has not deployed, use **Manual Deploy → Deploy latest commit**, then check `/api/info` for Counterline, version 5 and at least 200 questions. The current release is already live at the address above.

After that, the flow is: scheduled GitHub import → validate data and run tests → commit changed bank → Render deploys that commit. No daily manual deploy is needed. The game loads its bank at startup, so merely writing a file to GitHub does not change an already running server.

Choose **On Commit** for this setup. GitHub's built-in workflow token does not trigger another push workflow, so a bot's new data commit can have no CI checks attached; **After CI Checks Pass** would then prevent Render deploying it. The importer tests the new bank before committing, and Render's build runs `npm test` again.

A checkpoint-only commit includes `[skip render]`; no change to playable content means no unnecessary deployment. Real bank changes use a normal commit. Active rooms reset on deployment because they are in memory; browser question history survives. The import is scheduled in the morning to reduce disruption.

Automatic deployment requires Render's GitHub connection. A service configured only with a public repository URL must first be linked through the Git provider connection; see [Render's deployment documentation](https://render.com/docs/deploys). The new service was created separately from the old Blueprint, so its dashboard settings apply. Those settings cannot be inspected from this workspace.

## Free Counterline address

**https://counterline.onrender.com** is now live. Invitations automatically use this hostname. The old flat-dive service has not been deleted or redirected. Rooms and browser history are separate between the two addresses; use Counterline for new games.
