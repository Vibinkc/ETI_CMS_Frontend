import { expect, test } from "@playwright/test";

import { accessibleNames, signIn } from "../support/cms";

test.describe("Shell, sidebar and the drawer", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("TC-NAV-001 the tree renders in its curated groups", async ({ page }) => {
    const headings = await page.locator("nav .nav-heading").allInnerTexts();
    // allInnerTexts returns text after text-transform: uppercase (TI-06), so
    // compare case-insensitively rather than against the source casing
    const upper = headings.map((h) => h.trim().toUpperCase());
    for (const wanted of ["SITE", "PROGRAMS", "ABOUT", "NEWS & EVENTS", "OTHER PAGES"]) {
      expect(upper, `group ${wanted}`).toContain(wanted);
    }
    expect(await page.locator(".nav-label").count()).toBeGreaterThan(10);
  });

  test("TC-NAV-009 the tree is cached and repaints from cache", async ({ page }) => {
    const cached = await page.evaluate(() => localStorage.getItem("eti-cms.pages"));
    expect(cached, "the page list should be cached after a load").not.toBeNull();
    expect(JSON.parse(cached!).length).toBeGreaterThan(10);
  });

  test("TC-NAV-017 View website is external and safe", async ({ page }) => {
    const link = page.getByRole("link", { name: "View website" });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noreferrer");
  });

  test("TC-A11Y-002 the shell exposes navigation, main and a skip link", async ({ page }) => {
    await expect(page.locator("aside.sidebar nav")).toHaveCount(1);
    await expect(page.locator("main#main")).toHaveCount(1);
    await expect(page.locator("a.skip-link")).toHaveCount(1);
  });

  test("the skip link is the first thing focused and reaches main", async ({ page }) => {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.className ?? "");
    expect(focused).toContain("skip-link");
    await expect(page.locator("a.skip-link")).toHaveAttribute("href", "#main");
  });

  test("NV-8 the burger closes the sidebar on a desktop", async ({ page }) => {
    const width = async () =>
      page.locator("main.main").evaluate((el) => Math.round(el.getBoundingClientRect().width));
    const before = await width();
    await page.locator(".nav-closer").click();
    await expect(page.locator("aside.sidebar")).toBeHidden();
    expect(await width(), "content should take the freed space").toBeGreaterThan(before);
    await page.locator(".nav-opener").click();
    await expect(page.locator("aside.sidebar")).toBeVisible();
  });

  test("NV-8 below 1024px it behaves as a drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/media");

    // put away by default, so the content column is the whole viewport
    await expect(page.locator(".nav-opener")).toBeVisible();
    const offScreen = await page
      .locator("aside.sidebar")
      .evaluate((el) => el.getBoundingClientRect().right <= 0);
    expect(offScreen, "the drawer should start closed on a narrow screen").toBe(true);

    await page.locator(".nav-opener").click();
    await expect(page.locator(".nav-backdrop")).toBeVisible();
    // it slides in over 0.22s, so poll for the settled position rather than
    // measuring mid-transition
    await expect
      .poll(
        () =>
          page
            .locator("aside.sidebar")
            .evaluate((el) => Math.round(el.getBoundingClientRect().left)),
        { timeout: 5_000 },
      )
      .toBe(0);

    // Tapping beside it closes it, the way a drawer should. The backdrop spans
    // the viewport and the drawer sits on top of it, so aim at the dimmed strip
    // to the right of the drawer rather than the backdrop's centre.
    await page.locator(".nav-backdrop").click({ position: { x: 340, y: 400 } });
    await expect(page.locator(".nav-backdrop")).toBeHidden();
  });

  test("the drawer closes itself on navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/media");
    await page.locator(".nav-opener").click();
    await expect(page.locator(".nav-backdrop")).toBeVisible();
    // a different route, so pathname actually changes
    await page.locator(".nav-item", { hasText: "Activity log" }).first().click();
    await page.waitForURL(/\/activity/, { timeout: 20_000 });
    await expect(page.locator(".nav-backdrop")).toBeHidden();
  });

  test("RC-13 both drawer controls clear the 24px touch minimum", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/media");
    for (const sel of [".nav-opener", ".nav-closer"]) {
      if (sel === ".nav-closer") await page.locator(".nav-opener").click();
      const box = await page.locator(sel).boundingBox();
      expect(box, sel).not.toBeNull();
      expect(box!.width, `${sel} width`).toBeGreaterThanOrEqual(24);
      expect(box!.height, `${sel} height`).toBeGreaterThanOrEqual(24);
    }
  });

  test("RC-13 the page-tree expander clears it too", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/media");
    await page.locator(".nav-opener").click();
    const hit = await page.locator(".nav-twisty").first().evaluate((el) => {
      const cs = getComputedStyle(el, "::after");
      const box = el.getBoundingClientRect();
      // the rail cannot grow without pushing labels out of line, so an overlay
      // widens the hit area instead of the box
      const inset = parseFloat(cs.left || "0");
      return { width: box.width - inset * 2, height: box.height };
    });
    expect(hit.width).toBeGreaterThanOrEqual(24);
    expect(hit.height).toBeGreaterThanOrEqual(24);
  });

  test("TC-A11Y-006 every media Delete button names its own file", async ({ page }) => {
    await page.goto("/media");
    await expect(page.locator(".media-tile").first()).toBeVisible();
    const buttons = page.locator('.media-tile button[aria-label^="Delete "]');
    const total = await buttons.count();
    expect(total).toBeGreaterThan(1);
    const names = await accessibleNames(buttons);
    expect(new Set(names).size, "each Delete must be distinguishable").toBe(total);
  });
});
