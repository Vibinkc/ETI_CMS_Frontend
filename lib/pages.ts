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
export function shortPageTitle(page: Page): string {
  const t = page.title.replace(/\s*[-–]\s*Electrical Training Institute\s*$/i, "").trim();
  return t || page.route;
}

/** Pages an editor can link to — `/_global` is shared content, not a route. */
export function linkablePages(pages: Page[]): Page[] {
  return pages.filter((p) => !p.route.startsWith("/_"));
}
