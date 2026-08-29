/**
 * The date filter shared by the contact forms and the activity log.
 *
 * Both lists offer the same five choices and turn them into the same pair of
 * bounds, so the arithmetic lives here rather than in each page.
 */

export type RangeKey = "all" | "today" | "week" | "month" | "custom";

export const RANGE_LABELS: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Weeks start Monday, which is what a working week means here. */
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const weekday = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - weekday);
  return x;
}

/**
 * Today as YYYY-MM-DD in local time. `toISOString()` would give the UTC day,
 * which is the wrong date for anyone whose evening is already tomorrow in UTC
 * (or whose morning is still yesterday).
 */
export function todayValue() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function rangeBounds(
  key: RangeKey,
  from: string,
  to: string,
): { since?: Date; until?: Date } {
  const now = new Date();
  switch (key) {
    case "today":
      return { since: startOfDay(now) };
    case "week":
      return { since: startOfWeek(now) };
    case "month":
      return { since: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)) };
    case "custom": {
      // either end may be left blank, giving an open-ended range
      let since = from ? startOfDay(new Date(from + "T00:00")) : undefined;
      let until = to ? endOfDay(new Date(to + "T00:00")) : undefined;
      // the pickers stop this, but a typed-in date can still arrive backwards;
      // reading it as the range the person meant beats returning nothing
      if (since && until && since > until) [since, until] = [startOfDay(until), endOfDay(since)];
      return { since, until };
    }
    default:
      return {};
  }
}
