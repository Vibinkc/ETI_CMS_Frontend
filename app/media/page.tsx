"use client";

import { useEffect, useRef, useState } from "react";

import { api, mediaUrl, type Media } from "@/lib/api";

function prettySize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibrary() {
  const [items, setItems] = useState<Media[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    api
      .get<Media[]>("/api/media")
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load media"));

  useEffect(() => {
    load();
  }, []);

  async function upload(files: FileList) {
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await api.uploadMedia(file);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(media: Media) {
    if (!confirm(`Delete “${media.filename}” permanently?`)) return;
    try {
      await api.del(`/api/media/${media.id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  const visible =
    items?.filter((m) =>
      query ? m.filename.toLowerCase().includes(query.toLowerCase()) : true,
    ) ?? [];

  const totalBytes = items?.reduce((n, m) => n + m.byte_size, 0) ?? 0;

  return (
    <>
      <div className="topbar">
        <h1>Media library</h1>
        {items ? (
          <span className="muted small">
            {items.length} files · {prettySize(totalBytes)}
          </span>
        ) : null}
        <div className="spacer" />
        <input
          type="search"
          placeholder="Filter by filename…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 260 }}
        />
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.length) upload(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Uploading…" : "Upload files"}
        </button>
      </div>

      <div className="content">
        {error ? <div className="notice notice-error">{error}</div> : null}
        {!items && !error ? <div className="empty">Loading library…</div> : null}
        {items && visible.length === 0 ? (
          <div className="empty">
            {query ? `No files match “${query}”.` : "No files uploaded yet."}
          </div>
        ) : null}

        <div className="media-grid">
          {visible.map((m) => (
            <div className="media-tile" key={m.id} style={{ cursor: "default" }}>
              {m.content_type.startsWith("video/") ? (
                <video src={mediaUrl(m.url)} controls muted preload="metadata" />
              ) : (
                <img src={mediaUrl(m.url)} alt={m.alt_text ?? m.filename} />
              )}
              <div className="fn" title={m.filename}>
                {m.filename}
              </div>
              <div className="fn">
                {prettySize(m.byte_size)}
                {m.width ? ` · ${m.width}×${m.height}` : ""}
              </div>
              <button
                type="button"
                className="btn btn-sm"
                style={{ marginTop: 6 }}
                aria-label={`Delete ${m.filename}`}
                onClick={() => remove(m)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
