"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import Pagination from "@/components/Pagination";
import { api, type ActivityPage, type ActivityRow } from "@/lib/api";

/** Reads better than the raw action key, and groups related events. */
const ACTIONS: Record<string, { label: string; tone: string }> = {
  "login": { label: "Signed in", tone: "ok" },
  "logout": { label: "Signed out", tone: "quiet" },
  "login.failed": { label: "Failed sign-in", tone: "warn" },
  "login.blocked": { label: "Sign-in blocked", tone: "warn" },
  "page.update": { label: "Edited a page", tone: "edit" },
  "media.upload": { label: "Uploaded media", tone: "edit" },
  "media.delete": { label: "Deleted media", tone: "danger" },
  "submission.delete": { label: "Deleted a submission", tone: "danger" },
  "user.create": { label: "Created an account", tone: "admin" },
  "user.update": { label: "Changed an account", tone: "admin" },
  "user.password": { label: "Set a password", tone: "admin" },
  "user.delete": { label: "Deleted an account", tone: "danger" },
  "role.create": { label: "Created a role", tone: "admin" },
  "role.update": { label: "Changed a role", tone: "admin" },
  "role.delete": { label: "Deleted a role", tone: "danger" },
};

function describe(action: string) {
  return ACTIONS[action] ?? { label: action, tone: "quiet" };
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

type RangeKey = "all" | "today" | "week";

function since(range: RangeKey): string | undefined {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (range === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return undefined;
}

const PAGE_SIZE = 25;

export default function Activity() {
  const { can } = useAuth();
  const [data, setData] = useState<ActivityPage | null>(null);
  const [filters, setFilters] = useState<{ usernames: string[]; actions: string[] }>({
    usernames: [], actions: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");
  const [q, setQ] = useState("");
  const [range, setRange] = useState<RangeKey>("all");
  const [open, setOpen] = useState<ActivityRow | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (who) params.set("username", who);
    if (what) params.set("action", what);
    if (q.trim()) params.set("q", q.trim());
    const from = since(range);
    if (from) params.set("since", from);
    try {
      setData(await api.get<ActivityPage>(`/api/cms/activity?${params}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the activity log");
    }
  }, [who, what, q, range, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // A narrower filter can leave you on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [who, what, q, range]);

  useEffect(() => {
    api.get<{ usernames: string[]; actions: string[] }>("/api/cms/activity/filters")
      .then(setFilters)
      .catch(() => {});
  }, [data?.total]);

  if (!can("activity:view")) {
    return (
      <>
        <div className="topbar"><h1>Activity log</h1></div>
        <div className="content">
          <div className="empty">Your account does not have permission to view the activity log.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <h1>Activity log</h1>
        {data && <span className="route">{data.total} entries</span>}
      </div>

      <div className="content">
        <div className="sub-tools">
          <input className="sub-search" type="search" placeholder="Search what happened"
            value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the activity log" />
          <label className="sub-check">
            <span>Who</span>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Everyone</option>
              {filters.usernames.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="sub-check">
            <span>What</span>
            <select value={what} onChange={(e) => setWhat(e.target.value)}>
              <option value="">Everything</option>
              {filters.actions.map((a) => (
                <option key={a} value={a}>{describe(a).label}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="sub-range">
          <legend className="sub-range-legend">Period</legend>
          {([["all", "All time"], ["today", "Today"], ["week", "This week"]] as const).map(([key, label]) => (
            <label key={key} className={`sub-chip${range === key ? " on" : ""}`}>
              <input type="radio" name="range" checked={range === key}
                onChange={() => setRange(key)} />
              {label}
            </label>
          ))}
        </fieldset>

        {error && <div className="notice notice-error">{error}</div>}

        {!data ? <div className="empty">Loading…</div>
          : data.items.length === 0 ? <div className="empty">Nothing matches those filters.</div>
          : (
            <div className="sub-table-wrap">
              <table className="sub-table activity-table">
                <thead>
                  <tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr>
                </thead>
                <tbody>
                  {data.items.map((row) => {
                    const d = describe(row.action);
                    return (
                      <tr key={row.id} onClick={() => setOpen(row)} tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter") setOpen(row); }}>
                        <td className="muted small">{when(row.created_at)}</td>
                        <td><strong>{row.username}</strong></td>
                        <td><span className={`act act-${d.tone}`}>{d.label}</span></td>
                        <td>{row.summary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        {data && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            onChange={setPage}
            label="entries"
          />
        )}

        {open && (
          <div className="act-detail">
            <h2 className="uk-h5">Entry #{open.id}</h2>
            <dl className="sub-card">
              <div><dt>When</dt><dd>{new Date(open.created_at).toLocaleString()}</dd></div>
              <div><dt>Who</dt><dd>{open.username}</dd></div>
              <div><dt>Action</dt><dd>{open.action}</dd></div>
              <div><dt>Detail</dt><dd>{open.summary}</dd></div>
              {open.resource_type && (
                <div><dt>Applied to</dt><dd>{open.resource_type} #{open.resource_id}</dd></div>
              )}
              {open.meta && (
                <div><dt>Extra</dt><dd><code>{JSON.stringify(open.meta)}</code></dd></div>
              )}
            </dl>
            <button type="button" className="btn btn-sm" onClick={() => setOpen(null)}>Close</button>
          </div>
        )}
      </div>
    </>
  );
}
