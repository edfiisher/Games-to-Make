import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDailyPage, syncDaily } from "../scripts/sync-daily.js";
const origin = "https://krillion-game.com";
const date = "2026-10-17";
const now = () => Date.parse(date + "T12:00:00Z");
function page(day = date, count = 7) {
  return Array.from(
    { length: count },
    (_, i) =>
      `<details data-total='2' id='daily:${day}:p${i + 1}' class='prompt'><summary><span class='prompt-title'>Name &quot;item ${i + 1}&quot; &amp; friends</span></summary><a href='/answers/daily/${day}/p${i + 1}-item/'>Full list</a><div class='answer-row' data-answer='Answer ${i + 1}' data-score='60'></div><div class='answer-row' data-answer='Other ${i + 1}' data-score='10'></div></details>`,
  ).join("");
}
async function fixture(
  t,
  {
    latest = date,
    checkpoint,
    deny = false,
    short = false,
    badTier = false,
    extra = false,
    mismatch = false,
    staleHome = false,
  } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "daily-public-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dataPath = join(directory, "recorded.json");
  const before = {
    source: "https://krillionanswers.com/answer-finder/",
    ...(checkpoint
      ? { dailySync: { latestCompleteDate: checkpoint, source: origin } }
      : {}),
    questions: [
      {
        id: "retained",
        text: "Name an old question",
        source: "https://krillionanswers.com/questions/old/",
        answers: [{ answer: "Old", aliases: [], tier: "rare" }],
      },
      {
        id: "stable-item-1",
        text: 'Name "item 1" & friends',
        recordedAt: "2026-10-15",
        source: "https://krillionanswers.com/questions/item1/",
        answers: [{ answer: "Previous", aliases: [], tier: "rare" }],
      },
    ],
  };
  await writeFile(dataPath, JSON.stringify(before) + "\n");
  const requests = [];
  const fetcher = async (url) => {
    requests.push(url);
    if (deny) return { ok: false, status: 403 };
    const u = new URL(url);
    assert.equal(u.origin, origin);
    let body;
    if (u.pathname === "/")
      body = staleHome
        ? page(latest).replace(
            "data-answer='Answer 1' data-score='60'",
            "data-answer='Answer 1' data-score='85'",
          )
        : page(latest);
    else if (u.pathname.startsWith("/answers/daily/")) {
      const number = Number(u.pathname.match(/\/p([1-7])-/)[1]);
      const day = u.pathname.split("/")[3];
      body = [...page(day).matchAll(/<details[\s\S]*?<\/details>/g)][
        number - 1
      ][0];
      body =
        '<link rel="canonical" href="' +
        url +
        '">' +
        body.replace(/<a[^>]*>Full list<\/a>/, "");
    } else if (u.pathname.startsWith("/archive/"))
      body = page(u.pathname.split("/")[2]);
    else {
      assert.equal(u.pathname, "/api/answers/");
      const id = u.searchParams.get("prompt");
      const number = Number(id.at(-1));
      const answers = [
        { answer: `Answer ${number}`, score: 60, tier: "rare" },
        {
          answer: `Other ${number}`,
          score: badTier ? 85 : 10,
          tier: "plankton",
        },
      ];
      if (short && number === 7) answers.pop();
      if (extra)
        answers.push({ answer: `Extra ${number}`, score: 85, tier: "deepcut" });
      if (mismatch && number === 7) answers[0].answer = "Wrong question";
      body = JSON.stringify({ answers });
    }
    return { ok: true, text: async () => body };
  };
  return {
    dataPath,
    fetcher,
    now,
    intervalMs: 0,
    requests,
    original: await readFile(dataPath, "utf8"),
  };
}
test("daily page parser extracts all dated prompts and decodes text without executing page scripts", () => {
  const prompts = parseDailyPage(page(), date);
  assert.equal(prompts.length, 7);
  assert.equal(prompts[0].text, 'Name "item 1" & friends');
  assert.equal(prompts[0].count, 2);
  assert.equal(
    prompts[0].source,
    origin + "/answers/daily/2026-10-17/p1-item/",
  );
  assert.throws(() => parseDailyPage(page(date, 6)), /seven/);
  assert.throws(() => parseDailyPage(page(), "2026-10-16"), /date/);
});
test("alternative import retains old questions, preserves IDs, stores complete lists and is idempotent", async (t) => {
  const f = await fixture(t);
  const result = await syncDaily(f);
  assert.equal(result.added, 6);
  assert.equal(result.updated, 1);
  assert.equal(result.checkedAnswers, 14);
  const saved = JSON.parse(await readFile(f.dataPath, "utf8"));
  assert.equal(saved.questions.length, 8);
  assert.equal(saved.questions[0].id, "retained");
  assert.equal(saved.questions[1].id, "stable-item-1");
  assert.equal(saved.dailySync.latestCompleteDate, date);
  assert.match(saved.questions[1].source, /krillion-game.com/);
  assert.equal((await syncDaily(f)).changed, false);
});
test("blocked, partial, invalid-tier and future daily data leave saved records untouched", async (t) => {
  for (const options of [
    { deny: true },
    { short: true },
    { badTier: true },
    { mismatch: true },
    { latest: "2026-10-18" },
  ]) {
    const f = await fixture(t, options);
    await assert.rejects(syncDaily(f));
    assert.equal(await readFile(f.dataPath, "utf8"), f.original);
  }
});
test("read-only source checks validate data without saving or advancing the checkpoint", async (t) => {
  const f = await fixture(t);
  await syncDaily({ ...f, checkOnly: true });
  assert.equal(await readFile(f.dataPath, "utf8"), f.original);
  assert.equal(f.requests.length, 8);
});
test("missed days are processed chronologically in bounded batches and older lists cannot replace newer ones", async (t) => {
  const f = await fixture(t, { checkpoint: "2026-10-07" });
  const first = await syncDaily(f);
  assert.equal(first.throughDate, "2026-10-14");
  const interim = JSON.parse(await readFile(f.dataPath, "utf8"));
  assert.equal(
    interim.questions.find((q) => q.id === "stable-item-1").answers[0].answer,
    "Previous",
  );
  const second = await syncDaily(f);
  assert.equal(second.throughDate, date);
  assert.ok(f.requests.some((u) => u.includes("/archive/2026-10-08/")));
  assert.equal((await syncDaily(f)).changed, false);
});

test("expanded public lists are accepted when every preview answer and score still agrees", async (t) => {
  const f = await fixture(t, { extra: true });
  const result = await syncDaily(f);
  assert.equal(result.checkedAnswers, 21);
  const saved = JSON.parse(await readFile(f.dataPath, "utf8"));
  assert.equal(saved.questions[1].answers.length, 3);
});

test("a stale preview can retain an identical saved list but cannot authorize a changed score", async (t) => {
  const f = await fixture(t);
  await syncDaily(f);
  const saved = await readFile(f.dataPath, "utf8");
  const stalePreview = async (url, options) => {
    const response = await f.fetcher(url, options);
    const body = (await response.text()).replace(
      "data-answer='Answer 1' data-score='60'",
      "data-answer='Answer 1' data-score='85'",
    );
    return { ok: true, text: async () => body };
  };
  const result = await syncDaily({ ...f, fetcher: stalePreview });
  assert.equal(result.retainedConflicts, 1);
  assert.equal(result.changed, false);
  assert.equal(await readFile(f.dataPath, "utf8"), saved);
  const changedAPI = async (url, options) => {
    const response = await f.fetcher(url, options);
    let body = await response.text();
    if (new URL(url).searchParams.get("prompt")?.endsWith(":p1")) {
      const payload = JSON.parse(body);
      payload.answers[0] = {
        ...payload.answers[0],
        tier: "deepcut",
        score: 85,
      };
      body = JSON.stringify(payload);
    }
    return { ok: true, text: async () => body };
  };
  await assert.rejects(syncDaily({ ...f, fetcher: changedAPI }), /disagree/);
  assert.equal(await readFile(f.dataPath, "utf8"), saved);
});

test("a changed list with a stale homepage preview needs agreement from its full dated question page", async (t) => {
  const f = await fixture(t, { staleHome: true });
  const result = await syncDaily(f);
  assert.equal(result.updated, 1);
  assert.equal(result.confirmedQuestionPages, 1);
  assert.ok(
    f.requests.some((u) => u.includes("/answers/daily/2026-10-17/p1-item/")),
  );
});

test("full question pages may publish more preview rows than the homepage", () => {
  let single = [
    ...page().matchAll(/<details[\s\S]*?<\/details>/g),
  ][0][0].replace("data-total='2'", "data-total='14'");
  const extra = Array.from(
    { length: 12 },
    (_, i) =>
      `<div class='answer-row' data-answer='Additional ${i}' data-score='60'></div>`,
  ).join("");
  single = single.replace("</details>", extra + "</details>");
  assert.equal(parseDailyPage(single, date, 1)[0].preview.length, 14);
});
