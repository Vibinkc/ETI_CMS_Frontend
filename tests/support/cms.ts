import { expect, type Page, type Locator } from "@playwright/test";

export const API = process.env.PW_API_URL ?? "http://127.0.0.1:8001";
export const USER = process.env.PW_USER ?? "admin";
export const PASS = process.env.PW_PASS ?? "eti-admin";

/** Every signed-in route, as §3.8 lists them. */
export const ROUTES = [
  "/pages",
  "/media",
  "/submissions",
  "/users",
  "/roles",
  "/activity",
  "/no-access",
] as const;

export const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/**
 * Sign in through the real form.
 *
 * §23.2 recommends getByLabel("Password"), but Playwright matches labels by
 * substring and the reveal button is named "Show password", so that locator is
 * ambiguous (TI-01). #password is unambiguous and is what the login form
 * actually carries.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#username").fill(USER);
  await page.locator("#password").fill(PASS);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  // The landing is a two-step hop -- /pages then /pages/{id} -- and the tree
  // arrives on its own. Waiting for the chrome rather than the first URL keeps
  // every test from racing the redirect it did not ask about.
  await page.locator("aside.sidebar").waitFor({ state: "visible", timeout: 20_000 });
  // The static groups render at once; the page tree arrives from its own
  // fetch, so wait for a group that only exists once that has landed.
  await page.locator("nav .nav-heading", { hasText: /^site$/i }).waitFor({
    state: "attached",
    timeout: 20_000,
  });
  await page.waitForLoadState("networkidle");
}

/** A bearer token, for the cases that talk to the API directly. */
export async function apiToken(): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: USER, password: PASS }),
  });
  const body = await res.json();
  return body.access_token as string;
}

/**
 * RC-1: the page itself must never scroll sideways.
 * One pixel of slack, because layout rounding is not a defect.
 */
export async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

/**
 * RC-2: only containers that are meant to scroll may scroll.
 *
 * RC-5 already exempts anything declaring an ellipsis or its own overflow. Form
 * controls are exempt too: a text input whose value is longer than the field
 * always reports scrollWidth beyond clientWidth, which is how the control
 * works rather than a layout fault.
 */
export async function unexpectedScrollers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const allowed = ["sub-table-wrap", "matrix-scroll", "dialog-body", "rte-html"];
    return [...document.querySelectorAll("*")]
      .filter((el) => {
        if (el.scrollWidth <= el.clientWidth + 1) return false;
        if (el === document.documentElement || el === document.body) return false;
        if (el.closest(".sidebar")) return false;
        if (allowed.some((c) => el.classList.contains(c))) return false;
        if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return false;
        const cs = getComputedStyle(el);
        if (cs.textOverflow === "ellipsis") return false;
        if (cs.overflowX === "auto" || cs.overflowX === "scroll") return false;
        return true;
      })
      .map((el) => (el.className || el.tagName).toString().trim().slice(0, 40));
  });
}

/** Assert both responsive rules on whatever is currently rendered. */
export async function expectNoOverflow(page: Page, where: string): Promise<void> {
  expect(await pageOverflow(page), `${where}: page scrolls sideways`).toBeLessThanOrEqual(1);
  expect(await unexpectedScrollers(page), `${where}: unexpected scrollers`).toEqual([]);
}

/** The accessible name of every match, which is what a screen reader hears. */
export async function accessibleNames(locator: Locator): Promise<string[]> {
  const n = await locator.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push((await locator.nth(i).getAttribute("aria-label")) ?? (await locator.nth(i).innerText()));
  }
  return out;
}
