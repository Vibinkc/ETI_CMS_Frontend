import { expect, test } from "@playwright/test";

import { signIn } from "../support/cms";

/**
 * Each screen renders its own data and its own controls. Read-only: the
 * editor case proves the dirty state and then reloads away from it rather
 * than saving.
 */
test.describe("Screens", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("TC-PAGE-005 the editor names the page and counts its fields", async ({ page }) => {
    await page.goto("/pages");
    await expect(page.locator(".slot").first()).toBeVisible();
    const slots = await page.locator(".slot").count();
    const counter = await page.locator(".toolbar").innerText();
    expect(counter).toMatch(/\d+ editable fields/);
    const stated = Number(counter.match(/(\d+) editable fields/)![1]);
    expect(stated, "the count should match what is rendered").toBe(slots);
  });

  test("TC-PAGE-012 editing marks the field dirty and offers a save", async ({ page }) => {
    await page.goto("/pages");
    const field = page.locator('.slot input[type="text"]').first();
    await expect(field).toBeVisible();
    await field.click();
    await page.keyboard.type("zz");

    await expect(page.locator(".slot.dirty")).toHaveCount(1);
    await expect(page.locator(".topbar")).toContainText(/1 unsaved change/);
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();

    // leave without saving; the guard is a beforeunload, so dismiss it
    page.on("dialog", (d) => d.accept());
  });

  test("TC-PAGE-018 Save is disabled until something changes", async ({ page }) => {
    await page.goto("/pages");
    await expect(page.locator(".slot").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  test("TC-MED-001/003 the library lists and filters", async ({ page }) => {
    await page.goto("/media");
    await expect(page.locator(".media-tile").first()).toBeVisible();
    const all = await page.locator(".media-tile").count();
    expect(all).toBeGreaterThan(0);
    await expect(page.locator(".topbar")).toContainText(/\d+ files/);

    await page.getByPlaceholder("Filter by filename…").fill("logo");
    await page.waitForTimeout(400);
    const filtered = await page.locator(".media-tile").count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(all);
  });

  test("TC-USR-001 the accounts table shows its columns and the owner", async ({ page }) => {
    await page.goto("/users");
    await expect(page.locator("table.sub-table")).toBeVisible();
    const heads = (await page.locator("table thead th").allInnerTexts()).map((h) =>
      h.trim().toUpperCase(),
    );
    for (const col of ["USERNAME", "NAME", "EMAIL", "ROLE", "STATUS", "ACTIONS"]) {
      expect(heads, col).toContain(col);
    }
    await expect(page.locator(".owner-crown")).toHaveCount(1);
    await expect(page.locator(".topbar .route")).toContainText(/account/);
  });

  test("TC-ROL-002 the permissions column reads N permissions", async ({ page }) => {
    await page.goto("/roles");
    await expect(page.locator("table.sub-table")).toBeVisible();
    const cells = await page.locator("table tbody tr td:nth-child(3)").allInnerTexts();
    for (const c of cells) {
      // the specification says "N permissions"; the UI used to say "N permission(s)"
      expect(c, "no bracketed plural").not.toContain("permission(s)");
    }
  });

  test("TC-ACT-001 the log lists newest first with its filters", async ({ page }) => {
    await page.goto("/activity");
    await expect(page.locator(".activity-table tbody tr").first()).toBeVisible();
    const labels = (await page.locator(".sub-check span").allInnerTexts()).map((s) =>
      s.trim().toUpperCase(),
    );
    expect(labels).toContain("USER");
    expect(labels).toContain("ACTION");
    const chips = (await page.locator(".sub-chip").allInnerTexts()).map((c) => c.trim());
    expect(chips).toEqual(
      expect.arrayContaining(["All time", "Today", "This week", "This month", "Custom"]),
    );
  });

  test("TC-ACT-016 a custom range narrows the log", async ({ page }) => {
    await page.goto("/activity");
    await expect(page.locator(".activity-table tbody tr").first()).toBeVisible();
    await page.locator(".sub-chip", { hasText: "Custom" }).click();
    const [from, to] = await page.locator('.sub-dates input[type="date"]').all();
    await from.fill("2020-01-01");
    await to.fill("2020-01-31");
    await expect(page.locator(".empty")).toContainText(/Nothing matches those filters/);
  });

  test("TC-SUB-030 submissions shows a defined empty or a table", async ({ page }) => {
    await page.goto("/submissions");
    const hasTable = await page.locator("table.sub-table").count();
    if (hasTable) {
      await expect(page.locator("table.sub-table caption")).not.toBeEmpty();
    } else {
      await expect(page.locator(".empty")).toContainText(/Nothing yet|No submissions/);
    }
  });

  test("TC-ERR-011 a malformed page detail does not blank the console", async ({ page }) => {
    // drop `slots` from the response, exactly as the findings reproduced it
    await page.route("**/api/cms/pages/*", async (route) => {
      if (!/\/api\/cms\/pages\/\d+$/.test(route.request().url())) return route.continue();
      const res = await route.fetch();
      const body = await res.json();
      delete body.slots;
      await route.fulfill({ response: res, body: JSON.stringify(body) });
    });

    await page.goto("/pages");
    await page.waitForTimeout(3000);

    // the sidebar is the navigation the user needs to escape with
    expect(await page.locator(".sidebar .nav-item").count()).toBeGreaterThan(5);
    const text = (await page.locator("body").innerText()).trim();
    expect(text.length, "the app must not blank").toBeGreaterThan(200);
  });
});
