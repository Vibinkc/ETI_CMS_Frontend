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

/** Every page title ends in "- Electrical Training Institute"; drop it. */
const SITE_SUFFIX = "Electrical Training Institute";
const SEPARATORS = ["-", "–"];

/**
 * Drop the site name every page title ends with.
 *
 * String operations rather than a regular expression: the pattern this
 * replaced had an optional-whitespace group either side of a literal, which
 * backtracks badly on a title made mostly of spaces.
 */
function withoutSiteName(title: string): string {
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
