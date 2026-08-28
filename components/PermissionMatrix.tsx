"use client";

import { useMemo, useState } from "react";

import type { PermissionMatrixData } from "@/lib/api";

/**
 * The object × action grid.
 *
 * Rows are the things in the CMS — every page individually, then the media
 * library, contact forms and the administration screens. Columns are actions.
 * A cell that means nothing for its row (a page cannot be "uploaded") is left
 * blank rather than shown as an unchecked box, so the grid reads as what is
 * possible, not just what is off.
 *
 * `inherited` marks permissions that come from somewhere else — a role, when
 * editing one person's extras, or the "All pages" row. Those show ticked and
 * locked, so it is clear where each came from.
 */
export default function PermissionMatrix({
  data,
  selected,
  inherited,
  readOnly,
  onToggle,
}: {
  data: PermissionMatrixData;
  selected: Set<string>;
  /** granted elsewhere: shown ticked, not editable here */
  inherited?: Set<string>;
  readOnly?: boolean;
  onToggle: (permission: string, on: boolean) => void;
}) {
  const [filter, setFilter] = useState("");
  const inheritedSet = inherited ?? new Set<string>();

  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return data.groups;
    return data.groups
      .map((g) => ({
        ...g,
        objects: g.objects.filter(
          (o) =>
            o.label.toLowerCase().includes(needle) ||
            o.hint.toLowerCase().includes(needle),
        ),
      }))
      .filter((g) => g.objects.length > 0);
  }, [data.groups, filter]);

  const permission = (objectKey: string, action: string) => `${objectKey}:${action}`;

  /** Tick or clear a whole column within one group. */
  const setColumn = (groupIndex: number, action: string, on: boolean) => {
    for (const obj of groups[groupIndex].objects) {
      if (!obj.actions.includes(action)) continue;
      const key = permission(obj.key, action);
      if (inheritedSet.has(key)) continue;
      onToggle(key, on);
    }
  };

  /** Tick or clear every applicable action for one row. */
  const setRow = (objectKey: string, actions: string[], on: boolean) => {
    for (const action of actions) {
      const key = permission(objectKey, action);
      if (inheritedSet.has(key)) continue;
      onToggle(key, on);
    }
  };

  return (
    <div className="matrix">
      <div className="matrix-tools">
        <input
          type="search"
          className="sub-search"
          placeholder="Find a page or section"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter the permission list"
        />
        <span className="muted small">
          {groups.reduce((n, g) => n + g.objects.length, 0)} row(s)
        </span>
      </div>

      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th scope="col" className="matrix-object">Object</th>
              {data.actions.map((a) => (
                <th key={a.key} scope="col" title={a.hint}>
                  <span className="matrix-action">{a.label}</span>
                </th>
              ))}
              <th scope="col" className="matrix-all">All</th>
            </tr>
          </thead>

          {groups.map((group, gi) => (
            <tbody key={group.group}>
              <tr className="matrix-group">
                <th scope="colgroup" colSpan={1}>{group.group}</th>
                {data.actions.map((a) => {
                  const applies = group.objects.some((o) => o.actions.includes(a.key));
                  return (
                    <td key={a.key}>
                      {applies && !readOnly && (
                        <button
                          type="button"
                          className="matrix-bulk"
                          title={`Give every ${group.group.toLowerCase()} row “${a.label}”`}
                          onClick={() => setColumn(gi, a.key, true)}
                        >
                          all
                        </button>
                      )}
                    </td>
                  );
                })}
                <td />
              </tr>

              {group.objects.map((obj) => {
                const mine = obj.actions.filter((a) =>
                  selected.has(permission(obj.key, a)) ||
                  inheritedSet.has(permission(obj.key, a)));
                const everything = mine.length === obj.actions.length;
                return (
                  <tr key={obj.key} className={obj.is_wildcard ? "matrix-wildcard" : undefined}>
                    <th scope="row" className="matrix-object">
                      <span className="matrix-label">{obj.label}</span>
                      {obj.hint && <span className="matrix-hint">{obj.hint}</span>}
                    </th>

                    {data.actions.map((a) => {
                      if (!obj.actions.includes(a.key)) {
                        // Not a thing you can do to this object. The cell stays
                        // in the table so the row keeps its column count —
                        // aria-hidden here would leave a screen reader counting
                        // fewer cells than there are columns.
                        return <td key={a.key} className="matrix-na" />;
                      }
                      const key = permission(obj.key, a.key);
                      const viaOther = inheritedSet.has(key);
                      const on = viaOther || selected.has(key);
                      return (
                        <td key={a.key}>
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={readOnly || viaOther}
                            aria-label={`${a.label} — ${obj.label}`}
                            title={viaOther ? "Granted by the role" : `${a.label} ${obj.label}`}
                            onChange={(e) => onToggle(key, e.target.checked)}
                          />
                        </td>
                      );
                    })}

                    <td className="matrix-all">
                      {!readOnly && (
                        <button
                          type="button"
                          className="matrix-bulk"
                          onClick={() => setRow(obj.key, obj.actions, !everything)}
                        >
                          {everything ? "none" : "all"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
