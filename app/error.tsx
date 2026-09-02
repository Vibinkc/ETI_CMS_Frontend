"use client";

/**
 * The boundary the console had none of.
 *
 * A malformed API response used to take the whole app down: one page detail
 * arriving without its `slots` array threw during render, and with no
 * error.tsx anywhere React had nothing to catch it. The screen went blank --
 * sidebar included, so there was no navigation left to escape with.
 *
 * This keeps the failure inside the content area. The shell around it still
 * renders, so the rest of the CMS stays reachable.
 */

import { useEffect } from "react";

import { AlertCircle } from "@/components/icons";

// Named rather than called Error: Next only cares that this file default-exports
// a component, and shadowing the global Error inside a file whose parameter is
// typed `Error` is asking to be misread.
export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // the digest is the only handle on the server-side stack
    console.error("CMS screen failed to render:", error);
  }, [error]);

  return (
    <>
      <div className="topbar">
        <h1>Something went wrong</h1>
      </div>
      <div className="content">
        <div className="notice notice-error" role="alert">
          <AlertCircle size={18} />
          <div>
            <p style={{ margin: "0 0 6px" }}>
              This screen could not be displayed. Nothing you have saved is
              affected, and the rest of the CMS still works.
            </p>
            <p className="small muted" style={{ margin: 0 }}>
              {error.message || "An unexpected error occurred."}
              {error.digest ? ` (reference ${error.digest})` : null}
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </>
  );
}
