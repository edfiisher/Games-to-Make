# Krillion inspection

Observed 2026-10-17 at https://krillion.io/ and https://krillion.io/faq.

The public client describes seven prompts, 25 seconds per prompt, and a maximum score of 700. Every point corresponds to 10 metres of depth. Client tier constants: Plankton 10, Too Clever 15, Schooler 30, Rare 60, Deep Cut 85, One in a Krillion 100. A miss is zero. Today's endpoint returns prompt IDs and text but no answer lists. Answer submission and adjudication are performed by the original server.

The FAQ says answer sets are assembled from datasets and cleaned; rarity uses familiarity data, LLM assistance and manual review. The top gem is selected partly for fun rather than pure statistical rarity. Consequently browser analysis does not establish the original scoring for arbitrary answers.

REA's static JavaScript analysis completed successfully on 15 downloaded artifacts. Full evidence is retained outside this checkout at `/workspace/reference/krillion-evidence.json`. Static analysis does not prove runtime behavior. No original account was created, no purchase flow was invoked, and no original scoring requests were submitted.

This prototype uses an independent UI and answer data. Matching exact answer acceptance, rarity, animation, daily content and history remains unfinished. Shared rooms are a local implementation: the original FAQ describes multiplayer as a future feature, not an existing live-room mode.

## Companion answer archive

The user supplied https://krillionanswers.com/answer-finder/. Its public search API returns prompt records and recorded answers with tier and score. A query for daily prompts returned seven complete daily dives (2026-10-11 through 2026-10-17). The importer retains source URLs, retrieval time, question positions and recorded tiers, and verifies per-prompt answer counts and complete seven-question days. This establishes what the companion site records; it does not prove live-validator acceptance, aliases, or complete historical coverage. Original notes above describe the initial prototype before this archive was integrated.

## Fresh Tracks update

The question picker has been removed. The revised importer inspects the companion site's five modes, checks that all 294 advertised historical prompt records are covered, then retains only 82 distinct question texts and their latest recorded answer sets (60,672 answer entries). All historical records are not distinct questions. The old daily-archive-only data and importer have been removed.

New runs combine seven questions automatically, preferring unseen questions using browser-local history. Only questions actually encountered are recorded as seen. After exhaustion, the least recently encountered questions return. Optional invitations preserve a run's seven-question order and provide independent timers. The skiing names and illustration are original to Fresh Tracks; underlying recorded tier values remain unchanged.
