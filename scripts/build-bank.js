import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import definitions from "../data/curated/definitions.mjs";
import { normalize } from "../answer-matching.js";
const read = (name) =>
  JSON.parse(readFileSync(new URL("../data/" + name, import.meta.url), "utf8"));
const recorded = read("recorded.json"),
  ratings = read("house-frequency.json");
const replacements = new Map([
  ["Name a famous movie monster", "Name a movie monster"],
  ["Name a famous sports trophy", "Name a sports trophy"],
  ["Name a famous tennis player", "Name a tennis player"],
]);
const index = new Map(),
  questionAliases = {};
function topic(q) {
  if (q.topic) return q.topic;
  if (q.mode === "movies") return "film";
  if (q.mode === "sports") return "sport";
  if (q.mode === "geography") return "geography";
  const text = q.text.toLowerCase();
  for (const [category, pattern] of [
    ["geography", /country|capital|city|state or province|desert|island/],
    ["food", /potato|sauce|dish|drink|wine|fruit|vegetable/],
    ["animals", /animal|body part|great ape/],
    ["science", /chemical|element|metal|astronomical/],
    ["film", /movie|pixar|actor|character/],
    ["sport", /sport|tennis|league|team|pitch|nba|mvp/],
    ["technology", /app|website|youtube|amazon|computer/],
  ])
    if (pattern.test(text)) return category;
  return "general";
}
for (const original of recorded.questions) {
  const canonicalText = replacements.get(original.text) ?? original.text,
    key = normalize(canonicalText);
  if (index.has(key)) {
    questionAliases[original.id] = index.get(key).id;
    continue;
  }
  index.set(key, {
    ...original,
    text: canonicalText,
    topic: topic(original),
    scoring: "recorded",
  });
}
const recordedCount = index.size;
let houseCount = 0;
for (const definition of definitions) {
  const key = normalize(definition.text);
  if (index.has(key)) {
    questionAliases[
      "house-" + createHash("sha256").update(key).digest("hex").slice(0, 24)
    ] = index.get(key).id;
    continue;
  }
  houseCount++;
  const seen = new Set();
  const ordered = definition.answers
    .map((a) => {
      if (!a.answer?.trim() || seen.has(normalize(a.answer)))
        throw Error("Invalid or duplicate answer: " + definition.text);
      seen.add(normalize(a.answer));
      if (!Number.isFinite(ratings.frequencies[a.answer]))
        throw Error("Missing offline familiarity rating: " + a.answer);
      return {
        ...a,
        aliases: [...new Set(a.aliases)].filter(
          (alias) => normalize(alias) !== normalize(a.answer),
        ),
        frequency: ratings.frequencies[a.answer],
      };
    })
    .sort(
      (a, b) =>
        b.frequency - a.frequency || a.answer.localeCompare(b.answer, "en"),
    );
  if (ordered.length < 4)
    throw Error(
      "Question needs at least four supported answers: " + definition.text,
    );
  const gem = Math.min(
    ordered.length - 1,
    Math.max(3, Math.floor(ordered.length * 0.8)),
  );
  const answers = ordered.map(({ frequency, ...a }, i) => ({
    ...a,
    tier:
      i === gem
        ? "krillion"
        : i / ordered.length < 0.2
          ? "plankton"
          : i / ordered.length < 0.45
            ? "schooler"
            : i / ordered.length < 0.75
              ? "rare"
              : "deepcut",
  }));
  index.set(key, {
    id: "house-" + createHash("sha256").update(key).digest("hex").slice(0, 24),
    text: definition.text,
    topic: definition.topic,
    source: definition.source,
    note: definition.note,
    scoring: "house-frequency-v1",
    answers,
  });
}
const bank = {
  source: recorded.source,
  recordedQuestionCount: recordedCount,
  houseQuestionCount: houseCount,
  questionAliases,
  ratingNotes:
    "Recorded tiers are preserved. Authored questions use English word-frequency ranks with a designated gem around the rarer fifth; this is an editorial familiarity proxy, not player statistics.",
  questions: [...index.values()],
};
if (bank.questions.length < 200)
  throw Error("Bank must contain at least 200 distinct questions");
writeFileSync(
  new URL("../data/questions.json", import.meta.url),
  JSON.stringify(bank) + "\n",
);
console.log(
  `Built ${bank.questions.length} questions (${recordedCount} recorded, ${houseCount} authored), ${bank.questions.reduce((n, q) => n + q.answers.length, 0)} answer entries`,
);
