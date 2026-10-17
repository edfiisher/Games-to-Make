import { test } from "node:test";
import assert from "node:assert/strict";
import { createGameServer } from "../server.js";
import {
  questions,
  judge,
  suggestAnswer,
  scores,
  selectQuestions,
  normalize,
} from "../questions.js";
import { createAnswerMatcher } from "../answer-matching.js";
import { readHistory, remember } from "../public/progress.js";

const byId = new Map(questions.map((q) => [q.id, q]));
async function fixture(t) {
  let time = 1000;
  const server = createGameServer({ now: () => time });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port;
  async function request(action, body) {
    const response = await fetch(base + "/api/" + action, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  async function post(action, body) {
    const r = await request(action, body);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  }
  return {
    base,
    post,
    request,
    tick(ms) {
      time += ms;
    },
  };
}
const auth = (s) => ({ code: s.code, playerId: s.playerId });
const answerBody = (s) => ({
  ...auth(s),
  roundId: s.roundId,
  answer: byId.get(s.question.id).answers[0].answer,
});

test("solo prepares an untimed run, then starts and scores seven turns", async (t) => {
  const { post, request } = await fixture(t);
  let s = await post("start", {});
  const session = auth(s);
  assert.equal(s.phase, "intro");
  assert.equal(s.deadline, null);
  assert.equal(s.question, null);
  assert.deepEqual(s.playedIds, []);
  s = await post("next", session);
  assert.equal(s.phase, "answering");
  assert.equal(s.board.length, 1);
  assert.equal(s.answers, undefined);
  assert.equal(s.deadline, 26000);
  const ids = [],
    total = [];
  for (let i = 0; i < 7; i++) {
    assert.equal(s.round, i);
    assert.equal(s.playedIds.length, i + 1);
    ids.push(s.question.id);
    const first = byId.get(s.question.id).answers[0];
    total.push(scores[first.tier]);
    const old = { ...session, roundId: s.roundId, answer: first.answer };
    if (i === 0) {
      const reject = await post("answer", {
        ...old,
        answer: "notarealanswerxyz",
      });
      assert.ok(reject.rejected);
      assert.equal(reject.deadline, s.deadline);
      assert.equal(reject.results.length, 0);
    }
    s = await post("answer", old);
    assert.equal(s.results[i].score, scores[first.tier]);
    assert.equal(s.results[i].answer, first.answer);
    assert.equal((await request("answer", old)).status, 409);
    if (i < 6) {
      s = await post("next", session);
      const stale = await request("answer", old);
      assert.equal(stale.status, 409);
      assert.equal(stale.body.state.round, i + 1);
    }
  }
  assert.equal(new Set(ids).size, 7);
  assert.equal(s.phase, "done");
  assert.equal(s.answers.length, 7);
  assert.equal(
    s.board[0].score,
    total.reduce((a, b) => a + b, 0),
  );
  const summary = await post("state", { ...session, summary: true });
  assert.equal(summary.answers, undefined);
  assert.equal(summary.results.length, 7);
  const done = await post("next", session);
  assert.equal(done.phase, "done");
  assert.equal(done.results.length, 7);
});

test("invitation joins the existing solo run and gives friends the same seven questions and independent timers", async (t) => {
  const { post, tick } = await fixture(t);
  let host = await post("start", { name: "Host" });
  const hostAuth = auth(host);
  host = await post("next", hostAuth);
  const guest = await post("join", {
    code: host.code.toLowerCase(),
    name: "Guest",
  });
  let friend = guest;
  const guestAuth = auth(guest);
  assert.equal(guest.phase, "intro");
  assert.equal(guest.question, null);
  assert.equal(guest.deadline, null);
  assert.equal(guest.board.length, 2);
  tick(4000);
  friend = await post("next", guestAuth);
  assert.equal(friend.deadline - host.deadline, 4000);
  for (let i = 0; i < 7; i++) {
    assert.equal(friend.question.id, host.question.id);
    const chosen = byId.get(host.question.id).answers[0];
    host = await post("answer", answerBody(host));
    friend = await post("answer", answerBody(friend));
    assert.equal(host.results[i].score, scores[chosen.tier]);
    assert.equal(friend.results[i].score, host.results[i].score);
    if (i < 6) {
      host = await post("next", hostAuth);
      friend = await post("next", guestAuth);
    }
  }
  assert.ok(friend.board.every((p) => p.done));
  assert.equal(friend.board[0].score, friend.board[1].score);
  assert.equal(friend.board.filter((p) => p.isYou).length, 1);
});

test("fresh selection avoids every played question until exhausted, then rotates oldest questions", () => {
  let seen = [];
  const recent = [];
  while (questions.length - seen.length >= 7) {
    const run = selectQuestions(seen);
    assert.equal(run.freshCount, 7);
    assert.equal(run.questions.length, 7);
    for (const q of run.questions) {
      assert.ok(!seen.includes(q.id));
      seen.push(q.id);
    }
    recent.push(run.questions.map((q) => q.id));
  }
  const last = selectQuestions(seen);
  assert.equal(last.freshCount, questions.length - seen.length);
  assert.equal(new Set(last.questions.map((q) => q.id)).size, 7);
  const all = questions.map((q) => q.id);
  const first = selectQuestions(all);
  assert.equal(first.freshCount, 0);
  assert.deepEqual(
    first.questions.map((q) => q.id),
    all.slice(0, 7),
  );
  const reordered = [...all.slice(7), ...all.slice(0, 7)];
  assert.deepEqual(
    selectQuestions(reordered).questions.map((q) => q.id),
    all.slice(7, 14),
  );
});

test("the API respects saved device history and has no archive picker endpoint", async (t) => {
  const { base, post } = await fixture(t);
  const excluded = questions.slice(0, -7).map((q) => q.id);
  let s = await post("start", { seen: excluded });
  const session = auth(s),
    ids = [];
  s = await post("next", session);
  for (let i = 0; i < 7; i++) {
    assert.ok(!excluded.includes(s.question.id));
    ids.push(s.question.id);
    s = await post("skip", { ...session, roundId: s.roundId });
    if (i < 6) s = await post("next", session);
  }
  assert.equal(new Set(ids).size, 7);
  const info = await (await fetch(base + "/api/info")).json();
  assert.equal(info.questionCount, questions.length);
  assert.equal(info.name, "Counterline");
  assert.equal(info.version, 5);
  assert.equal(info.answers, undefined);
  assert.equal((await fetch(base + "/api/dives")).status, 405);
});

test("timeouts are enforced server-side; expired rooms and invalid requests recover cleanly", async (t) => {
  const { post, request, tick } = await fixture(t);
  let s = await post("start", {});
  const session = auth(s);
  s = await post("next", session);
  tick(25001);
  const late = await request("answer", answerBody(s));
  assert.equal(late.status, 409);
  assert.equal(late.body.state.results[0].score, 0);
  assert.equal(late.body.state.phase, "feedback");
  assert.equal(
    (await request("state", { ...session, playerId: "wrong" })).status,
    404,
  );
  assert.equal((await request("join", { code: "zzzzzz" })).status, 400);
  assert.equal((await request("join", { code: "ABCDEF" })).status, 404);
  assert.equal((await request("start", { seen: "bad" })).status, 400);
  assert.equal((await request("start", { name: 123 })).status, 400);
  tick(6 * 60 * 60 * 1000 + 1);
  const expired = await request("state", session);
  assert.equal(expired.status, 404);
  assert.equal(expired.body.expired, true);
  const prepared = await post("start", { seen: [s.question.id] });
  const restored = await post("next", auth(prepared));
  assert.notEqual(restored.question.id, s.question.id);
});

test("recorded question bank has distinct questions, valid source attribution and consistent answer tiers", () => {
  assert.ok(questions.length >= 200);
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
  assert.equal(
    new Set(questions.map((q) => normalize(q.text))).size,
    questions.length,
  );
  for (const q of questions) {
    assert.match(q.source, /^https:\/\//);
    if (q.scoring === "recorded")
      assert.match(q.source, /^https:\/\/krillionanswers.com\/questions\//);
    assert.ok(q.answers.length);
    for (const a of q.answers) {
      assert.ok(a.answer.trim());
      assert.ok(scores[a.tier]);
      assert.ok(Array.isArray(a.aliases));
    }
    const sample = q.answers[0];
    assert.equal(judge(q, sample.answer.toUpperCase()).tier, sample.tier);
  }
  assert.equal(judge(questions[0], "notarealanswerxyz"), null);
});

test("device progress survives sessions and moves repeated questions to the end of the history", () => {
  const data = new Map(),
    storage = {
      getItem: (key) => data.get(key),
      setItem: (key, value) => data.set(key, value),
    };
  assert.deepEqual(readHistory(storage), []);
  remember(storage, ["a", "b", "c"]);
  remember(storage, ["b", "d"]);
  assert.deepEqual(readHistory(storage), ["a", "c", "b", "d"]);
  remember(storage, ["d", "d"]);
  assert.deepEqual(readHistory(storage), ["a", "c", "b", "d"]);
  const broken = {
    getItem() {
      throw Error("storage disabled");
    },
    setItem() {
      throw Error("storage disabled");
    },
  };
  assert.deepEqual(remember(broken, ["x"]), ["x"]);
});

test("host and guests can wait to invite friends without spending time or revealing the question", async (t) => {
  const { post, tick } = await fixture(t);
  const host = await post("start", {}),
    session = auth(host);
  tick(60000);
  const before = await post("state", session);
  assert.equal(before.phase, "intro");
  assert.equal(before.deadline, null);
  assert.equal(before.question, null);
  assert.equal(before.results.length, 0);
  const guest = await post("join", { code: host.code });
  tick(60000);
  const waiting = await post("state", auth(guest));
  assert.equal(waiting.deadline, null);
  assert.equal(waiting.question, null);
  const playing = await post("next", session);
  assert.equal(playing.deadline - playing.serverNow, 25000);
  assert.ok(playing.question);
  assert.equal(playing.results.length, 0);
  const idle = await post("state", auth(guest));
  assert.equal(idle.phase, "intro");
  assert.equal(idle.deadline, null);
});

test("matching supports alternate names, station short forms, British spelling and letter swaps without guessing short or ambiguous words", () => {
  const station = questions.find((q) => q.text.includes("type of station"));
  assert.equal(
    suggestAnswer(station, "gondola").answer.answer,
    "Cable car station",
  );
  assert.equal(
    suggestAnswer(station, "gondola station").answer.answer,
    "Cable car station",
  );
  assert.equal(
    suggestAnswer(station, "weather").answer.answer,
    "Weather station",
  );
  assert.equal(
    suggestAnswer(station, "polyce station").answer.answer,
    "Police station",
  );
  assert.equal(suggestAnswer(station, "car"), null);
  const element = questions.find((q) => q.text.includes("chemical element"));
  assert.equal(suggestAnswer(element, "sulphur").answer.answer, "Sulfur");
  const country = questions.find((q) =>
    q.text.includes("name ends in the letter E"),
  );
  assert.equal(suggestAnswer(country, "Frnace").answer.answer, "France");
  assert.equal(suggestAnswer(country, "Frace").answer.answer, "France");
  assert.equal(suggestAnswer(country, "france"), null);
  assert.equal(judge(country, " FRANCE! ").answer, "France");
  const ambiguous = createAnswerMatcher({
    id: "fixture",
    text: "Name an animal",
    answers: [
      { answer: "Cats", aliases: [], tier: "rare" },
      { answer: "Rats", aliases: [], tier: "rare" },
    ],
  });
  assert.equal(ambiguous.suggest("bats"), null);
  assert.equal(ambiguous.suggest("cat"), null);
  assert.equal(ambiguous.suggest("anything completely unrelated"), null);
});

test("a suggested correction scores only after explicit, server-validated confirmation", async (t) => {
  const { post, request } = await fixture(t);
  const station = questions.find((q) => q.text.includes("type of station"));
  const ready = await post("start", {
      seen: questions.filter((q) => q.id !== station.id).map((q) => q.id),
    }),
    session = auth(ready);
  let s = await post("next", session);
  assert.equal(s.question.id, station.id);
  const roundId = s.roundId,
    deadline = s.deadline;
  s = await post("answer", { ...session, roundId, answer: "gondola" });
  assert.equal(s.phase, "answering");
  assert.equal(s.results.length, 0);
  assert.equal(s.board[0].score, 0);
  assert.equal(s.deadline, deadline);
  assert.equal(s.correction.to, "Cable car station");
  const suggestionId = s.correction.id;
  const restored = await post("state", session);
  assert.equal(restored.correction.id, suggestionId);
  assert.equal(
    (await request("confirm", { ...session, roundId, correctionId: "forged" }))
      .status,
    409,
  );
  s = await post("confirm", {
    ...session,
    roundId,
    correctionId: suggestionId,
    answer: "bogus",
    tier: "krillion",
  });
  const recorded = station.answers.find(
    (a) => a.answer === "Cable car station",
  );
  assert.equal(s.results[0].score, scores[recorded.tier]);
  assert.equal(s.results[0].answer, "Cable car station");
  assert.equal(s.results[0].raw, "gondola");
  assert.equal(s.correction, null);
  assert.equal(
    (
      await request("confirm", {
        ...session,
        roundId,
        correctionId: suggestionId,
      })
    ).status,
    409,
  );
});

test("dismissed, replaced and expired corrections cannot be submitted", async (t) => {
  const { post, request, tick } = await fixture(t),
    station = questions.find((q) => q.text.includes("type of station"));
  const ready = await post("start", {
      seen: questions.filter((q) => q.id !== station.id).map((q) => q.id),
    }),
    session = auth(ready);
  let s = await post("next", session);
  const roundId = s.roundId;
  const guess = () =>
    post("answer", { ...session, roundId, answer: "gondola" });
  s = await guess();
  const old = s.correction.id;
  s = await post("dismiss", { ...session, roundId });
  assert.equal(s.correction, null);
  assert.equal(s.results.length, 0);
  assert.equal(
    (await request("confirm", { ...session, roundId, correctionId: old }))
      .status,
    409,
  );
  s = await guess();
  const replaced = s.correction.id;
  s = await post("answer", { ...session, roundId, answer: "polyce station" });
  assert.notEqual(s.correction.id, replaced);
  assert.equal(
    (await request("confirm", { ...session, roundId, correctionId: replaced }))
      .status,
    409,
  );
  const current = s.correction.id;
  tick(25001);
  const expired = await request("confirm", {
    ...session,
    roundId,
    correctionId: current,
  });
  assert.equal(expired.status, 409);
  assert.equal(expired.body.state.results[0].score, 0);
  assert.equal(expired.body.state.correction, null);
});

test("short names and abbreviations resolve only within a unique recorded interpretation", () => {
  const people = createAnswerMatcher({
    id: "people-fixture",
    text: "Name a football player",
    answers: [
      { answer: "Lionel Messi", aliases: [], tier: "schooler" },
      { answer: "Cristiano Ronaldo", aliases: [], tier: "schooler" },
      { answer: "Ronaldo Nazario", aliases: [], tier: "rare" },
    ],
  });
  assert.equal(people.suggest("Messi").answer.answer, "Lionel Messi");
  assert.equal(people.suggest("Ronaldo"), null);
  const ambiguous = createAnswerMatcher({
    id: "names-fixture",
    text: "Name a director",
    answers: [
      { answer: "Ridley Scott", aliases: [], tier: "rare" },
      { answer: "Tony Scott", aliases: [], tier: "rare" },
    ],
  });
  assert.equal(ambiguous.suggest("Scott"), null);
  const movies = createAnswerMatcher({
    id: "movies-fixture",
    text: "Name a movie",
    answers: [
      { answer: "The Lord of the Rings", aliases: [], tier: "schooler" },
      { answer: "No Time to Die", aliases: [], tier: "rare" },
    ],
  });
  assert.equal(movies.suggest("LR"), null);
  assert.equal(movies.suggest("LOTR").answer.answer, "The Lord of the Rings");
  assert.equal(movies.suggest("NTD").answer.answer, "No Time to Die");
});

test("completed-run payloads stay small and answer sheets are paged, authenticated and searchable", async (t) => {
  const { post, request } = await fixture(t);
  const ready = await post("start", {}),
    session = auth(ready);
  assert.equal(
    (await request("answers", { ...session, index: 0 })).status,
    403,
  );
  let s = await post("next", session);
  for (let i = 0; i < 7; i++) {
    s = await post("answer", answerBody(s));
    if (i < 6) s = await post("next", session);
  }
  assert.equal(s.answers.length, 7);
  assert.ok(s.answers.every((q) => q.answers === undefined));
  assert.ok(Buffer.byteLength(JSON.stringify(s)) < 15000);
  const first = await post("answers", { ...session, index: 0 });
  assert.ok(first.answers.length <= 100);
  assert.equal(first.total, s.answers[0].count);
  const exact = first.answers[0].answer;
  const search = await post("answers", { ...session, index: 0, query: exact });
  assert.ok(search.answers.some((a) => a.answer === exact));
  if (first.total > 100) {
    const second = await post("answers", { ...session, index: 0, offset: 100 });
    assert.equal(second.offset, 100);
    assert.ok(second.answers.length <= 100);
  }
  assert.equal(
    (await request("answers", { ...session, index: 8 })).status,
    400,
  );
  assert.equal(
    (await request("answers", { ...session, playerId: "wrong", index: 0 }))
      .status,
    404,
  );
});

test("renaming the game keeps old device history and writes progress under Counterline", () => {
  const data = new Map([
    ["fresh-tracks-seen-v1", JSON.stringify(["old-a", "old-b"])],
  ]);
  const storage = {
    getItem: (key) => data.get(key),
    setItem: (key, value) => data.set(key, value),
  };
  assert.deepEqual(readHistory(storage), ["old-a", "old-b"]);
  remember(storage, ["new-c", "old-a"]);
  assert.deepEqual(JSON.parse(data.get("counterline-seen-v1")), [
    "old-b",
    "new-c",
    "old-a",
  ]);
  data.set("counterline-seen-v1", "[]");
  assert.deepEqual(readHistory(storage), []);
});

test("invited players can rename themselves before starting without changing questions or deadlines", async (t) => {
  const { post, request } = await fixture(t);
  const host = await post("start", { name: "Host" });
  let guest = await post("join", { code: host.code });
  const session = auth(guest);
  const renamed = await post("name", { ...session, name: " Alex " });
  assert.equal(renamed.name, "Alex");
  assert.equal(renamed.phase, "intro");
  assert.equal(renamed.deadline, null);
  assert.equal(
    (await post("state", auth(host))).board.find((p) => !p.isYou).name,
    "Alex",
  );
  assert.equal(
    (await request("name", { ...session, name: "   " })).status,
    400,
  );
  assert.equal(
    (await request("name", { ...session, name: "a".repeat(25) })).status,
    400,
  );
  assert.equal(
    (await request("name", { ...session, playerId: "forged", name: "Other" }))
      .status,
    404,
  );
  guest = await post("next", session);
  const deadline = guest.deadline;
  assert.equal(
    (await request("name", { ...session, name: "During timer" })).status,
    409,
  );
  assert.equal((await post("state", session)).deadline, deadline);
  assert.equal((await post("next", auth(host))).question.id, guest.question.id);
});

test("unchanged static assets revalidate without retransmission and game state never caches", async (t) => {
  const { base, post } = await fixture(t);
  for (const path of [
    "/",
    "/app.js",
    "/assets/skier.webp",
    "/icon.svg",
    "/sources",
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
    const etag = response.headers.get("etag");
    assert.match(etag, /^"[a-f0-9]+"$/);
    const repeat = await fetch(base + path, {
      headers: { "If-None-Match": etag },
    });
    assert.equal(repeat.status, 304);
    assert.equal((await repeat.arrayBuffer()).byteLength, 0);
    assert.equal(
      (
        await fetch(base + path, {
          headers: { "If-None-Match": '"old-version"' },
        })
      ).status,
      200,
    );
  }
  const ready = await post("start", {});
  const stateResponse = await fetch(base + "/api/state", {
    method: "POST",
    body: JSON.stringify(auth(ready)),
  });
  assert.equal(stateResponse.headers.get("cache-control"), "no-store");
  assert.equal(stateResponse.headers.get("etag"), null);
});
