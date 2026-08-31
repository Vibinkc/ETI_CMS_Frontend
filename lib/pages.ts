import { api, type Page } from "@/lib/api";

/**
 * The site's page list, fetched once and shared.
 *
 * Both the sidebar and the link picker need it, and it changes only when the
 * site is regenerated — so the promise is cached rather than refetched per
 * component.
 */
let pending: Promise<Page[]> | null = null;

export function getSitePages(): Promise<Page[]> {
  if (!pending) {
    pending = api.get<Page[]>("/api/cms/pages").catch((err) => {
      pending = null; // let the next caller retry
      throw err;
    });
  }
  return pending;
}

const CACHE_KEY = "eti-cms.pages";

/**
 * The last page list we saw, kept so a refresh can draw the sidebar straight
 * away instead of waiting on the network.
 *
 * Without it the sidebar paints with only the groups that need no data, then
 * jumps as the page tree arrives -- measured at about half a second, and the
 * whole nav shifting down under the cursor. The list is small and changes only
 * when the site is regenerated, so showing the previous one and correcting it
 * a moment later is honest.
 *
 * Cleared with the token, in setToken(null), so it does not outlive the
 * session.
 */
export function readCachedPages(): Page[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Page[]) : null;
  } catch {
    // private mode, cleared site data, or something that is not our JSON
    return null;
  }
}

export function writeCachedPages(pages: Page[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(pages));
  } catch {
    /* storage full or blocked: the sidebar simply loads as it used to */
  }
}

export function clearCachedPages(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing to do */
  }
}

const SITE_SUFFIX = "Electrical Training Institute";
const SEPARATORS = ["-", "–"];

/**
 * Drop the site name every page title ends with.
 *
 * Shared with the sidebar, which shows the same shortened titles — the two
 * must agree, so there is one copy.
 *
 * String operations rather than a regular expression: the pattern this
 * replaced had an optional-whitespace group either side of a literal, which
 * backtracks badly on a title made mostly of spaces.
 */
export function withoutSiteName(title: string): string {
  const name = title.trim();
  if (!name.toLowerCase().endsWith(SITE_SUFFIX.toLowerCase())) return name;
  const head = name.slice(0, -SITE_SUFFIX.length).trimEnd();
  // only strip it when a separator is actually there, so a page genuinely
  // called "Electrical Training Institute" survives
  return SEPARATORS.some((s) => head.endsWith(s))
    ? head.slice(0, -1).trimEnd()
    : name;
}

export function shortPageTitle(page: Page): string {
  const t = withoutSiteName(page.title);
  return t || page.route;
}

/** Pages an editor can link to — `/_global` is shared content, not a route. */
export function linkablePages(pages: Page[]): Page[] {
  return pages.filter((p) => !p.route.startsWith("/_"));
}
