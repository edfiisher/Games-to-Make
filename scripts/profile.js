import { performance } from "node:perf_hooks";
import { statSync } from "node:fs";
const start = performance.now();
const { questions, judge, suggestAnswer, matchingMetrics } = await import(
  "../questions.js"
);
const loaded = performance.now();
const initial = process.memoryUsage().rss;
for (const q of questions) judge(q, q.answers[0].answer);
const station = questions.find((q) => q.text.includes("type of station"));
const typoStart = performance.now();
for (let i = 0; i < 100; i++) suggestAnswer(station, "polyce station");
console.log(
  JSON.stringify(
    {
      questions: questions.length,
      answers: questions.reduce((n, q) => n + q.answers.length, 0),
      bankBytes: statSync(new URL("../data/questions.json", import.meta.url))
        .size,
      loadMs: Math.round(loaded - start),
      initialRssMiB: Math.round(initial / 1048576),
      warmRssMiB: Math.round(process.memoryUsage().rss / 1048576),
      maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
      hundredTypoLookupsMs: Math.round(performance.now() - typoStart),
      cache: matchingMetrics(),
    },
    null,
    2,
  ),
);
