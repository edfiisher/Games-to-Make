# Free Counterline address

**Live address: https://counterline.onrender.com**. The owner created the new service on 17 October 2026. The live API reports Counterline, version 5 and 200 questions. Project links now use this address, and invitations generate links on the same hostname.

The owner used **New → Web Service** with the GitHub repository `edfiisher/Games-to-Make`. These are the documented setup values; dashboard settings cannot be inspected from this workspace:

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

Production browser checks passed: a complete solo run, readiness beyond the 25-second turn limit, friend joining and name changes, suggested-answer confirmation, answer-sheet pagination, source links and mobile layouts. The first question remains hidden until **Start timer**. All 12 automated accessibility scans passed on the live service.

The repository already supports a different hostname: asset/API links are relative and invitations use `location.origin`. No application code change is required. The new service reads the same GitHub question bank; future daily bank commits deploy automatically when its GitHub connection and On Commit setting are enabled.

Both services have separate in-memory rooms. Friends should use the new address and its invite links. Browser question history belongs to each address, so the new address starts a separate history. Existing visits to flat-dive are unaffected while that service remains running.

The root `render.yaml` still describes the earlier flat-dive service. The additional service was created through **New → Web Service**, without altering that Blueprint. README and HOSTING now link to the live Counterline address. The old service has not been deleted or redirected by this change.

References: [Render web services](https://render.com/docs/web-services), [Render deployment settings](https://render.com/docs/deploys), and the [request for editable onrender subdomains](https://feedback.render.com/features/p/ability-to-change-onrendercom-sub-domain).
