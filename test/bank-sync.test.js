import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncRecorded } from "../scripts/sync-recorded.js";
import {
  bank,
  questions,
  judge,
  suggestAnswer,
  selectQuestions,
} from "../questions.js";
import definitions from "../data/curated/definitions.mjs";

test("expanded bank has 200 distinct, sourced questions with complete finite-set counts", () => {
  assert.ok(questions.length >= 200);
  assert.equal(bank.houseQuestionCount, 121);
  assert.equal(definitions.length, 121);
  assert.equal(
    new Set(questions.map((q) => q.text.toLowerCase())).size,
    questions.length,
  );
  const expected = [
    ["seven SI base units", 7],
    ["eight common ABO", 8],
    ["88 official IAU", 88],
    ["twenty standard protein", 20],
    ["thirteen Archimedean", 13],
    ["twenty-two SI derived", 22],
    ["original Mercury Seven", 7],
    ["people who walked", 12],
    ["Milano Cortina 2026", 16],
  ];
  for (const [text, count] of expected) {
    const q = questions.find((q) => q.text.includes(text));
    assert.ok(q, text);
    assert.equal(q.answers.length, count, text);
  }
  for (const q of questions.filter((q) => q.scoring === "house-frequency-v1")) {
    assert.ok(q.answers.length >= 4);
    assert.equal(q.answers.filter((a) => a.tier === "krillion").length, 1);
    assert.match(q.source, /^https:/);
  }
  const blood = questions.find((q) => q.text.includes("eight common ABO"));
  assert.equal(judge(blood, "A+").answer, "A positive");
  assert.equal(judge(blood, "A-").answer, "A negative");
  const nato = questions.find((q) => q.text.includes("NATO spelling"));
  assert.equal(suggestAnswer(nato, "Alpha").answer.answer, "Alfa");
  const members = JSON.parse(requireRead("../data/facts/countries.json"));
  assert.equal(members.length, 193);
  assert.ok(!members.some((c) => c.cca3 === "VAT"));
});
function requireRead(relative) {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}
import { readFileSync } from "node:fs";

test("automatic sets favour varied topics while preserving unseen-first selection", () => {
  const run = selectQuestions([]);
  assert.equal(run.questions.length, 7);
  const counts = {};
  for (const q of run.questions) counts[q.topic] = (counts[q.topic] ?? 0) + 1;
  assert.ok(Object.values(counts).every((n) => n <= 2));
  const singleTopic = questions
    .filter((q) => q.topic === "science")
    .slice(0, 7);
  const seen = questions
    .filter((q) => !singleTopic.includes(q))
    .map((q) => q.id);
  assert.equal(selectQuestions(seen).freshCount, 7);
  assert.ok(
    selectQuestions(seen).questions.every((q) => singleTopic.includes(q)),
  );
});
async function syncFixture(t, { badTier = false, incomplete = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "question-sync-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dataPath = join(directory, "recorded.json");
  const old = {
    source: "https://krillionanswers.com/answer-finder/",
    questions: [
      {
        id: "older",
        text: "Name an older question",
        answers: [{ answer: "Older", aliases: [], tier: "rare" }],
      },
    ],
  };
  await writeFile(dataPath, JSON.stringify(old) + "\n");
  const doc = {
    kind: "prompt",
    promptId: "daily:new:p1",
    promptText: "Name a new public question",
    href: "/questions/new-public-question/",
    officialDate: "2026-10-17",
    modeSlug: "daily",
    answerCount: 1,
  };
  const fetcher = async (url) => {
    const u = new URL(url);
    let value;
    if (u.pathname === "/answer-finder/")
      return {
        ok: true,
        text: async () =>
          `<strong>${incomplete ? 2 : 1}</strong><span>Indexed Question Records</span>`,
      };
    if (u.pathname === "/api/today")
      value = {
        prompts: [
          { text: doc.promptText },
          { text: "Name a private, unrevealed question" },
        ],
      };
    else if (u.searchParams.has("promptId"))
      value = {
        answers: [
          { text: "New answer", tier: "rare", score: badTier ? 100 : 60 },
        ],
      };
    else value = { results: [{ document: doc }] };
    return { ok: true, json: async () => value };
  };
  return { fetcher, dataPath, oldText: await readFile(dataPath, "utf8") };
}
test("daily sync retains old questions, adds validated public data, waits for unrevealed answers and is repeatable", async (t) => {
  const f = await syncFixture(t);
  const first = await syncRecorded(f);
  assert.equal(first.added, 1);
  assert.equal(first.waiting, 1);
  const data = JSON.parse(await readFile(f.dataPath, "utf8"));
  assert.equal(data.questions.length, 2);
  assert.equal(data.questions[0].id, "older");
  assert.equal(data.questions[1].answers[0].tier, "rare");
  const second = await syncRecorded(f);
  assert.equal(second.added, 0);
  assert.equal(second.changed, false);
});
test("invalid tiers or incomplete source coverage leave the saved bank untouched", async (t) => {
  for (const problem of [{ badTier: true }, { incomplete: true }]) {
    const f = await syncFixture(t, problem);
    await assert.rejects(syncRecorded(f));
    assert.equal(await readFile(f.dataPath, "utf8"), f.oldText);
  }
});
