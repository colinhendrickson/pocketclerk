/**
 * Add-ons on one drink are a list of ids where a repeat means "another one":
 * two sugars is the sugar id twice. These helpers count and edit that list.
 * No framework or database imports, so the order screen and receipts share them.
 */

/** Each distinct entry with how many times it appears, in first-seen order. */
export function countRepeats<T>(ids: readonly T[]): { id: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, count]) => ({ id, count }));
}

/** The list with one `id` added, unless it already holds `max` add-ons. */
export function addOne<T>(ids: readonly T[], id: T, max: number): T[] {
  return ids.length >= max ? [...ids] : [...ids, id];
}

/** The list with one `id` taken away (the last one), or unchanged if it has none. */
export function removeOne<T>(ids: readonly T[], id: T): T[] {
  const at = ids.lastIndexOf(id);
  return at === -1 ? [...ids] : ids.filter((_, i) => i !== at);
}
