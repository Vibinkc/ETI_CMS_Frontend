"use client";

import { useEffect, useRef, useState } from "react";

import { api, mediaUrl, type Media } from "@/lib/api";

function prettySize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Modal: pick from the library or upload a new file. */
export default function MediaPicker({
  kind,
  onPick,
  onClose,
}: {
  kind: "image" | "video";
  onPick: (media: Media) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Media[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Media | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    api
      .get<Media[]>("/api/media")
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load media"));

  useEffect(() => {
    load();
  }, []);

  // A dialog has to be dismissable from the keyboard, not only by clicking
  // outside it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const media = await api.uploadMedia(file);
      await load();
      setSelected(media);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const wanted = (m: Media) =>
    kind === "video" ? m.content_type.startsWith("video/") : m.content_type.startsWith("image/");

  const visible = items?.filter(wanted) ?? [];

  return (
    <div
      className="overlay"
      role="presentation"
      onClick={(e) => {
        // only the backdrop itself dismisses; a click inside the dialog must
        // not, which is what the old stopPropagation handler was for
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Choose media">
        <div className="dialog-head">
          <h2 style={{ margin: 0, fontSize: 16 }}>
            Choose {kind === "video" ? "a video" : "an image"}
          </h2>
          <div className="spacer" />
          <input
            ref={fileRef}
            type="file"
            accept={kind === "video" ? "video/*" : "image/*"}
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Uploading…" : "Upload new"}
          </button>
        </div>

        <div className="dialog-body">
          {error ? <div className="notice notice-error">{error}</div> : null}
          {!items ? <div className="empty">Loading library…</div> : null}

          {items && visible.length === 0 ? (
            <div className="empty">
              Nothing in the library yet — upload a file to get started.
            </div>
          ) : null}

          <div className="media-grid">
            {visible.map((m) => (
              <button
                type="button"
                key={m.id}
                className={`media-tile${selected?.id === m.id ? " selected" : ""}`}
                onClick={() => setSelected(m)}
                onDoubleClick={() => onPick(m)}
              >
                {m.content_type.startsWith("video/") ? (
                  <video src={mediaUrl(m.url)} muted preload="metadata" />
                ) : (
                  <img src={mediaUrl(m.url)} alt={m.alt_text ?? m.filename} />
                )}
                <div className="fn" title={m.filename}>
                  {m.filename}
                </div>
                <div className="fn">{prettySize(m.byte_size)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="dialog-foot">
          <span className="muted small">
            {selected ? selected.filename : "Select a file"}
          </span>
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => selected && onPick(selected)}
          >
            Use this file
          </button>
        </div>
      </div>
    </div>
  );
}
