import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { createAnswerMatcher } from "./answer-matching.js";

export const scores = {
  plankton: 10,
  tooclever: 15,
  schooler: 30,
  rare: 60,
  deepcut: 85,
  krillion: 100,
};
export const bank = JSON.parse(
  readFileSync(new URL("./data/questions.json", import.meta.url), "utf8"),
);
export const questions = bank.questions;
export { normalize } from "./answer-matching.js";
// Compile only questions being answered. Bound both entry count and index size.
const matchers = new Map();
let cachedKeys = 0;
function matcher(q) {
  let value = matchers.get(q.id);
  if (value) {
    matchers.delete(q.id);
    matchers.set(q.id, value);
    return value;
  }
  value = createAnswerMatcher(q);
  matchers.set(q.id, value);
  cachedKeys += value.size;
  while (matchers.size > 1 && (matchers.size > 16 || cachedKeys > 30000)) {
    const oldest = matchers.keys().next().value;
    cachedKeys -= matchers.get(oldest).size;
    matchers.delete(oldest);
  }
  return value;
}
export const matchingMetrics = () => ({
  cachedQuestions: matchers.size,
  cachedKeys,
});
export function judge(question, raw) {
  return matcher(question).direct(raw) ?? null;
}
export function suggestAnswer(question, raw) {
  return matcher(question).suggest(raw) ?? null;
}
export function selectQuestions(seen = [], size = 7) {
  const history = new Map(
    seen.map((id, i) => [bank.questionAliases?.[id] ?? id, i]),
  );
  const fresh = questions.filter((q) => !history.has(q.id));
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }
  // Once the bank is exhausted, return the least recently seen first.
  const older = questions
    .filter((q) => history.has(q.id))
    .sort((a, b) => history.get(a.id) - history.get(b.id));
  const selected = [],
    deferred = [],
    topics = new Map();
  // Prefer variety without sacrificing unseen questions when one topic remains.
  for (const q of fresh) {
    const count = topics.get(q.topic) ?? 0;
    if (count < 2 && selected.length < size) {
      selected.push(q);
      topics.set(q.topic, count + 1);
    } else deferred.push(q);
  }
  return {
    questions: [...selected, ...deferred, ...older].slice(0, size),
    freshCount: Math.min(fresh.length, size),
  };
}
