"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Bold,
  Code,
  Highlighter,
  Italic,
  Link as LinkIcon,
  Unlink,
} from "@/components/icons";
import { getSitePages, linkablePages, shortPageTitle } from "@/lib/pages";
import type { Page } from "@/lib/api";

const VOID_TAGS = new Set(["br", "hr", "img", "input", "source"]);

type Shell = { open: string; close: string; tag: string; href: string | null; label: string };

/**
 * If the whole value is one wrapper element — a button link, a `<span>` — pull
 * it out so it is never inside the editable area.
 *
 * Deleting all the text of a `contenteditable` takes the wrapper with it: the
 * browser removes the now-empty `<a>`, and typing again leaves bare text, so a
 * button silently becomes a plain sentence. Editing only the inside makes that
 * impossible.
 */
function splitShell(html: string): { shell: Shell; inner: string } | null {
  if (typeof window === "undefined") return null;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const nodes = [...doc.body.childNodes];
  const elements = nodes.filter((n): n is HTMLElement => n.nodeType === Node.ELEMENT_NODE);
  const hasLooseText = nodes.some(
    (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim(),
  );

  if (elements.length !== 1 || hasLooseText) return null;

  const el = elements[0];
  const tag = el.tagName.toLowerCase();
  if (VOID_TAGS.has(tag)) return null;
  if (!(el.textContent ?? "").trim()) return null; // nothing inside to edit

  const bare = el.cloneNode(false) as HTMLElement;
  const outer = bare.outerHTML;
  const close = `</${tag}>`;
  if (!outer.endsWith(close)) return null;

  const isButton = (el.getAttribute("class") ?? "").includes("uk-button");
  return {
    shell: {
      open: outer.slice(0, outer.length - close.length),
      close,
      tag,
      href: el.getAttribute("href"),
      label: tag === "a" ? (isButton ? "Button" : "Link") : tag,
    },
    inner: el.innerHTML,
  };
}

function withHref(shell: Shell, href: string): Shell {
  const doc = new DOMParser().parseFromString(`${shell.open}${shell.close}`, "text/html");
  const el = doc.body.firstElementChild as HTMLElement | null;
  if (!el) return shell;
  el.setAttribute("href", href);
  const outer = el.outerHTML;
  return { ...shell, href, open: outer.slice(0, outer.length - shell.close.length) };
}

/**
 * Visual editor for formatted fields.
 *
 * These values came out of the site's own page builder and carry markup an
 * editor should never have to see or retype — links with titles, UIkit button
 * classes, `<br>` inside an address. Typing happens in place, so replacing the
 * words leaves the surrounding tags and their classes untouched.
 */
export default function RichTextEditor({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  /** What a screen reader calls this editor. Without it the surface is an
   *  ARIA textbox with no accessible name, which axe reports as serious. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtml = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);
  const shellRef = useRef<Shell | null>(null);

  const [shell, setShell] = useState<Shell | null>(null);
  const [showHtml, setShowHtml] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [sitePages, setSitePages] = useState<Page[]>([]);

  // the page list only matters once the link bar is open
  useEffect(() => {
    if (!linkOpen || sitePages.length) return;
    let cancelled = false;
    getSitePages()
      .then((pages) => {
        if (!cancelled) setSitePages(linkablePages(pages));
      })
      .catch(() => {
        /* typing an address by hand still works */
      });
    return () => {
      cancelled = true;
    };
  }, [linkOpen, sitePages.length]);

  // Sync from props only when the value changed somewhere else — writing on
  // every render would drop the caret to the start on each keystroke.
  useEffect(() => {
    if (showHtml) return;
    const el = ref.current;
    if (!el || value === lastHtml.current) return;

    const split = splitShell(value);
    shellRef.current = split?.shell ?? null;
    setShell(split?.shell ?? null);
    el.innerHTML = split ? split.inner : value;
    lastHtml.current = value;
  }, [value, showHtml]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const s = shellRef.current;
    const html = s ? s.open + el.innerHTML + s.close : el.innerHTML;
    lastHtml.current = html;
    onChange(html);
  }, [onChange]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const openLink = () => {
    const sel = window.getSelection();
    const inside = sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode);
    const selected = inside ? sel.toString() : "";

    // With a wrapper link there is nothing to select — edit its URL directly.
    if (!selected && shellRef.current?.tag === "a") {
      setLinkUrl(shellRef.current.href ?? "");
      setLinkOpen(true);
      return;
    }
    if (!selected) {
      alert("Select the words you want to turn into a link first.");
      return;
    }

    savedRange.current = sel!.getRangeAt(0).cloneRange();
    const node = sel!.anchorNode;
    const anchor = (node instanceof Element ? node : node?.parentElement)?.closest("a");
    setLinkUrl(anchor?.getAttribute("href") ?? "");
    setLinkOpen(true);
  };

  const applyLink = (explicit?: string) => {
    const url = (explicit ?? linkUrl).trim();
    setLinkOpen(false);
    if (!url) return;

    // editing the wrapper's own URL
    if (!savedRange.current && shellRef.current) {
      const next = withHref(shellRef.current, url);
      shellRef.current = next;
      setShell(next);
      emit();
      return;
    }

    ref.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current) {
      sel?.removeAllRanges();
      sel?.addRange(savedRange.current);
      savedRange.current = null;
    }
    document.execCommand("createLink", false, url);
    emit();
  };

  /**
   * Wrap the selected words in `<mark>`, or unwrap when they already are.
   *
   * `execCommand("hiliteColor")` would emit a `<span style="background:…">`,
   * which the site's stylesheet knows nothing about — the theme styles `mark`
   * itself. Doing it by hand keeps the markup the same as the rest of the site
   * and confines the highlight to exactly what was selected.
   */
  const toggleHighlight = () => {
    const surface = ref.current;
    const sel = window.getSelection();
    if (!surface || !sel || sel.rangeCount === 0) return;
    if (!surface.contains(sel.anchorNode)) return;

    const anchor = sel.anchorNode;
    const parent = anchor instanceof Element ? anchor : anchor?.parentElement;
    const existing = parent?.closest("mark");

    if (existing && surface.contains(existing)) {
      const host = existing.parentNode;
      if (host) {
        while (existing.firstChild) host.insertBefore(existing.firstChild, existing);
        host.removeChild(existing);
        host.normalize();
      }
      emit();
      return;
    }

    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      alert("Select the words you want to highlight first.");
      return;
    }

    const mark = document.createElement("mark");
    try {
      range.surroundContents(mark);
    } catch {
      // the selection straddles element boundaries
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    }

    // keep the newly marked words selected so a second click removes it
    const after = document.createRange();
    after.selectNodeContents(mark);
    sel.removeAllRanges();
    sel.addRange(after);
    emit();
  };

  const linkQuery = linkUrl.trim().toLowerCase();
  const matchingPages = sitePages
    .filter(
      (p) =>
        !linkQuery ||
        p.route.toLowerCase().includes(linkQuery) ||
        shortPageTitle(p).toLowerCase().includes(linkQuery),
    )
    .slice(0, 8);

  /** Paste as plain text — pasted Word/web markup would fight the site's own. */
  const onPaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emit();
  };

  return (
    <div className="rte">
      <div className="rte-toolbar">
        <button type="button" onClick={() => exec("bold")} title="Bold (Ctrl+B)" aria-label="Bold">
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => exec("italic")}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={toggleHighlight}
          title="Highlight the selected words"
          aria-label="Highlight"
        >
          <Highlighter size={15} />
        </button>
        <span className="rte-sep" />
        <button
          type="button"
          onClick={openLink}
          title={shell?.tag === "a" ? "Change where this goes" : "Add or edit a link"}
          aria-label="Link"
        >
          <LinkIcon size={15} />
        </button>
        <button
          type="button"
          onClick={() => exec("unlink")}
          title="Remove a link from the selected words"
          aria-label="Remove link"
        >
          <Unlink size={15} />
        </button>
        <span className="spacer" />
        <button
          type="button"
          className={showHtml ? "on" : ""}
          onClick={() => {
            // force a re-parse when coming back from the HTML view
            if (showHtml) lastHtml.current = null;
            setShowHtml((v) => !v);
          }}
          title="Show the underlying HTML"
          aria-pressed={showHtml}
        >
          <Code size={15} />
          HTML
        </button>
      </div>

      {linkOpen ? (
        <div className="rte-linkpicker">
          <div className="rte-linkbar">
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Search a page, or paste a web address"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
                if (e.key === "Escape") setLinkOpen(false);
              }}
            />
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => applyLink()}
            >
              Apply
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setLinkOpen(false)}>
              Cancel
            </button>
          </div>

          <div className="rte-suggestions">
            {matchingPages.length > 0 ? (
              <>
                <div className="rte-suggest-head">Pages on this site</div>
                {matchingPages.map((page) => (
                  <button
                    type="button"
                    key={page.id}
                    className="rte-suggest"
                    onClick={() => applyLink(page.route)}
                  >
                    <span className="rte-suggest-title">{shortPageTitle(page)}</span>
                    <span className="mono muted">{page.route}</span>
                  </button>
                ))}
              </>
            ) : (
              <div className="rte-suggest-head">
                {sitePages.length === 0
                  ? "Loading pages…"
                  : "No page matches — that will be used as a web address."}
              </div>
            )}

            <div className="rte-suggest-head">Other</div>
            <button
              type="button"
              className="rte-suggest"
              onClick={() => setLinkUrl("mailto:info@sdett.org")}
            >
              <span className="rte-suggest-title">Email address</span>
              <span className="mono muted">mailto:…</span>
            </button>
            <button
              type="button"
              className="rte-suggest"
              onClick={() => setLinkUrl("tel:8585696633")}
            >
              <span className="rte-suggest-title">Phone number</span>
              <span className="mono muted">tel:…</span>
            </button>
          </div>
        </div>
      ) : null}

      {showHtml ? (
        <textarea
          className="code rte-html"
          rows={Math.min(12, Math.max(4, Math.ceil(value.length / 80)))}
          value={value}
          spellCheck={false}
          onChange={(e) => {
            lastHtml.current = e.target.value;
            onChange(e.target.value);
          }}
        />
      ) : (
        <>
          {shell ? (
            <div className="rte-shell">
              <span className="badge badge-kind">{shell.label}</span>
              {shell.tag === "a" ? (
                <>
                  <span className="muted small">goes to</span>
                  <code className="mono">{shell.href || "—"}</code>
                </>
              ) : (
                <span className="muted small">styling is kept, edit the words below</span>
              )}
            </div>
          ) : null}
          <div
            ref={ref}
            className={`rte-surface${shell ? " rte-surface-inner" : ""}`}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label={label}
            aria-multiline="true"
            onInput={emit}
            onBlur={emit}
            onPaste={onPaste}
          />
        </>
      )}
    </div>
  );
}
