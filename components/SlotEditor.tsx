"use client";

import { useState } from "react";

import MediaPicker from "@/components/MediaPicker";
import RichTextEditor from "@/components/RichTextEditor";
import { Upload } from "@/components/icons";
import { mediaUrl, type Media, type Slot } from "@/lib/api";

/** Human-readable name for whatever a media slot currently points at. */
function fileLabel(url: string) {
  if (!url) return "No file chosen";
  const last = url.split("?")[0].split("/").filter(Boolean).pop() ?? url;
  return /^\d+$/.test(last) ? "Uploaded file" : decodeURIComponent(last);
}

/** The handful of entities the site's markup actually contains. */
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&nbsp;": " ",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

/**
 * Replace every `<...>` with a space.
 *
 * A single forward scan rather than a pattern: it does exactly what
 * `/<[^>]*>/g` did, without a regular expression for the analyser to worry
 * about. An unterminated `<` is left in place, as it was before.
 */
function stripTags(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf("<", i);
    if (open === -1) return out + html.slice(i);
    const close = html.indexOf(">", open + 1);
    if (close === -1) return out + html.slice(i);
    out += html.slice(i, open) + " ";
    i = close + 1;
  }
  return out;
}

/**
 * The name shown on a field's header.
 *
 * It follows what is currently in the editor rather than the value the page
 * shipped with — otherwise a field renamed by an editor keeps announcing its
 * old wording while the box beneath it says something else.
 */
function headerLabel(slot: Slot, value: string, altText: string): string {
  if (slot.kind === "image" || slot.kind === "video") {
    return altText.trim() || fileLabel(value);
  }

  const stripped =
    slot.kind === "richtext" ? stripTags(value) : value;
  const text = stripped
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return slot.label || slot.key;
  return text.length > 70 ? text.slice(0, 69) + "…" : text;
}

const KIND_LABEL: Record<string, string> = {
  text: "Text",
  richtext: "Formatted text",
  image: "Image",
  video: "Video",
  link: "Link",
};

/**
 * One editable field. The control follows the slot's kind: a line of text, a
 * formatted block edited visually, or a media chooser.
 */
export default function SlotEditor({
  slot,
  value,
  altText,
  onChange,
  onAltChange,
  onPickMedia,
  onReset,
}: {
  slot: Slot;
  value: string;
  altText: string;
  onChange: (next: string) => void;
  onAltChange: (next: string) => void;
  onPickMedia: (media: Media) => void;
  onReset: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [showPath, setShowPath] = useState(false);
  const changed = value !== slot.live_value || altText !== (slot.alt_text ?? "");
  const isMedia = slot.kind === "image" || slot.kind === "video";

  return (
    <div className={`slot${changed ? " dirty" : ""}`}>
      <div className="slot-head">
        <span className="badge badge-kind">{KIND_LABEL[slot.kind] ?? slot.kind}</span>
        <strong className="small">{headerLabel(slot, value, altText)}</strong>
        <div className="spacer" />
        {changed ? <span className="badge badge-draft">unsaved</span> : null}
        <button
          type="button"
          className="btn btn-sm"
          onClick={onReset}
          disabled={value === slot.default_value && altText === (slot.alt_text ?? "")}
          title="Restore the text this page originally shipped with"
        >
          Reset
        </button>
      </div>

      {isMedia ? (
        <div className="media-slot">
          <div className="media-preview">
            {slot.kind === "video" ? (
              <video src={mediaUrl(value)} controls muted preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(value)} alt={altText || slot.label} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="media-current">
              <span className="media-filename" title={value}>
                {fileLabel(value)}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setPicking(true)}
              >
                <Upload size={15} />
                Change {slot.kind}
              </button>
            </div>

            {slot.kind === "image" ? (
              <label className="field" style={{ marginTop: 12 }}>
                <span>Description for screen readers</span>
                <input
                  type="text"
                  value={altText}
                  onChange={(e) => onAltChange(e.target.value)}
                  placeholder="What does this picture show?"
                />
              </label>
            ) : null}

            <button
              type="button"
              className="linkish small"
              onClick={() => setShowPath((v) => !v)}
            >
              {showPath ? "Hide file address" : "Use a file address instead"}
            </button>
            {showPath ? (
              <input
                type="text"
                className="mono"
                style={{ marginTop: 6 }}
                value={value}
                onChange={(e) => onChange(e.target.value)}
              />
            ) : null}
          </div>
        </div>
      ) : slot.kind === "richtext" ? (
        <RichTextEditor value={value} onChange={onChange} />
      ) : value.length > 90 ? (
        <textarea
          rows={Math.min(8, Math.max(2, Math.ceil(value.length / 90)))}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      )}

      {picking ? (
        <MediaPicker
          kind={slot.kind === "video" ? "video" : "image"}
          onClose={() => setPicking(false)}
          onPick={(media) => {
            onPickMedia(media);
            setPicking(false);
          }}
        />
      ) : null}
    </div>
  );
}
