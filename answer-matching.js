// Alternate names are resolved only against answers recorded for this question.
const equivalentNames = [
  ["sulfur", "sulphur"],
  ["aluminum", "aluminium"],
  ["mayonnaise", "mayo"],
  ["United Kingdom", "the United Kingdom", "UK", "Great Britain", "Britain"],
  [
    "United States",
    "United States of America",
    "the United States",
    "USA",
    "US",
    "America",
  ],
  ["United Arab Emirates", "UAE"],
  ["Czechia", "Czech Republic"],
  ["Eswatini", "Swaziland"],
  ["Cape Verde", "Cabo Verde"],
  ["East Timor", "Timor-Leste", "Timor Leste"],
  ["Ivory Coast", "Côte d’Ivoire"],
  ["South Korea", "Republic of Korea"],
  ["North Korea", "Democratic People’s Republic of Korea"],
  ["Türkiye", "Turkiye", "Turkey"],
  ["Netherlands", "the Netherlands", "Holland"],
  ["Russia", "Russian Federation"],
  ["Democratic Republic of the Congo", "DR Congo", "DRC"],
  ["Republic of the Congo", "Congo-Brazzaville"],
  ["Bahamas", "the Bahamas"],
  ["Gambia", "the Gambia"],
];
const contextualAliases = {
  a0616899e8e750abc4f9805d: [
    [
      [
        "gondola",
        "gondolas",
        "gondola station",
        "gondola lift",
        "gondola lift station",
        "cablecar",
      ],
      "Cable car station",
    ],
    [
      [
        "petrol",
        "petrol station",
        "filling station",
        "gasoline station",
        "fuel station",
      ],
      "Gas station",
    ],
    [["rail", "rail station", "railway", "railway station"], "Train station"],
  ],
  d57ae71f6abe0ca50a1c1787: [
    [["mash", "mashed"], "Mashed potatoes"],
    [["fries", "chips", "french fry"], "French fries"],
    [["roast", "roasted", "roast potatoes"], "Roasted potatoes"],
    [["baked", "bake"], "Baked potato"],
  ],
};
export function normalize(value) {
  // Preserve the meaning of blood-type signs rather than collapsing A+ and A-.
  const blood = value.trim().match(/^(AB|A|B|O)\s*([+-])$/i);
  if (blood) value = blood[1] + (blood[2] === "+" ? " positive" : " negative");
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}
const words = (value) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];

// Optimal string alignment distance: insertion, deletion, replacement or a
// neighbouring-letter swap. Candidates are bounded before this runs.
export function editDistance(a, b) {
  let beforePrevious = null,
    previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        row[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        row[j] = Math.min(row[j], beforePrevious[j - 2] + 1);
    }
    beforePrevious = previous;
    previous = row;
  }
  return previous[b.length];
}
function add(map, key, answer) {
  if (!key) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(answer);
}
const unique = (values) => (values?.size === 1 ? [...values][0] : null);

export function createAnswerMatcher(question) {
  const exact = new Map(),
    alternates = new Map(),
    wordOrder = new Map(),
    variants = new Map();
  for (const answer of question.answers) {
    for (const text of [answer.answer, ...(answer.aliases ?? [])]) {
      const key = normalize(text);
      if (text === answer.answer && !exact.has(key)) exact.set(key, answer);
      if (text !== answer.answer) add(alternates, key, answer);
      const tokens = words(text);
      if (tokens.length > 1)
        add(wordOrder, [...tokens].sort().join(" "), answer);
      if (["the", "a", "an"].includes(tokens[0]))
        add(variants, normalize(tokens.slice(1).join(" ")), answer);
      if (/\btype of station\b/i.test(question.text))
        add(variants, normalize(text.replace(/\s+station$/i, "")), answer);
      if (/prepare potatoes/i.test(question.text))
        add(
          variants,
          normalize(text.replace(/\s+potato(?:es)?$/i, "")),
          answer,
        );
      if (
        /\b(someone|person|actor|actress|director|singer|player|athlete|author|writer)\b/i.test(
          question.text,
        )
      ) {
        for (let start = 0; start < tokens.length; start++)
          for (let end = start + 1; end <= tokens.length; end++) {
            const name = normalize(tokens.slice(start, end).join(" "));
            if (name.length >= 4) add(variants, name, answer);
          }
      }
      if (
        /\b(movie|film|team|organi[sz]ation|show|series|university|college)\b/i.test(
          question.text,
        )
      ) {
        const meaningful = tokens.filter(
          (t) =>
            ![
              "the",
              "a",
              "an",
              "of",
              "and",
              "in",
              "to",
              "for",
              "with",
              "on",
              "at",
              "from",
            ].includes(t),
        );
        if (meaningful.length >= 3)
          add(alternates, meaningful.map((t) => t[0]).join(""), answer);
        const standard = tokens.filter(
          (t, i) => i !== 0 || !["the", "a", "an"].includes(t),
        );
        if (standard.length >= 3)
          add(alternates, standard.map((t) => t[0]).join(""), answer);
      }
    }
  }
  for (const group of equivalentNames) {
    const targets = new Set(
      group.map((name) => exact.get(normalize(name))).filter(Boolean),
    );
    if (targets.size === 1)
      for (const name of group)
        add(alternates, normalize(name), [...targets][0]);
  }
  for (const [aliases, target] of contextualAliases[question.id] ?? []) {
    const answer = exact.get(normalize(target));
    if (!answer)
      throw Error(
        `Correction alias target is missing: ${question.id}: ${target}`,
      );
    for (const alias of aliases) add(alternates, normalize(alias), answer);
  }
  const vocabulary = new Map(
    [...exact].map(([word, answer]) => [word, new Set([answer])]),
  );
  for (const source of [alternates, variants])
    for (const [word, targets] of source) {
      if (!vocabulary.has(word)) vocabulary.set(word, new Set());
      for (const target of targets) vocabulary.get(word).add(target);
    }
  function direct(raw) {
    return exact.get(normalize(raw)) ?? null;
  }
  function suggest(raw) {
    const key = normalize(raw);
    if (!key || key.length > 100 || direct(raw)) return null;
    const alternate = unique(alternates.get(key));
    if (alternate) return { answer: alternate, reason: "alternate-name" };
    const tokens = words(raw);
    const variant =
      unique(variants.get(key)) ??
      unique(wordOrder.get([...tokens].sort().join(" ")));
    if (variant) return { answer: variant, reason: "wording" };
    // Handle ordinary plurals only when the recorded interpretation is unique.
    const plurals = new Set();
    if (key.length >= 4) {
      for (const candidate of [
        key + "s",
        key.endsWith("s") ? key.slice(0, -1) : "",
      ])
        if (exact.has(candidate)) plurals.add(exact.get(candidate));
    }
    if (plurals.size === 1)
      return { answer: [...plurals][0], reason: "wording" };
    if (key.length < 4) return null;
    const limit = key.length >= 14 ? 3 : key.length >= 8 ? 2 : 1;
    let best = Infinity,
      candidates = new Set();
    for (const [word, targets] of vocabulary) {
      if (Math.abs(word.length - key.length) > limit) continue;
      const distance = editDistance(key, word);
      if (
        distance > limit ||
        distance / Math.max(key.length, word.length) > 0.25
      )
        continue;
      const rank = distance / Math.max(key.length, word.length);
      if (rank < best) {
        best = rank;
        candidates = new Set(targets);
      } else if (rank === best)
        for (const target of targets) candidates.add(target);
    }
    return candidates.size === 1
      ? { answer: [...candidates][0], reason: "spelling" }
      : null;
  }
  return {
    direct,
    suggest,
    size:
      exact.size +
      alternates.size +
      wordOrder.size +
      variants.size +
      vocabulary.size,
  };
}
