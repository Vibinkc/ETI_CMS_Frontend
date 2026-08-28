"use client";

/**
 * Page navigation for the long tables.
 *
 * Shows the first and last page, the current page with a neighbour either
 * side, and an ellipsis where numbers are skipped — so the control stays the
 * same width whether there are 3 pages or 300.
 */

function pageNumbers(current: number, last: number): (number | "gap")[] {
  if (last <= 7) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }

  const out: (number | "gap")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(last - 1, current + 1);

  if (from > 2) out.push("gap");
  for (let n = from; n <= to; n++) out.push(n);
  if (to < last - 1) out.push("gap");

  out.push(last);
  return out;
}

export default function Pagination({
  page,
  pageSize,
  total,
  onChange,
  label = "results",
}: {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  /** What is being counted, for the summary line. */
  label?: string;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const upto = Math.min(page * pageSize, total);

  // Nothing to navigate, but the count is still worth showing.
  if (last <= 1) {
    return total > 0 ? (
      <p className="pager-summary muted small">
        {total} {label}
      </p>
    ) : null;
  }

  return (
    <div className="pager-wrap">
      <p className="pager-summary muted small">
        {first}–{upto} of {total} {label}
      </p>

      <nav className="pager" aria-label="Pagination">
        <button
          type="button"
          className="pager-step"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
        >
          <span aria-hidden="true">‹</span> Back
        </button>

        {pageNumbers(page, last).map((n, i) =>
          n === "gap" ? (
            <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={`pager-num${n === page ? " on" : ""}`}
              aria-label={`Page ${n}`}
              aria-current={n === page ? "page" : undefined}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          ),
        )}

        <button
          type="button"
          className="pager-step"
          onClick={() => onChange(page + 1)}
          disabled={page === last}
        >
          Next <span aria-hidden="true">›</span>
        </button>
      </nav>
    </div>
  );
}
