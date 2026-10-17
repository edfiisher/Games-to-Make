const KEY = "counterline-seen-v1";
export function readHistory(storage) {
  try {
    // Preserve questions played before the game was renamed.
    const x = JSON.parse(
      storage.getItem(KEY) ?? storage.getItem("fresh-tracks-seen-v1") ?? "[]",
    );
    return Array.isArray(x)
      ? x.filter((id) => typeof id === "string").slice(-3000)
      : [];
  } catch {
    return [];
  }
}
export function remember(storage, ids) {
  const previous = readHistory(storage);
  const recent = [...new Set(ids)];
  const merged = [
    ...previous.filter((id) => !recent.includes(id)),
    ...recent,
  ].slice(-3000);
  try {
    storage.setItem(KEY, JSON.stringify(merged));
  } catch {}
  return merged;
}
