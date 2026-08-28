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

  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    load();
  }, []);

  // showModal() is what makes <dialog> a modal: it puts the dialog in the top
  // layer, traps focus, and handles Escape itself. Rendering the element alone
  // would leave it inert and invisible.
  //
  // The backdrop click is bound here rather than as an onClick prop. The
  // backdrop is a pseudo-element, so there is no node to put a handler on —
  // a click on it reports the dialog as the target. A handler on the dialog
  // itself would be a mouse-only affordance on a non-interactive element;
  // bound this way it stays what it is, a shortcut on top of the keyboard
  // route (Escape) and the Cancel button, both of which work without it.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (!el.open) el.showModal();

    const dismissOnBackdrop = (e: MouseEvent) => {
      if (e.target === el) el.close();
    };
    el.addEventListener("click", dismissOnBackdrop);
    return () => el.removeEventListener("click", dismissOnBackdrop);
  }, []);

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
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-label="Choose media"
      // fires for Escape, for close(), and so for the backdrop click too
      onClose={onClose}
    >
      <div className="dialog-inner">
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
    </dialog>
  );
}
