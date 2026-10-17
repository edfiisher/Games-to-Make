import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { normalize } from "../answer-matching.js";

const origin = "https://krillion-game.com";
const dayMs = 86400000;
const scores = {
  plankton: 10,
  tooclever: 15,
  schooler: 30,
  rare: 60,
  deepcut: 85,
  krillion: 100,
};
const entities = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};
function decode(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, name) => {
    if (name.startsWith("#"))
      return String.fromCodePoint(
        name[1].toLowerCase() === "x"
          ? parseInt(name.slice(2), 16)
          : Number(name.slice(1)),
      );
    if (!(name.toLowerCase() in entities))
      throw Error("Unsupported source HTML entity: " + name);
    return entities[name.toLowerCase()];
  });
}
function attribute(tag, name) {
  const match = tag.match(
    new RegExp("(?:^|\\s)" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", "i"),
  );
  return match ? decode(match[1] ?? match[2]) : null;
}
function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function parseDailyPage(html, expectedDate, expectedNumber = null) {
  const prompts = [];
  for (const [, tag, body] of html.matchAll(
    /<details\b([^>]*)>([\s\S]*?)<\/details\s*>/gi,
  )) {
    if (!attribute(tag, "class")?.split(/\s+/).includes("prompt")) continue;
    const id = attribute(tag, "id"),
      match = id?.match(/^daily:(\d{4}-\d{2}-\d{2}):p([1-7])$/);
    if (!match || !validDate(match[1]))
      throw Error("Invalid dated prompt metadata");
    const title = [
      ...body.matchAll(/<span\b([^>]*)>([^<]*)<\/span\s*>/gi),
    ].find((m) =>
      attribute(m[1], "class")?.split(/\s+/).includes("prompt-title"),
    );
    const text = title ? decode(title[2]).trim() : "";
    const countText = attribute(tag, "data-total");
    const count = Number(countText);
    const prefix = `/answers/daily/${match[1]}/p${match[2]}-`;
    const link =
      [...body.matchAll(/<a\b([^>]*)>/gi)]
        .map((m) => attribute(m[1], "href"))
        .find((href) => href?.startsWith(prefix)) ??
      (expectedNumber
        ? [...html.matchAll(/<link\b([^>]*)>/gi)]
            .filter((m) => attribute(m[1], "rel") === "canonical")
            .map((m) => attribute(m[1], "href"))
            .find((href) => href?.startsWith(origin + prefix))
        : null);
    if (
      !text ||
      text.length > 500 ||
      !/^[1-9]\d*$/.test(countText ?? "") ||
      count > 50000 ||
      !link
    )
      throw Error("Incomplete daily prompt metadata");
    const source = new URL(link, origin);
    if (source.origin !== origin || !source.pathname.startsWith(prefix))
      throw Error("Invalid prompt source link");
    const preview = [...body.matchAll(/<div\b([^>]*)>/gi)]
      .filter((m) =>
        attribute(m[1], "class")?.split(/\s+/).includes("answer-row"),
      )
      .map((m) => ({
        answer: attribute(m[1], "data-answer"),
        score: Number(attribute(m[1], "data-score")),
      }));
    if (
      preview.length !== Math.min(10, count) ||
      preview.some((a) => !a.answer || !Object.values(scores).includes(a.score))
    )
      throw Error("Incomplete daily answer preview");
    prompts.push({
      id,
      date: match[1],
      number: Number(match[2]),
      text,
      count,
      source: source.href,
      preview,
    });
  }
  const dates = new Set(prompts.map((p) => p.date));
  const expectedCount = expectedNumber ? 1 : 7;
  if (
    prompts.length !== expectedCount ||
    new Set(prompts.map((p) => p.number)).size !== expectedCount ||
    dates.size !== 1 ||
    new Set(prompts.map((p) => normalize(p.text))).size !== expectedCount ||
    (expectedNumber && prompts[0].number !== expectedNumber)
  )
    throw Error(
      expectedNumber
        ? "Incomplete question page: expected the specified dated prompt"
        : "Incomplete daily page: expected seven distinct dated prompts",
    );
  if (expectedDate && !prompts.every((p) => p.date === expectedDate))
    throw Error("Daily page date mismatch");
  return prompts.sort((a, b) => a.number - b.number);
}
function answersEqual(a, b) {
  const stable = (items) =>
    JSON.stringify(
      items
        .map(({ answer, tier, aliases = [] }) => ({ answer, tier, aliases }))
        .sort((x, y) => x.answer.localeCompare(y.answer, "en")),
    );
  return stable(a) === stable(b);
}
export async function syncDaily({
  fetcher = fetch,
  dataPath = new URL("../data/recorded.json", import.meta.url),
  now = Date.now,
  intervalMs = 1000,
  checkOnly = false,
} = {}) {
  let lastRequest = 0;
  async function get(url, json = false) {
    await delay(Math.max(0, intervalMs - (Date.now() - lastRequest)));
    lastRequest = Date.now();
    const response = await fetcher(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok)
      throw Error(`Daily source returned HTTP ${response.status}: ${url}`);
    const text = await response.text();
    if (Buffer.byteLength(text) > 8 * 1024 * 1024)
      throw Error("Daily source response too large");
    return json ? JSON.parse(text) : text;
  }
  const originalText = await readFile(dataPath, "utf8"),
    existing = JSON.parse(originalText);
  const latestPrompts = parseDailyPage(await get(origin + "/")),
    latestDate = latestPrompts[0].date;
  if (latestDate > new Date(now()).toISOString().slice(0, 10))
    throw Error("Source advertises a future daily date");
  const checkpoint = existing.dailySync?.latestCompleteDate;
  if (checkpoint && (!validDate(checkpoint) || checkpoint > latestDate))
    throw Error("Source date is older than the saved checkpoint");
  const firstDate =
    checkpoint && checkpoint < latestDate
      ? new Date(Date.parse(checkpoint + "T00:00:00Z") + dayMs)
          .toISOString()
          .slice(0, 10)
      : latestDate;
  const dates = [];
  for (
    let time = Date.parse(firstDate + "T00:00:00Z");
    time <= Date.parse(latestDate + "T00:00:00Z") && dates.length < 7;
    time += dayMs
  )
    dates.push(new Date(time).toISOString().slice(0, 10));
  const merged = new Map(existing.questions.map((q) => [normalize(q.text), q]));
  let added = 0,
    updated = 0,
    expandedLists = 0,
    retainedConflicts = 0,
    confirmedQuestionPages = 0,
    checkedAnswers = 0;
  for (const date of dates) {
    const prompts =
      date === latestDate
        ? latestPrompts
        : parseDailyPage(await get(`${origin}/archive/${date}/`), date);
    for (const prompt of prompts) {
      const payload = await get(
        origin + "/api/answers/?" + new URLSearchParams({ prompt: prompt.id }),
        true,
      );
      if (
        !Array.isArray(payload.answers) ||
        payload.answers.length < prompt.count ||
        payload.answers.length > 50000
      )
        throw Error("Incomplete daily answers: " + prompt.id);
      const seen = new Set();
      const answers = payload.answers.map((a) => {
        if (
          typeof a.answer !== "string" ||
          !a.answer.trim() ||
          a.answer.length > 500 ||
          seen.has(a.answer) ||
          !Object.hasOwn(scores, a.tier) ||
          scores[a.tier] !== a.score
        )
          throw Error("Invalid daily answer or tier: " + prompt.id);
        seen.add(a.answer);
        return { answer: a.answer, aliases: [], tier: a.tier };
      });
      const publishedScores = new Map(
        payload.answers.map((a) => [a.answer, a.score]),
      );
      const conflicts = prompt.preview.filter(
        (a) => publishedScores.get(a.answer) !== a.score,
      );
      const key = normalize(prompt.text),
        previous = merged.get(key);
      if (conflicts.length) {
        // A stale page preview must never change a known-good saved list.
        // If the complete API list is identical to it, retain that saved list.
        if (previous && answersEqual(previous.answers, answers)) {
          retainedConflicts++;
          checkedAnswers += answers.length;
          console.warn(
            "Preview conflict; retained the identical saved list: " + prompt.id,
          );
          continue;
        }
        // The site's homepage may lag its full, dated question page.
        // A changed list needs independent corroboration from that page.
        const questionPage = parseDailyPage(
          await get(prompt.source),
          date,
          prompt.number,
        )[0];
        if (
          questionPage.id !== prompt.id ||
          normalize(questionPage.text) !== key ||
          answers.length < questionPage.count ||
          questionPage.preview.some(
            (a) => publishedScores.get(a.answer) !== a.score,
          )
        )
          throw Error(
            "Daily answers disagree with the published preview and question page: " +
              prompt.id +
              " " +
              JSON.stringify(conflicts),
          );
        confirmedQuestionPages++;
        console.warn(
          "Stale homepage preview; API scores confirmed against the dated question page: " +
            prompt.id,
        );
      }
      if (answers.length > prompt.count) expandedLists++;
      checkedAnswers += answers.length;
      if (
        previous?.recordedAt > date ||
        (previous && answersEqual(previous.answers, answers))
      )
        continue;
      const next = {
        id:
          previous?.id ??
          createHash("sha256").update(key).digest("hex").slice(0, 24),
        text: prompt.text,
        source: prompt.source,
        sourceRecord: prompt.id,
        mode: previous?.mode ?? "daily",
        recordedAt: date,
        answers,
      };
      if (previous) updated++;
      else added++;
      merged.set(key, next);
    }
  }
  const throughDate = dates.at(-1);
  const result = {
    ...existing,
    sources: [
      ...new Set([...(existing.sources ?? []), existing.source, origin + "/"]),
    ].filter(Boolean),
    dailySync: { source: origin, latestCompleteDate: throughDate },
    questions: [...merged.values()],
  };
  const serialized = JSON.stringify(result) + "\n",
    changed = serialized !== originalText;
  if (changed && !checkOnly) {
    // Use a sibling temporary file so a failed write cannot truncate the saved bank.
    const target = dataPath instanceof URL ? dataPath : pathToFileURL(dataPath);
    const sibling = new URL(`.recorded-${process.pid}.tmp`, target);
    try {
      await writeFile(sibling, serialized);
      await rename(sibling, target);
    } finally {
      await rm(sibling, { force: true });
    }
  }
  console.log(
    `${checkOnly ? "Check only" : "Daily import"}: ${dates.length} day(s) through ${throughDate}; ${checkedAnswers} validated answer entries, ${added} new questions, ${updated} changed lists, ${expandedLists} lists larger than the page count, ${retainedConflicts} unchanged lists retained, ${confirmedQuestionPages} stale previews checked against the full question page. ${throughDate < latestDate ? "More backlog remains for the next run." : "Caught up with the published source."}`,
  );
  return {
    added,
    updated,
    changed,
    checkedAnswers,
    throughDate,
    latestDate,
    retainedConflicts,
    confirmedQuestionPages,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const checkOnly = process.argv.includes("--check");
  await syncDaily({ checkOnly });
  if (!checkOnly) {
    const build = spawnSync(
      process.execPath,
      [new URL("./build-bank.js", import.meta.url).pathname],
      { stdio: "inherit" },
    );
    process.exitCode = build.status ?? 1;
  }
}
