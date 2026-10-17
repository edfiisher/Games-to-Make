# Free Counterline address

The selected option is a free Render address using Counterline. Render assigns each web service its own onrender.com subdomain when the service is created. A new free service is the reliable route to a Counterline address; changing the game's name or editing its current dashboard label should not be treated as changing the assigned address.

Create it in the Render dashboard:

1. Select **New → Web Service** and connect `edfiisher/Games-to-Make` from GitHub.
2. Use these values:

| Setting | Value |
| --- | --- |
| Name | `counterline` |
| Branch | `main` |
| Language / runtime | Node |
| Instance type | **Free** |
| Build command | `npm test` |
| Start command | `npm start` |
| Environment variable | `NODE_VERSION` = `24.19.0` |
| Auto-Deploy | **On Commit** |
| Health check path, if shown | `/` |

3. Select **Deploy Web Service**. Render supplies the exact address. Aim for `counterline.onrender.com`; availability is determined by Render and it may add a suffix. Do not buy a custom domain for this setup.
4. Open the new address and confirm `/api/info` reports `name: "Counterline"`, `version: 5` and at least 200 questions. Start a solo run and test a friend invitation. Keep the existing `flat-dive` service until the new one is verified.

The repository already supports a different hostname: asset/API links are relative and invitations use `location.origin`. No application code change is required. The new service reads the same GitHub question bank; future daily bank commits deploy automatically when its GitHub connection and On Commit setting are enabled.

Both services have separate in-memory rooms. Friends should use the new address and its invite links once you switch. Browser question history belongs to each address, so the new address starts a separate history. Existing visits to flat-dive are unaffected while that service remains running.

The root `render.yaml` still describes the existing flat-dive service. These instructions create the additional service through **New → Web Service**, rather than altering the current Blueprint. Once Render assigns the new hostname, update README and HOSTING links to that verified address. The old service can then be considered separately; it has not been deleted or redirected by this change.

References: [Render web services](https://render.com/docs/web-services), [Render deployment settings](https://render.com/docs/deploys), and the [request for editable onrender subdomains](https://feedback.render.com/features/p/ability-to-change-onrendercom-sub-domain).
