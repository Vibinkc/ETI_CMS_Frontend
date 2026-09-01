import { expect, test } from "@playwright/test";

import { API, apiToken } from "../support/cms";

/**
 * §15 and §16, read-only. Everything here either reads or is expected to be
 * refused, so none of it writes to the host it runs against.
 */
test.describe("API contract", () => {
  test("TC-HLT-001/002 health and pulse answer", async ({ request }) => {
    const health = await request.get(`${API}/api/health`);
    expect(health.status()).toBe(200);
    expect((await health.json()).message).toBe("All Healthy");

    const pulse = await request.get(`${API}/api/pulse`);
    expect(pulse.status()).toBe(200);
  });

  test("TC-API-001 authenticated endpoints refuse a missing token", async ({ request }) => {
    const guarded = [
      "/api/cms/pages",
      "/api/cms/users",
      "/api/cms/roles",
      "/api/cms/activity",
      "/api/cms/submissions",
      "/api/media",
    ];
    for (const path of guarded) {
      const res = await request.get(`${API}${path}`);
      expect(res.status(), `${path} without a token`).toBe(401);
      expect((await res.json()).detail).toBe("Not authenticated");
    }
  });

  test("TC-API-002 a malformed token is refused", async ({ request }) => {
    const res = await request.get(`${API}/api/cms/pages`, {
      headers: { Authorization: "Bearer garbage" },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).detail).toBe("Could not validate credentials");
  });

  test("TC-PUB-001/002/003 the public contract needs no token", async ({ request }) => {
    const all = await request.get(`${API}/api/content`);
    expect(all.status()).toBe(200);
    expect(Array.isArray(await all.json())).toBe(true);

    const routes = await request.get(`${API}/api/content/routes`);
    expect(routes.status()).toBe(200);
    expect(await routes.json()).toContain("/");

    const one = await request.get(`${API}/api/content/page?route=/`);
    expect(one.status()).toBe(200);
    expect((await one.json()).slots).toBeTruthy();
  });

  test("TC-PUB-004/005 routes normalise, and an unknown one is a 404", async ({ request }) => {
    const noSlash = await request.get(`${API}/api/content/page?route=about/about-eti`);
    expect(noSlash.status()).toBe(200);

    const missing = await request.get(`${API}/api/content/page?route=/nope`);
    expect(missing.status()).toBe(404);
    expect((await missing.json()).detail).toBe("No page for route /nope");
  });

  test("TC-SUB-003/004 the intake refuses an unknown form and an empty one", async ({ request }) => {
    const unknown = await request.post(`${API}/api/forms/contact`, {
      data: { answers: { a: "b" } },
    });
    expect(unknown.status()).toBe(404);
    expect((await unknown.json()).detail).toBe("Unknown form");

    const empty = await request.post(`${API}/api/forms/sign-up`, { data: { answers: {} } });
    expect(empty.status()).toBe(422);
  });

  test("TC-SUB-006 a honeypot hit stores nothing and reports no id", async ({ request }) => {
    const res = await request.post(`${API}/api/forms/sign-up`, {
      data: {
        website: "http://spam.example",
        answers: { First_Name: "Bot", Last_Name: "Spam" },
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // nothing was stored, so there is no id to report -- the key is absent
    // rather than present and null
    expect("id" in body).toBe(false);
  });

  test("F-01 an owner's permissions agree across both endpoints", async ({ request }) => {
    const token = await apiToken();
    const headers = { Authorization: `Bearer ${token}` };

    const mine = await request.get(`${API}/api/cms/me/permissions`, { headers });
    const minePerms: string[] = (await mine.json()).permissions;

    const users = await request.get(`${API}/api/cms/users`, { headers });
    const owner = (await users.json()).find((u: any) => u.role_name === "Administrator");

    expect(owner, "an Administrator account should exist").toBeTruthy();
    // the sentinel used to be stripped with nothing put in its place, so this
    // read 0 while /me/permissions read the full list
    expect(owner.permissions.length).toBe(minePerms.length);
    expect(owner.permissions).not.toContain("*");
    expect(minePerms).not.toContain("*");
  });

  test("TC-API-018 paging parameters are validated, not clamped", async ({ request }) => {
    const token = await apiToken();
    const headers = { Authorization: `Bearer ${token}` };
    for (const q of ["limit=0", "limit=201", "offset=-1", "since=not-a-date"]) {
      const res = await request.get(`${API}/api/cms/submissions?${q}`, { headers });
      expect(res.status(), q).toBe(422);
    }
    const ok = await request.get(`${API}/api/cms/submissions?limit=200`, { headers });
    expect(ok.status()).toBe(200);
  });

  test("TC-API-019/022/024 unknown ids are 404 across the resources", async ({ request }) => {
    const token = await apiToken();
    const headers = { Authorization: `Bearer ${token}` };
    const cases: [string, string][] = [
      [`${API}/api/cms/submissions/999999`, "No such submission"],
      [`${API}/api/cms/pages/999999`, "No such page"],
      [`${API}/api/media/999999/raw`, "No such media"],
    ];
    for (const [url, detail] of cases) {
      const res = await request.get(url, { headers });
      expect(res.status(), url).toBe(404);
      expect((await res.json()).detail).toBe(detail);
    }
  });

  test("TC-MED-022 media bytes are public and cacheable", async ({ request }) => {
    const token = await apiToken();
    const list = await request.get(`${API}/api/media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const first = (await list.json())[0];
    test.skip(!first, "no media on this host");

    // deliberately no Authorization header
    const raw = await request.get(`${API}/api/media/${first.id}/raw`);
    expect(raw.status()).toBe(200);
    expect(raw.headers()["cache-control"]).toContain("immutable");
    expect(raw.headers()["etag"]).toBeTruthy();
  });

  test("TC-ACT-023 the activity log is append-only", async ({ request }) => {
    const token = await apiToken();
    const headers = { Authorization: `Bearer ${token}` };
    const del = await request.delete(`${API}/api/cms/activity/1`, { headers });
    expect([404, 405]).toContain(del.status());
  });

  test("TC-ACT-020 no activity row carries an IP address or user agent", async ({ request }) => {
    const token = await apiToken();
    const res = await request.get(`${API}/api/cms/activity?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rows = (await res.json()).items;
    const leaked = rows.filter(
      (r: any) => JSON.stringify(r).match(/ip_address|user_agent/i),
    );
    expect(leaked).toEqual([]);
  });
});
