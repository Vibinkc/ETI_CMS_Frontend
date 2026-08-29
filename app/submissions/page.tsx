"use client";

import { useCallback, useEffect, useState } from "react";

import { ArrowLeft, Download, Mail, Phone, Trash } from "@/components/icons";
import Pagination from "@/components/Pagination";
import {
  API_BASE,
  api,
  getToken,
  type Submission,
  type SubmissionDetail,
  type SubmissionPage,
} from "@/lib/api";
import {
  RANGE_LABELS,
  rangeBounds,
  todayValue,
  type RangeKey,
} from "@/lib/dateRange";

/** Field names come from the original form ("First_Name"); show them as words. */
function prettyLabel(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The form asks its questions in groups, and a submission reads best the same
 * way. Anything the form gains later that is not listed here still appears,
 * under "Other answers", so a new question is never silently dropped.
 */
const GROUPS: { title: string; fields: string[] }[] = [
  {
    title: "Personal information",
    fields: ["First_Name", "Last_Name", "Age", "Gender", "Self_Describe", "Race", "Other_Ethnicity"],
  },
  {
    title: "Interest",
    fields: ["Program", "Other_Programs", "Hear_About", "Other_Hear"],
  },
];

/** Assembled into one block rather than five rows. */
const ADDRESS_FIELDS = ["Address1", "address2", "City", "State", "Zip"];

/** Form internals, not answers — shown quietly at the end. */
const META_FIELDS = ["formid", "Date"];

const HANDLED = new Set([
  ...GROUPS.flatMap((g) => g.fields),
  ...ADDRESS_FIELDS,
  ...META_FIELDS,
  "Phone",
  "Email",
]);

function addressLines(answers: Record<string, string>) {
  const street = [answers.Address1, answers.address2].filter(Boolean).join(", ");
  const town = [answers.City, answers.State, answers.Zip].filter(Boolean).join(" ");
  return [street, town].filter(Boolean);
}


/**
 * Date filtering happens in the reader's own timezone: "today" means their
 * today, so the boundaries are worked out here and sent to the API as absolute
 * instants. The server stores UTC and has no idea where anyone is.
 */
const PAGE_SIZE = 25;

export default function Submissions() {
  const [data, setData] = useState<SubmissionPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [range, setRange] = useState<RangeKey>("all");
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<SubmissionDetail | null>(null);
  const [busy, setBusy] = useState(false);

  /** The filters, without paging — used for the CSV, which exports everything. */
  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (unreadOnly) params.set("unread_only", "true");
    const { since, until } = rangeBounds(range, from, to);
    if (since) params.set("since", since.toISOString());
    if (until) params.set("until", until.toISOString());
    return params;
  }, [query, unreadOnly, range, from, to]);

  const load = useCallback(async () => {
    const params = buildParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((page - 1) * PAGE_SIZE));
    try {
      setData(await api.get<SubmissionPage>(`/api/cms/submissions?${params}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load submissions");
    }
  }, [buildParams, page]);

  useEffect(() => {
    // a beat, so typing in the search box does not fire a request per keystroke
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // A narrower filter can leave you on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [query, unreadOnly, range, from, to]);

  async function openOne(row: Submission) {
    try {
      // opening marks it read on the server, so refresh the list behind it
      const detail = await api.get<SubmissionDetail>(`/api/cms/submissions/${row.id}`);
      setOpen(detail);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that submission");
    }
  }

  async function toggleRead(row: Submission, e: React.MouseEvent) {
    e.stopPropagation();
    await api.patch(`/api/cms/submissions/${row.id}`, { is_read: !row.is_read });
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    setBusy(true);
    try {
      await api.del(`/api/cms/submissions/${id}`);
      setOpen(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  /** The CSV needs the auth header, so it is fetched and saved rather than linked. */
  async function exportCsv() {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/cms/submissions/export.csv?${buildParams()}`, {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `submissions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export");
    } finally {
      setBusy(false);
    }
  }

  const today = todayValue();

  if (open) {
    const a = open.answers;
    const address = addressLines(a);
    const extras = Object.entries(a).filter(([k]) => !HANDLED.has(k));

    return (
      <>
        <div className="topbar">
          <button type="button" className="btn btn-sm" onClick={() => setOpen(null)}>
            <ArrowLeft size={15} /> All submissions
          </button>
          <h1>{open.name || "Submission"}</h1>
          <span className="route">#{open.id}</span>
          <div className="spacer" />
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => remove(open.id)}
            disabled={busy}
          >
            <Trash size={15} /> Delete
          </button>
        </div>

        <div className="content">
          {/* Who they are and how to reach them, before any of the detail. */}
          <div className="sub-summary">
            <div className="sub-summary-main">
              <h2>{open.name || "(no name given)"}</h2>
              <p className="muted small">
                {prettyLabel(open.form_key)} form · {when(open.created_at)}
              </p>
            </div>
            <div className="sub-summary-contact">
              {open.email && (
                <a className="btn btn-sm" href={`mailto:${open.email}`}>
                  <Mail size={15} /> {open.email}
                </a>
              )}
              {open.phone && (
                <a className="btn btn-sm" href={`tel:${open.phone.replace(/[^\d+]/g, "")}`}>
                  <Phone size={15} /> {open.phone}
                </a>
              )}
            </div>
          </div>

          <div className="sub-cards">
            {GROUPS.map((group) => {
              const rows = group.fields.filter((f) => a[f]);
              if (!rows.length) return null;
              return (
                <section key={group.title} className="sub-card">
                  <h3>{group.title}</h3>
                  <dl>
                    {rows.map((f) => (
                      <div key={f}>
                        <dt>{prettyLabel(f)}</dt>
                        <dd>{a[f]}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}

            {(address.length > 0 || open.email || open.phone) && (
              <section className="sub-card">
                <h3>Contact details</h3>
                <dl>
                  {a.Email && (
                    <div>
                      <dt>Email</dt>
                      <dd>
                        <a href={`mailto:${a.Email}`}>{a.Email}</a>
                      </dd>
                    </div>
                  )}
                  {a.Phone && (
                    <div>
                      <dt>Phone</dt>
                      <dd>
                        <a href={`tel:${a.Phone.replace(/[^\d+]/g, "")}`}>{a.Phone}</a>
                      </dd>
                    </div>
                  )}
                  {address.length > 0 && (
                    <div>
                      <dt>Address</dt>
                      <dd>
                        {address.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {extras.length > 0 && (
              <section className="sub-card">
                <h3>Other answers</h3>
                <dl>
                  {extras.map(([k, v]) => (
                    <div key={k}>
                      <dt>{prettyLabel(k)}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>

          <p className="muted small sub-meta">
            {META_FIELDS.filter((f) => a[f])
              .map((f) => `${prettyLabel(f)}: ${a[f]}`)
              .join("  ·  ")}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <h1>Contact forms</h1>
        {data && data.unread > 0 && <span className="badge badge-new">{data.unread} new</span>}
        <div className="spacer" />
        <button type="button" className="btn btn-sm" onClick={exportCsv} disabled={busy}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="content">
        <div className="sub-tools">
          <input
            type="search"
            className="sub-search"
            placeholder="Search name, email, phone or program"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search submissions"
          />
          <label className="sub-check">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            <span>Unread only</span>
          </label>
        </div>

        {/* Radios, not buttons: these are one choice out of five, and a screen
            reader should hear them that way. */}
        <fieldset className="sub-range">
          <legend className="sub-range-legend">Filter by date received</legend>
          {RANGE_LABELS.map(({ key, label }) => (
            <label key={key} className={`sub-chip${range === key ? " on" : ""}`}>
              <input
                type="radio"
                name="range"
                value={key}
                checked={range === key}
                onChange={() => setRange(key)}
              />
              {label}
            </label>
          ))}

          {range === "custom" && (
            <span className="sub-dates">
              <label>
                From
                {/* never past today: nothing can arrive in the future, and the
                    picker should not offer months that have not happened */}
                <input
                  type="date"
                  value={from}
                  max={to || today}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  max={today}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              {(from || to) && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                >
                  Clear
                </button>
              )}
            </span>
          )}
        </fieldset>

        {error && <div className="notice notice-error">{error}</div>}

        {!data ? (
          <div className="empty">Loading…</div>
        ) : data.items.length === 0 ? (
          <div className="empty">
            {query || unreadOnly || range !== "all"
              ? "No submissions match those filters."
              : "Nothing yet. Anything sent through the website's Get Started form will appear here."}
          </div>
        ) : (
          <div className="sub-table-wrap">
            <table className="sub-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Program</th>
                <th>Received</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => openOne(row)}
                  className={row.is_read ? undefined : "unread"}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openOne(row);
                    }
                  }}
                >
                  <td>{row.name || <span className="muted">(no name)</span>}</td>
                  <td>{row.email || ""}</td>
                  <td>{row.phone || ""}</td>
                  <td>{row.program || ""}</td>
                  <td className="muted small">{when(row.created_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={(e) => toggleRead(row, e)}
                      title={row.is_read ? "Mark unread" : "Mark read"}
                    >
                      {row.is_read ? "Read" : "New"}
                    </button>
                  </td>
                </tr>
              ))}
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
            label={range === "all" ? "submissions" : "in the selected period"}
          />
        )}
      </div>
    </>
  );
}
