import definitions from "../data/curated/definitions.mjs";
console.log(
  JSON.stringify(
    [
      ...new Set(definitions.flatMap((q) => q.answers.map((a) => a.answer))),
    ].sort(),
  ),
);
