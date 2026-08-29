"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { Crown, Trash } from "@/components/icons";
import PermissionMatrix from "@/components/PermissionMatrix";
import { api, type PermissionMatrixData, type Role } from "@/lib/api";

export default function Roles() {
  const { can } = useAuth();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [matrix, setMatrix] = useState<PermissionMatrixData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftPerms, setDraftPerms] = useState<string[]>([]);

  const mayManage = can("roles:manage");

  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([
        api.get<Role[]>("/api/cms/roles"),
        api.get<PermissionMatrixData>("/api/cms/permissions"),
      ]);
      setRoles(r);
      setMatrix(c);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load roles");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await api.patch(`/api/cms/roles/${editing.id}`, {
        description: editing.description,
        permissions: editing.is_owner ? undefined : editing.permissions,
        name: editing.is_system ? undefined : editing.name,
      });
      setNotice(`Saved “${editing.name}”.`);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the role");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    try {
      await api.post("/api/cms/roles", {
        name: draftName, description: draftDesc, permissions: draftPerms,
      });
      setNotice(`Created “${draftName}”.`);
      setCreating(false);
      setDraftName(""); setDraftDesc(""); setDraftPerms([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the role");
    } finally {
      setBusy(false);
    }
  }

  async function remove(role: Role) {
    if (!confirm(`Delete the role “${role.name}”?`)) return;
    setBusy(true);
    try {
      await api.del(`/api/cms/roles/${role.id}`);
      setNotice(`Deleted “${role.name}”.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the role");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <>
        <div className="topbar">
          <h1>{editing.name}</h1>
          {editing.is_system && <span className="badge badge-new">built in</span>}
          <div className="spacer" />
          <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit} disabled={busy}>
            Save role
          </button>
        </div>
        <div className="content">
          {error && <div className="notice notice-error">{error}</div>}
          <div className="form-grid">
            <label>
              <span>Name</span>
              <input value={editing.name} disabled={editing.is_system}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label>
              <span>Description</span>
              <input value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </label>
          </div>

          <h2 className="uk-h5">What this role allows</h2>
          {editing.is_owner && (
            <div className="notice notice-warn">
              The Administrator role always has every permission, including any
              added in a later version. That is not editable by design — it is
              what stops the CMS locking its own owner out.
            </div>
          )}
          {matrix && (
            <PermissionMatrix
              data={matrix}
              selected={new Set(editing.permissions)}
              readOnly={editing.is_owner}
              onToggle={(k, on) => setEditing({
                ...editing,
                permissions: on
                  ? [...editing.permissions, k]
                  : editing.permissions.filter((p) => p !== k),
              })}
            />
          )}
        </div>
      </>
    );
  }

  if (creating) {
    return (
      <>
        <div className="topbar">
          <h1>New role</h1>
          <div className="spacer" />
          <button type="button" className="btn btn-sm" onClick={() => setCreating(false)}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={create}
            disabled={busy || draftName.trim().length < 2}>
            Create role
          </button>
        </div>
        <div className="content">
          {error && <div className="notice notice-error">{error}</div>}
          <div className="form-grid">
            <label>
              <span>Name *</span>
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            </label>
            <label>
              <span>Description</span>
              <input value={draftDesc} placeholder="what this role is for"
                onChange={(e) => setDraftDesc(e.target.value)} />
            </label>
          </div>
          <h2 className="uk-h5">What this role allows</h2>
          {matrix && (
            <PermissionMatrix
              data={matrix}
              selected={new Set(draftPerms)}
              onToggle={(k, on) =>
                setDraftPerms((p) => (on ? [...new Set([...p, k])] : p.filter((x) => x !== k)))
              }
            />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <h1>Roles</h1>
        {roles && (
          <span className="route">
            {roles.length} {roles.length === 1 ? "role" : "roles"}
          </span>
        )}
        <div className="spacer" />
        {mayManage && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            New role
          </button>
        )}
      </div>
      <div className="content">
        {error && <div className="notice notice-error">{error}</div>}
        {notice && <div className="notice notice-ok">{notice}</div>}

        {!roles ? <div className="empty">Loading…</div> : (
          <div className="sub-table-wrap">
            <table className="sub-table">
              <thead>
                <tr>
                  <th>Role</th><th>Description</th>
                  <th>Permissions</th><th>Accounts</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr
                    key={role.id}
                    onClick={mayManage ? () => setEditing(role) : undefined}
                    tabIndex={mayManage ? 0 : undefined}
                    onKeyDown={(e) => { if (mayManage && e.key === "Enter") setEditing(role); }}
                  >
                    <td>
                      <strong>{role.name}</strong>
                      {role.is_owner && (
                        <Crown size={14} className="owner-crown" aria-label="Every permission" />
                      )}
                      {role.is_system && !role.is_owner && (
                        <span className="badge badge-live"> built in</span>
                      )}
                    </td>
                    <td className="muted">{role.description}</td>
                    <td className="small">
                      {role.is_owner
                        ? "Everything, including capabilities added later."
                        : role.permissions.length
                          ? `${role.permissions.length} permission(s)`
                          : <span className="muted">None — can sign in but do nothing</span>}
                    </td>
                    <td className="muted small">{role.user_count}</td>
                    <td>
                      {/* the row opens the editor, so this must not reach it */}
                      {mayManage && !role.is_system && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          title={`Delete ${role.name}`}
                          aria-label={`Delete ${role.name}`}
                          onClick={(e) => { e.stopPropagation(); remove(role); }}
                          disabled={busy}
                        >
                          <Trash size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
