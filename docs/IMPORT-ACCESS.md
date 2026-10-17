# Daily import status

**Daily imports now use [Krillion Game](https://krillion-game.com/), an independent public answer site.** Its pages, dated answer links and public answer API work from GitHub Actions. Its robots file permits crawling; the importer spaces requests at least a second apart. No login or access to private original-game answer sheets is required.

The [successful hosted run](https://github.com/edfiisher/Games-to-Make/actions/runs/39061519874) verified retrieval, validation, building, 30 tests and the push to GitHub. The workflow runs daily at 06:17 UTC and can also be started through Actions → Public question bank update → Run workflow. It adds genuinely different prompts, updates changed lists and preserves older questions. It does not imply that seven prompts are always new.

The previous source, krillionanswers.com, still blocks hosted requests with HTTP 403. That is a separate site-side restriction; the scheduled importer no longer depends on it. You do not need to contact that site's owner to use the current setup. Restoring that specific legacy integration would still need a permitted feed/access arrangement.

The game is live at **https://counterline.onrender.com**. To publish future bank changes automatically, the **counterline** service needs Render → Settings → Build & Deploy → Auto-Deploy → **On Commit**, with the linked GitHub branch set to main. Dashboard settings cannot be inspected from this workspace. See [hosting](../HOSTING.md) for setup and limitations, and [source research](DAILY-SOURCES.md) for the validation details.
