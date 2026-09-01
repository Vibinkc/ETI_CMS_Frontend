import { expect, test } from "@playwright/test";

import { ROUTES, VIEWPORTS, expectNoOverflow, signIn } from "../support/cms";

/**
 * §18. The findings recorded 21 of these failing: a 272px sidebar with no
 * breakpoint left a 118px content column and every route scrolled sideways.
 */
test.describe("Responsive", () => {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} ${vp.width}x${vp.height}`, () => {
      test.beforeEach(async ({ page }) => {
        await signIn(page);
        await page.setViewportSize({ width: vp.width, height: vp.height });
      });

      for (const route of ROUTES) {
        test(`RC-1/RC-2 ${route}`, async ({ page }) => {
          await page.goto(route);
          await page.waitForLoadState("networkidle");
          await expectNoOverflow(page, `${route} at ${vp.width}`);
        });
      }
    });
  }

  test("TC-RSP-036 the permission matrix fits and scrolls in its own box", async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/users");
    await page.getByRole("button", { name: "New account" }).click();
    await expect(page.locator(".matrix-scroll")).toBeVisible();

    await expectNoOverflow(page, "users create form at 390");
    const m = await page.evaluate(() => {
      const scroll = document.querySelector(".matrix-scroll")!;
      const sticky = document.querySelector(".matrix-object")!;
      return {
        box: Math.round(scroll.getBoundingClientRect().width),
        sticky: Math.round(sticky.getBoundingClientRect().width),
        scrollsInternally: scroll.scrollWidth > scroll.clientWidth,
      };
    });
    // the report measured a 253px sticky column inside a 118px content column
    expect(m.box, "content box should be the viewport, not 118px").toBeGreaterThan(300);
    expect(m.sticky).toBeLessThan(m.box);
    expect(m.scrollsInternally, "the matrix must scroll itself, not the page").toBe(true);
  });

  test("TC-RSP-042 the media picker dialog fits the viewport", async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/pages");
    await expect(page.locator(".slot").first()).toBeVisible();

    const change = page.locator('button[aria-label^="Change "]').first();
    await change.click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();

    const box = (await dialog.boundingBox())!;
    expect(box.width, "dialog wider than the viewport").toBeLessThanOrEqual(391);
    expect(box.height, "dialog taller than the viewport").toBeLessThanOrEqual(845);
    await expectNoOverflow(page, "media picker at 390");
  });

  test("TC-RSP-045 the date range stays inside the column when Custom is open", async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/activity");
    await page.locator(".sub-chip", { hasText: "Custom" }).click();
    await expect(page.locator('.sub-dates input[type="date"]').first()).toBeVisible();

    const escaping = await page.evaluate(() =>
      [...document.querySelectorAll(".sub-range *")].filter(
        (el) => el.getBoundingClientRect().right > window.innerWidth + 0.5,
      ).length,
    );
    // the report measured 7 elements escaping the content column
    expect(escaping, "controls escaping the viewport").toBe(0);
    await expectNoOverflow(page, "activity date range at 390");
  });

  test("TC-RSP-010/011 media filenames truncate instead of widening their tile", async ({ page }) => {
    await signIn(page);
    await page.goto("/media");
    await expect(page.locator(".media-tile").first()).toBeVisible();
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll(".media-tile .fn")].filter((el) => {
        const cs = getComputedStyle(el);
        // an ellipsis is the fix, not the fault
        return el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== "ellipsis";
      }).length,
    );
    expect(bad).toBe(0);
  });
});
