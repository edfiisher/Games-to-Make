# Daily answer-source research

Checked 17 October 2026. Search results were followed to the public sites; metadata and visible answer data were inspected rather than treating advertising copy as proof of a usable feed.

| Source | What was verified | Decision |
| --- | --- | --- |
| [Krillion Answers](https://krillionanswers.com/answer-finder/) | The initial bank source is an independent companion. Its index importer worked in this workspace, but a real GitHub-hosted request received HTTP 403. | Retain existing records and the legacy importer; do not bypass the access block. |
| [Krillion Game](https://krillion-game.com/) | Publishes seven dated prompts, answer previews, answer-list totals, per-question links, a dated archive and the public API used by its own Load more button. All seven prompts for 17 October match the original game's public daily prompts. Its robots file permits crawling. GitHub can fetch it. | Use for the new daily importer, subject to complete-list, score, preview and saved-data checks. |
| [TodayKrillion](https://todaykrillion.com/) | Advertises daily rare-answer references, but today's page was still waiting for answers when checked. Its linked GitHub repository exposed a README, not a downloadable answer bank. | No complete daily source verified during this research. |
| [PlayKrillion](https://playkrillion.com/) | Explicitly describes itself as an unofficial guide and practice tool linking to the original game. | No full dated answer feed verified. |
| [krillion.to](https://krillion.to/en) and [krillion.org](https://www.krillion.org/) | Accessible game/guide pages; complete dated answer keys were not established from the checked pages. | Do not assume their game content is a complete original answer archive. |

## Validation and source limits

The alternative's full answer API can contain more entries than the cached page total. On 17 October, the awards prompt advertised 320 but returned 324. The importer accepts a larger list only when answer records have valid tiers/scores and its published preview agrees; it rejects lists smaller than the advertised count.

The homepage preview returned to GitHub gave Potassium 60 points, while the full answer API and the individual dated answer page showed 30. A changed list is accepted only when the dated question page corroborates the API; an unresolved disagreement fails the run without changing saved data. If the complete API list already equals the saved list, the importer can retain that unchanged list instead. Regression tests cover stale homepage previews, corroboration by a dated question page, retained unchanged lists, and rejection of uncorroborated score changes. No AI invents a replacement score.

The importer reads public text and JSON only; it does not execute the source's advertising scripts, log into a game, or access private answer sheets. No original-site request is needed during the scheduled import. Per-question source links and existing recorded tiers remain available in the game.

One daily batch is normally eight requests, spaced at least one second apart. Missed days are processed chronologically in batches of up to seven, with a saved checkpoint. Duplicate prompts retain one canonical question ID; a repeated daily prompt is not counted as new content. This can add new questions and refresh answer lists, but it cannot guarantee seven never-before-seen prompts each day.

## Hosted verification

[GitHub run 39061519874](https://github.com/edfiisher/Games-to-Make/actions/runs/39061519874) completed successfully: 4,108 answer entries checked across seven prompts, six existing lists updated, no new distinct prompt on that day, all 30 tests passed, and commit `c0db936` saved the bank. The compiled result contains 200 questions and 62,195 answer entries. The daily schedule is now enabled at 06:17 UTC. Render's one-time On Commit setting is documented separately; dashboard access is needed to verify it.
