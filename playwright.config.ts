import { defineConfig, devices } from "@playwright/test";

/**
 * Everything here runs read-only against whatever host PW_BASE_URL points at.
 *
 * The suite deliberately holds to Group A of PLAYWRIGHT_TEST_CASES.md §3.8:
 * reads, authorization refusals, responsive and accessibility. Nothing creates,
 * updates or deletes, so it is safe against a live host. The one unavoidable
 * side effect is an activity-log row per sign-in, which §3.8 already accepts.
 *
 * Chromium only for now. The rich-text editor is built on the deprecated
 * document.execCommand, which produces different markup per engine, and NV-7
 * has to be settled before the matrix is widened.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // the activity log and list totals are shared state
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: process.env.PW_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: "Asia/Kolkata",
    locale: "en-US",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
