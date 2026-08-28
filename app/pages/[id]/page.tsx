"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import SlotEditor from "@/components/SlotEditor";
import {
  api,
  SITE_BASE,
  type Media,
  type PageDetail,
  type SaveResult,
  type Slot,
} from "@/lib/api";

type Edit = { value: string; alt: string; mediaId: number | null };

export default function PageEditor() {
  const params = useParams<{ id: string }>();
  const pageId = Number(params.id);

  const [page, setPage] = useState<PageDetail | null>(null);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const data = await api.get<PageDetail>(`/api/cms/pages/${pageId}`);
    setPage(data);
    setEdits(
      Object.fromEntries(
        data.slots.map((s) => [
          s.id,
          { value: s.live_value, alt: s.alt_text ?? "", mediaId: s.media_id },
        ]),
      ),
    );
  }, [pageId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load this page");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const changed = useMemo(() => {
    if (!page) return [];
    return page.slots.filter((s) => {
      const e = edits[s.id];
      return e && (e.value !== s.live_value || e.alt !== (s.alt_text ?? ""));
    });
  }, [page, edits]);

  // warn before leaving with unsaved edits — nothing is stored until Save
  useEffect(() => {
    if (changed.length === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [changed.length]);

  const groups = useMemo(() => {
    if (!page) return [];
    const q = filter.trim().toLowerCase();
    const slots = q
      ? page.slots.filter(
          (s) =>
            s.label.toLowerCase().includes(q) ||
            (edits[s.id]?.value ?? "").toLowerCase().includes(q),
        )
      : page.slots;

    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = slot.group ?? "Content";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    }
    return [...map.entries()];
  }, [page, filter, edits]);

  const setEdit = (id: number, patch: Partial<Edit>) =>
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  async function save() {
    if (!page || changed.length === 0) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    setWarning(null);
    try {
      const res = await api.put<SaveResult>(`/api/cms/pages/${page.id}/slots`, {
        slots: changed.map((s) => ({
          id: s.id,
          value: edits[s.id].value,
          alt_text: edits[s.id].alt || null,
          media_id: edits[s.id].mediaId,
        })),
      });
      await load();

      const n = `${res.saved_slots} change${res.saved_slots === 1 ? "" : "s"}`;
      if (res.revalidated) {
        setNotice(`Saved ${n} — the website is updated.`);
      } else {
        setWarning(
          `Saved ${n}, but the website could not be refreshed (${res.revalidate_detail ?? "unknown reason"}). It will pick the change up within the hour.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function retryRefresh() {
    if (!page) return;
    setWarning(null);
    try {
      const res = await api.post<SaveResult>(`/api/cms/pages/${page.id}/refresh`);
      if (res.revalidated) setNotice("The website has been refreshed.");
      else
        setWarning(
          `Still could not reach the website (${res.revalidate_detail ?? "unknown reason"}).`,
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh");
    }
  }

  if (error && !page) {
    return (
      <div className="content">
        <div className="notice notice-error">{error}</div>
        <Link className="btn" href="/pages">
          ← Back
        </Link>
      </div>
    );
  }
  if (!page) return <div className="empty">Loading page…</div>;

  return (
    <>
      <div className="topbar">
        <div style={{ minWidth: 0 }}>
          <h1>{page.title}</h1>
          <div className="route">{page.route}</div>
        </div>
        <div className="spacer" />
        {changed.length > 0 ? (
          <span className="badge badge-draft">
            {changed.length} unsaved change{changed.length === 1 ? "" : "s"}
          </span>
        ) : null}
        {page.route !== "/_global" ? (
          <a
            className="btn btn-sm"
            href={SITE_BASE + page.route}
            target="_blank"
            rel="noreferrer"
          >
            View live ↗
          </a>
        ) : null}
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          disabled={saving || changed.length === 0}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="content">
        {error ? <div className="notice notice-error">{error}</div> : null}
        {notice ? <div className="notice notice-ok">{notice}</div> : null}
        {warning ? (
          <div className="notice notice-warn">
            {warning}{" "}
            <button type="button" className="btn btn-sm" onClick={retryRefresh}>
              Try again
            </button>
          </div>
        ) : null}

        <div className="toolbar">
          <input
            type="search"
            placeholder="Find a field by its text…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: 320 }}
          />
          <span className="muted small">
            {page.slots.length} editable fields
            {filter ? ` · ${groups.reduce((n, [, s]) => n + s.length, 0)} shown` : ""}
          </span>
        </div>

        {groups.map(([group, slots]) => (
          <section className="slot-group" key={group}>
            <h3>{group}</h3>
            {slots.map((slot) => {
              const e = edits[slot.id];
              if (!e) return null;
              return (
                <SlotEditor
                  key={slot.id}
                  slot={slot}
                  value={e.value}
                  altText={e.alt}
                  onChange={(value) => setEdit(slot.id, { value })}
                  onAltChange={(alt) => setEdit(slot.id, { alt })}
                  onPickMedia={(media: Media) =>
                    setEdit(slot.id, {
                      value: media.url,
                      mediaId: media.id,
                      alt: e.alt || media.alt_text || "",
                    })
                  }
                  onReset={() =>
                    setEdit(slot.id, { value: slot.default_value, mediaId: null })
                  }
                />
              );
            })}
          </section>
        ))}

        {groups.length === 0 ? (
          <div className="empty">No fields match “{filter}”.</div>
        ) : null}
      </div>
    </>
  );
}
