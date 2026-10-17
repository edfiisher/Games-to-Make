# Hosting Fresh Tracks

The existing game address is **https://flat-dive.onrender.com**. The service name remains `flat-dive` so the skiing update keeps the same address.

`render.yaml` describes a free Render Node service. It builds with `node --version && npm test` and starts with `npm start`, using Node 24.19.0. The game reads Render's `PORT` automatically and needs no game API keys. A normal push to GitHub's `main` branch triggers deployment when automatic deploys are enabled in Render.

For a new deployment, use [Deploy on Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fedfiisher%2FGames-to-Make), sign in, connect the repository if requested, and select the Free plan. Do not create a second service merely to update the existing one.

Free hosting may sleep when idle. Rooms and scores are in memory and disappear on restart or deployment. Inactive rooms expire after six hours. Browser question history is stored on each device and survives server restarts. Use one server instance; rooms are not shared between instances.

Anyone with the game address can start a solo run. Invite codes let friends join the same seven-question run but do not make the whole website password protected.

After deployment, check `/api/info` for `name: "Fresh Tracks"`, `version: 4` and `questionCount: 200` (or higher after imports), then verify the untimed ready screen, starting the timer, sharing an invitation before a turn, confirming a suggested correction, and scoring an answer. A successful deployment or open port alone does not verify those behaviours.


## Daily question updates

The workflow in `.github/workflows/daily-questions.yml` runs at 06:17 UTC daily (07:17 during British Summer Time). Once it is on `main`, open **GitHub → Games-to-Make → Actions → Daily question bank update → Run workflow** for an initial check. The workflow requires Actions to be enabled and permission to push repository contents. Repository protection rules may prevent its direct commits. A green run with no new public records is normal and makes no commit.

A successful import changes the files in GitHub; Render must then deploy that commit. For the existing `flat-dive` service, enable automatic deploys from `main` in Render, or use **Manual Deploy → Deploy latest commit**. Do not create another service. Confirm `/api/info` reports the expected version and bank size after deployment.

No scheduler or scraper runs inside the game server, and no private Krillion answer endpoint is accessed. Newly advertised questions wait until the companion publishes answers. If source coverage, counts or tiers fail validation, the job fails and the existing deployed bank remains usable. Check failed Actions runs for source changes. GitHub scheduling is best effort and may stop after 60 days of inactivity in a public repository.

The current bank needs only a few megabytes of disk. Free hosting still has resource and availability limits, including idle sleep; adding more questions does not remove those limits. Keep the compiled bank in version control rather than depending on writes to Render's ephemeral filesystem.
