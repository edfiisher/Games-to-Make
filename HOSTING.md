# Hosting Fresh Tracks

The existing game address is **https://flat-dive.onrender.com**. The service name remains `flat-dive` so the skiing update keeps the same address.

`render.yaml` describes a free Render Node service. It builds with `node --version && npm test` and starts with `npm start`, using Node 24.19.0. The game reads Render's `PORT` automatically and needs no game API keys. A normal push to GitHub's `main` branch triggers deployment when automatic deploys are enabled in Render.

For a new deployment, use [Deploy on Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fedfiisher%2FGames-to-Make), sign in, connect the repository if requested, and select the Free plan. Do not create a second service merely to update the existing one.

Free hosting may sleep when idle. Rooms and scores are in memory and disappear on restart or deployment. Inactive rooms expire after six hours. Browser question history is stored on each device and survives server restarts. Use one server instance; rooms are not shared between instances.

Anyone with the game address can start a solo run. Invite codes let friends join the same seven-question run but do not make the whole website password protected.

After deployment, check `/api/info` for `name: "Fresh Tracks"`, `version: 2` and `questionCount: 82`, then verify starting solo, sharing an invitation, and scoring an answer. A successful deployment or open port alone does not verify those behaviours.
