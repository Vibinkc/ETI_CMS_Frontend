import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { ROUTES, signIn } from "../support/cms";

const AXE = fs.readFileSync(
  path.join(process.cwd(), "node_modules/axe-core/axe.min.js"),
  "utf8",
);

type Violation = { id: string; impact: string; nodes: number; sample: string };

async function audit(page: Page): Promise<Violation[]> {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    // @ts-expect-error axe is injected above
    const r = await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return r.violations.map((v: any) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      sample: v.nodes[0]?.target?.join(" ") ?? "",
    }));
  });
}

const show = (v: Violation[]) =>
  v.map((x) => `${x.impact} ${x.id} x${x.nodes} (${x.sample})`).join("\n");

test.describe("Accessibility", () => {
  test("TC-A11Y-022 /login is clean", async ({ page }) => {
    await page.goto("/login");
    const v = await audit(page);
    expect(show(v)).toBe("");
  });

  for (const route of ROUTES) {
    test(`TC-A11Y-022 ${route} is clean`, async ({ page }) => {
      await signIn(page);
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const v = await audit(page);
      expect(show(v)).toBe("");
    });
  }

  test("TC-A11Y-022 the create form and its matrix are clean", async ({ page }) => {
    await signIn(page);
    await page.goto("/users");
    await page.getByRole("button", { name: "New account" }).click();
    await expect(page.locator(".matrix-scroll")).toBeVisible();
    const v = await audit(page);
    expect(show(v)).toBe("");
  });

  test("TC-A11Y-022 the editor is clean at 390px too", async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/pages");
    await expect(page.locator(".slot").first()).toBeVisible();
    const v = await audit(page);
    expect(show(v)).toBe("");
  });

  test("§4.3 every editable control in the editor has a name", async ({ page }) => {
    await signIn(page);
    await page.goto("/pages");
    await expect(page.locator(".slot").first()).toBeVisible();
    const m = await page.evaluate(() => {
      const controls = [
        ...document.querySelectorAll(".slot input, .slot textarea, .slot [role=textbox]"),
      ];
      return {
        total: controls.length,
        unnamed: controls.filter(
          (el) => !el.getAttribute("aria-label") && !el.closest("label"),
        ).length,
      };
    });
    expect(m.total, "the editor should render controls").toBeGreaterThan(10);
    // the findings counted 52 critical unlabelled inputs here
    expect(m.unnamed, "unlabelled controls").toBe(0);
  });

  test("TC-A11Y-017 every table carries a caption", async ({ page }) => {
    await signIn(page);
    for (const route of ["/users", "/roles", "/activity"]) {
      await page.goto(route);
      await expect(page.locator("table.sub-table")).toBeVisible();
      const caption = await page.locator("table.sub-table caption").innerText();
      expect(caption.trim(), `${route} caption`).not.toBe("");
    }
  });

  test("TC-VIS-004 the subtle ink clears AA on both grounds", async ({ page }) => {
    await signIn(page);
    const ratios = await page.evaluate(() => {
      const lum = (hex: string) => {
        const h = hex.replace("#", "").trim();
        const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
        const s = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
        return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
      };
      const ratio = (a: string, b: string) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      const css = getComputedStyle(document.documentElement);
      const ink = css.getPropertyValue("--eti-ink-subtle").trim();
      return {
        onSurface: ratio(ink, "#ffffff"),
        onCanvas: ratio(ink, "#eaeef4"),
      };
    });
    expect(ratios.onSurface).toBeGreaterThanOrEqual(4.5);
    expect(ratios.onCanvas).toBeGreaterThanOrEqual(4.5);
  });

  test("TC-A11Y-010 clickable rows are reachable from the keyboard", async ({ page }) => {
    await signIn(page);
    await page.goto("/users");
    const row = page.locator(".sub-table tbody tr").first();
    await expect(row).toHaveAttribute("tabindex", "0");
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  });
});
