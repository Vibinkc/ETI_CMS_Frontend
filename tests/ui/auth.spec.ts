import { expect, test } from "@playwright/test";

import { PASS, ROUTES, USER, signIn } from "../support/cms";

test.describe("Authentication and session", () => {
  test("TC-AUTH-001 a valid sign-in lands on a permitted screen", async ({ page }) => {
    await signIn(page);
    // /pages redirects on to /pages/{id}; either is a permitted landing
    expect(page.url()).toMatch(/\/pages(\/\d+)?$/);
    await expect(page.locator("aside.sidebar")).toBeVisible();
    await expect(page.locator(".sidebar-foot")).toContainText(USER);
  });

  test("TC-AUTH-003/004 a wrong password and an unknown user are indistinguishable", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#username").fill(USER);
    await page.locator("#password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    const wrongPassword = (await page.locator(".login-alert").innerText()).trim();

    await page.goto("/login");
    await page.locator("#username").fill("nobody-by-that-name");
    await page.locator("#password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    const unknownUser = (await page.locator(".login-alert").innerText()).trim();

    // character-for-character identical, or the form enumerates accounts
    expect(unknownUser).toBe(wrongPassword);
    expect(wrongPassword).toContain("Incorrect username or password");
    expect(await page.evaluate(() => localStorage.getItem("eti_cms_token"))).toBeNull();
    expect(page.url()).toContain("/login");
  });

  test("TC-AUTH-008 the reveal button flips the field and its own name", async ({ page }) => {
    await page.goto("/login");
    const field = page.locator("#password");
    await expect(field).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(field).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(field).toHaveAttribute("type", "password");
  });

  test("TC-AUTH-010 the token is written under the documented key", async ({ page }) => {
    await signIn(page);
    const token = await page.evaluate(() => localStorage.getItem("eti_cms_token"));
    expect(token).not.toBeNull();
    expect(token!.split(".")).toHaveLength(3);
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  });

  test("TC-AUTH-014 every protected route redirects when signed out", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForURL(/\/login/, { timeout: 20_000 });
      expect(page.url(), `${route} should redirect`).toContain("/login");
    }
  });

  test("TC-AUTH-015 a forged token is rejected and both keys are cleared", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.setItem("eti_cms_token", "not.a.jwt");
      localStorage.setItem("eti-cms.pages", "[]");
    });
    await page.goto("/pages");
    await page.waitForURL(/\/login/, { timeout: 25_000 });
    expect(await page.evaluate(() => localStorage.getItem("eti_cms_token"))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("eti-cms.pages"))).toBeNull();
  });

  test("TC-AUTH-020 signing out clears storage and returns to the form", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/, { timeout: 20_000 });
    expect(await page.evaluate(() => localStorage.getItem("eti_cms_token"))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("eti-cms.pages"))).toBeNull();
  });

  test("TC-AUTH-011 a reload restores the session without signing in again", async ({ page }) => {
    await signIn(page);
    await page.goto("/media");
    await page.reload();
    await expect(page.locator("aside.sidebar")).toBeVisible();
    expect(page.url()).toContain("/media");
  });

  test("TC-AUTH-006/007 empty fields are stopped by the browser, with no request", async ({ page }) => {
    await page.goto("/login");
    let posted = false;
    page.on("request", (r) => {
      if (r.url().includes("/api/auth/login")) posted = true;
    });
    await page.locator("#password").fill(PASS);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForTimeout(600);
    expect(posted, "an empty username must not reach the API").toBe(false);
    expect(page.url()).toContain("/login");
  });
});
