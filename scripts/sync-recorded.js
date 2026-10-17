import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { normalize } from "../answer-matching.js";
const origin = "https://krillionanswers.com",
  modes = ["daily", "movies", "sports", "geography", "unlimited"];
const scores = {
  plankton: 10,
  tooclever: 15,
  schooler: 30,
  rare: 60,
  deepcut: 85,
  krillion: 100,
};
export async function syncRecorded({
  fetcher = fetch,
  dataPath = new URL("../data/recorded.json", import.meta.url),
  originalUrl = "https://krillion.io/api/today",
} = {}) {
  async function get(url, json = true) {
    const r = await fetcher(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw Error(`Public source request failed: ${r.status}`);
    return json ? r.json() : r.text();
  }
  const existing = JSON.parse(await readFile(dataPath, "utf8"));
  const page = await get(origin + "/answer-finder/", false),
    match = page.match(
      /<strong>([\d,]+)<\/strong>\s*<span>Indexed Question Records/,
    );
  if (!match)
    throw Error(
      "The source coverage format changed; existing bank is untouched",
    );
  const expected = Number(match[1].replaceAll(",", "")),
    documents = new Map(),
    saturated = [];
  async function search(mode, q) {
    const payload = await get(
      origin +
        "/api/answers/index/?" +
        new URLSearchParams({ q, mode, limit: "80" }),
    );
    if (!Array.isArray(payload.results)) throw Error("Invalid question index");
    for (const { document: d } of payload.results)
      if (d.kind === "prompt") documents.set(d.promptId, d);
    return payload.results.length;
  }
  for (const mode of modes)
    if ((await search(mode, "Name")) >= 80) saturated.push(mode);
  // Subdivide saturated searches if the source grows beyond the initial cap.
  if (documents.size < expected)
    outer: for (const mode of [...new Set([...saturated, ...modes])]) {
      for (const q of [
        "Name an",
        "Name one",
        "Name the",
        "Which",
        "What",
        "Give",
        "Identify",
        ..."abcdefghijklmnopqrstuvwxyz".split("").map((c) => "Name a " + c),
      ]) {
        await search(mode, q);
        if (documents.size === expected) break outer;
      }
    }
  if (documents.size !== expected)
    throw Error(
      `Incomplete public index: ${documents.size}/${expected}; existing bank is untouched`,
    );
  const latest = new Map();
  for (const d of [...documents.values()].sort((a, b) =>
    (b.officialDate ?? "").localeCompare(a.officialDate ?? ""),
  )) {
    const key = normalize(d.promptText);
    if (!latest.has(key)) latest.set(key, d);
  }
  const merged = new Map(existing.questions.map((q) => [normalize(q.text), q]));
  let added = 0,
    updated = 0;
  for (const [key, d] of latest) {
    if (
      typeof d.promptText !== "string" ||
      !d.promptText.trim() ||
      !d.href?.startsWith("/questions/")
    )
      throw Error("Invalid prompt metadata");
    const payload = await get(
      origin +
        "/api/answers/index/?" +
        new URLSearchParams({ promptId: d.promptId }),
    );
    if (
      !Array.isArray(payload.answers) ||
      !payload.answers.length ||
      payload.answers.length !== d.answerCount
    )
      throw Error("Incomplete recorded answers: " + d.promptId);
    const next = {
      id:
        merged.get(key)?.id ??
        createHash("sha256").update(key).digest("hex").slice(0, 24),
      text: d.promptText,
      source: origin + d.href,
      sourceRecord: d.promptId,
      mode: d.modeSlug,
      recordedAt: d.officialDate,
      answers: payload.answers.map((a) => {
        if (
          typeof a.text !== "string" ||
          !a.text.trim() ||
          scores[a.tier] !== a.score
        )
          throw Error("Invalid recorded tier: " + d.promptId);
        return { answer: a.text, aliases: [] };
      }),
    };
    // Copy only the source's tier, never derive a replacement for recorded data.
    next.answers.forEach((a, i) => (a.tier = payload.answers[i].tier));
    const previous = merged.get(key);
    if (!previous) added++;
    else if (JSON.stringify(previous) !== JSON.stringify(next)) updated++;
    merged.set(key, next);
  }
  let waiting = 0;
  try {
    const today = await get(originalUrl);
    if (Array.isArray(today.prompts))
      waiting = today.prompts.filter(
        (q) => !merged.has(normalize(q.text)),
      ).length;
  } catch {
    console.log(
      "Original daily prompt check unavailable; validated companion data can still sync",
    );
  }
  const result = {
    ...existing,
    indexedRecords: expected,
    questions: [...merged.values()],
  };
  const serialized = JSON.stringify(result) + "\n",
    previous = await readFile(dataPath, "utf8");
  if (serialized !== previous) await writeFile(dataPath, serialized);
  console.log(
    `Public sync: ${added} added, ${updated} updated, ${waiting} current prompts awaiting public recorded answers. Older records retained.`,
  );
  return { added, updated, waiting, changed: serialized !== previous };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await syncRecorded();
  const build = spawnSync(
    process.execPath,
    [new URL("./build-bank.js", import.meta.url).pathname],
    { stdio: "inherit" },
  );
  process.exitCode = build.status ?? 1;
}
