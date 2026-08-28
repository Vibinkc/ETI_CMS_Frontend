"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { Trash, UserPlus } from "@/components/icons";
import PermissionMatrix from "@/components/PermissionMatrix";
import { api, type Account, type PermissionMatrixData, type Role } from "@/lib/api";

function when(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type Draft = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role_id: number | null;
  extra_permissions: string[];
};

const EMPTY: Draft = {
  username: "", email: "", first_name: "", last_name: "",
  password: "", role_id: null, extra_permissions: [],
};

export default function Users() {
  const { can, user: me } = useAuth();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [matrix, setMatrix] = useState<PermissionMatrixData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<Account | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const mayManage = can("users:manage");

  const load = useCallback(async () => {
    try {
      const [a, r, c] = await Promise.all([
        api.get<Account[]>("/api/cms/users"),
        api.get<Role[]>("/api/cms/roles"),
        api.get<PermissionMatrixData>("/api/cms/permissions"),
      ]);
      setAccounts(a);
      setRoles(r);
      setMatrix(c);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accounts");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/cms/users", draft);
      setNotice(`Account “${draft.username}” created. Give them the password you set.`);
      setDraft(EMPTY);
      setCreating(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/cms/users/${editing.id}`, {
        email: editing.email,
        first_name: editing.first_name,
        last_name: editing.last_name,
        role_id: editing.role_id,
        extra_permissions: editing.extra_permissions,
        is_active: editing.is_active,
      });
      if (newPassword) {
        await api.post(`/api/cms/users/${editing.id}/password`, { password: newPassword });
      }
      setNotice(`Saved “${editing.username}”.`);
      setEditing(null);
      setNewPassword("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove(account: Account) {
    if (!confirm(`Delete the account “${account.username}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.del(`/api/cms/users/${account.id}`);
      setNotice(`Deleted “${account.username}”.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  /** What the chosen role already grants — shown ticked and locked. */
  const inheritedFrom = (roleId: number | null): Set<string> => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return new Set();
    if (role.is_owner) {
      // the owner role covers everything the matrix can show
      const all = new Set<string>();
      matrix?.groups.forEach((g) =>
        g.objects.forEach((o) => o.actions.forEach((a) => all.add(`${o.key}:${a}`))),
      );
      return all;
    }
    const held = new Set(role.permissions);
    const out = new Set(role.permissions);
    // "All pages" implies each individual page for that action
    matrix?.groups.forEach((g) =>
      g.objects.forEach((o) => {
        if (!o.key.startsWith("page:") || o.is_wildcard) return;
        o.actions.forEach((a) => {
          if (held.has(`page:*:${a}`)) out.add(`${o.key}:${a}`);
        });
      }),
    );
    return out;
  };

  if (!can("users:view")) {
    return (
      <>
        <div className="topbar"><h1>Users</h1></div>
        <div className="content">
          <div className="empty">Your account does not have permission to view users.</div>
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------- edit --
  if (editing) {
    return (
      <>
        <div className="topbar">
          <h1>{editing.username}</h1>
          <span className="route">{editing.role_name ?? "no role"}</span>
          <div className="spacer" />
          <button type="button" className="btn btn-sm" onClick={() => { setEditing(null); setNewPassword(""); }}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit} disabled={busy}>
            Save changes
          </button>
        </div>
        <div className="content">
          {error && <div className="notice notice-error">{error}</div>}

          <div className="form-grid">
            <label>First name
              <input value={editing.first_name}
                onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} />
            </label>
            <label>Last name
              <input value={editing.last_name}
                onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} />
            </label>
            <label>Email
              <input type="email" value={editing.email}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </label>
            <label>Role
              <select value={editing.role_id ?? ""}
                onChange={(e) => setEditing({ ...editing, role_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">No role</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label>New password
              <input type="password" value={newPassword} autoComplete="new-password"
                placeholder="leave blank to keep the current one"
                onChange={(e) => setNewPassword(e.target.value)} />
            </label>
            <label className="checkline">
              <input type="checkbox" checked={editing.is_active}
                disabled={editing.id === me?.id}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              Account is enabled
              {editing.id === me?.id && <em> — you cannot disable your own</em>}
            </label>
          </div>

          <h2 className="uk-h5">Permissions</h2>
          <p className="muted small">
            The role sets most of these. Tick an extra to give this one person
            something their role does not include.
          </p>
          {matrix && (
            <PermissionMatrix
              data={matrix}
              selected={new Set(editing.extra_permissions)}
              inherited={inheritedFrom(editing.role_id)}
              onToggle={(k, on) =>
                setEditing({
                  ...editing,
                  extra_permissions: on
                    ? [...new Set([...editing.extra_permissions, k])]
                    : editing.extra_permissions.filter((p) => p !== k),
                })
              }
            />
          )}
        </div>
      </>
    );
  }

  // -------------------------------------------------------------- create --
  if (creating) {
    return (
      <>
        <div className="topbar">
          <h1>New account</h1>
          <div className="spacer" />
          <button type="button" className="btn btn-sm" onClick={() => { setCreating(false); setDraft(EMPTY); }}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={create}
            disabled={busy || !draft.username || !draft.email || draft.password.length < 8}>
            Create account
          </button>
        </div>
        <div className="content">
          {error && <div className="notice notice-error">{error}</div>}

          <div className="form-grid">
            <label>Username *
              <input value={draft.username} autoComplete="off"
                onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
            </label>
            <label>Email *
              <input type="email" value={draft.email} autoComplete="off"
                onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </label>
            <label>First name
              <input value={draft.first_name}
                onChange={(e) => setDraft({ ...draft, first_name: e.target.value })} />
            </label>
            <label>Last name
              <input value={draft.last_name}
                onChange={(e) => setDraft({ ...draft, last_name: e.target.value })} />
            </label>
            <label>Password *
              <input type="password" value={draft.password} autoComplete="new-password"
                aria-describedby="password-rule"
                onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
              <span id="password-rule" className="field-hint">at least 8 characters</span>
            </label>
            <label>Role
              <select value={draft.role_id ?? ""}
                onChange={(e) => setDraft({ ...draft, role_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">No role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.is_owner ? "everything" : `${r.permissions.length} permissions`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {draft.role_id && (
            <p className="muted small">
              {roles.find((r) => r.id === draft.role_id)?.description}
            </p>
          )}

          <h2 className="uk-h5">Permissions</h2>
          {matrix && (
            <PermissionMatrix
              data={matrix}
              selected={new Set(draft.extra_permissions)}
              inherited={inheritedFrom(draft.role_id)}
              onToggle={(k, on) =>
                setDraft((d) => ({
                  ...d,
                  extra_permissions: on
                    ? [...new Set([...d.extra_permissions, k])]
                    : d.extra_permissions.filter((p) => p !== k),
                }))
              }
            />
          )}
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------- list --
  return (
    <>
      <div className="topbar">
        <h1>Users</h1>
        {accounts && <span className="route">{accounts.length} account(s)</span>}
        <div className="spacer" />
        {mayManage && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            <UserPlus size={15} /> New account
          </button>
        )}
      </div>

      <div className="content">
        {error && <div className="notice notice-error">{error}</div>}
        {notice && <div className="notice notice-ok">{notice}</div>}

        {!accounts ? (
          <div className="empty">Loading…</div>
        ) : (
          <div className="sub-table-wrap">
            <table className="sub-table">
              <thead>
                <tr>
                  <th>Username</th><th>Name</th><th>Email</th>
                  <th>Role</th><th>Last signed in</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.username}</strong>{a.is_superuser && <span className="badge badge-new"> owner</span>}</td>
                    <td>{[a.first_name, a.last_name].filter(Boolean).join(" ") || <span className="muted">—</span>}</td>
                    <td>{a.email}</td>
                    <td>{a.role_name ?? <span className="muted">none</span>}</td>
                    <td className="muted small">{when(a.last_login_at)}</td>
                    <td>{a.is_active ? "Active" : <span className="muted">Disabled</span>}</td>
                    <td>
                      {mayManage && (
                        <>
                          <button type="button" className="btn btn-sm"
                            onClick={() => { setEditing(a); setNewPassword(""); }}>
                            Edit
                          </button>{" "}
                          {a.id !== me?.id && (
                            <button type="button" className="btn btn-sm" onClick={() => remove(a)} disabled={busy}>
                              <Trash size={14} />
                            </button>
                          )}
                        </>
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
