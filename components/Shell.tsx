"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import PagesNav from "@/components/PagesNav";
import { ExternalLink, History, Images, Inbox, LogOut, Shield, Users } from "@/components/icons";
import { SITE_BASE } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

/** Sidebar + chrome for every signed-in screen. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, ready, logout, can, roleName } = useAuth();

  if (pathname === "/login") return <>{children}</>;

  if (!ready) {
    return <div className="empty">Loading…</div>;
  }
  if (!user) {
    // AuthProvider is already redirecting
    return <div className="empty">Redirecting to sign in…</div>;
  }

  const onMedia = pathname.startsWith("/media");
  const onSubmissions = pathname.startsWith("/submissions");
  const onUsers = pathname.startsWith("/users");
  const onRoles = pathname.startsWith("/roles");
  const onActivity = pathname.startsWith("/activity");

  // Only what this account can actually reach is offered. The API checks
  // again on every request, so this is tidiness rather than security.
  const showAdmin = can("users:view") || can("roles:manage") || can("activity:view");

  return (
    <div className="shell">
      {/* First thing in the tab order, visible only once focused: without it a
          keyboard user walks the whole page tree before reaching the screen. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/pages" className="sidebar-brand">
          {/* light variant — the full-colour mark is navy on a navy sidebar */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ETI_logo_lt.svg" alt="Electrical Training Institute" />
          <span className="sidebar-brand-rule" aria-hidden="true" />
          <span className="sidebar-brand-text">
            <strong>Electrical Training Institute</strong>
            <span>Content manager</span>
          </span>
        </Link>

        <nav>
          <PagesNav />

          {showAdmin && (
            <div className="nav-group">
              <div className="nav-heading">Administration</div>
              {can("users:view") && (
                <Link href="/users" className={`nav-item${onUsers ? " active" : ""}`}>
                  <span className="nav-rail" aria-hidden="true" />
                  <Users size={18} className="nav-icon" />
                  <span className="nav-label">Users</span>
                </Link>
              )}
              {can("roles:manage") && (
                <Link href="/roles" className={`nav-item${onRoles ? " active" : ""}`}>
                  <span className="nav-rail" aria-hidden="true" />
                  <Shield size={18} className="nav-icon" />
                  <span className="nav-label">Roles &amp; permissions</span>
                </Link>
              )}
              {can("activity:view") && (
                <Link href="/activity" className={`nav-item${onActivity ? " active" : ""}`}>
                  <span className="nav-rail" aria-hidden="true" />
                  <History size={18} className="nav-icon" />
                  <span className="nav-label">Activity log</span>
                </Link>
              )}
            </div>
          )}

          {can("submissions:view") && (
          <div className="nav-group">
            <div className="nav-heading">Enquiries</div>
            <Link
              href="/submissions"
              className={`nav-item${onSubmissions ? " active" : ""}`}
            >
              <span className="nav-rail" aria-hidden="true" />
              <Inbox size={18} className="nav-icon" />
              <span className="nav-label">Contact forms</span>
            </Link>
          </div>
          )}

          <div className="nav-group">
            <div className="nav-heading">Library</div>
            {can("media:view") && (
            <Link href="/media" className={`nav-item${onMedia ? " active" : ""}`}>
              <span className="nav-rail" aria-hidden="true" />
              <Images size={18} className="nav-icon" />
              <span className="nav-label">Media library</span>
            </Link>
            )}
            <a href={SITE_BASE} target="_blank" rel="noreferrer" className="nav-item">
              <span className="nav-rail" aria-hidden="true" />
              <ExternalLink size={18} className="nav-icon" />
              <span className="nav-label">View website</span>
            </a>
          </div>
        </nav>

        <div className="sidebar-foot">
          <span className="sidebar-avatar" aria-hidden="true">
            {(user.first_name || user.username).charAt(0).toUpperCase()}
          </span>
          <span className="sidebar-user">
            <strong>{user.username}</strong>
            <span>{roleName ?? (user.is_superuser ? "Administrator" : "No role")}</span>
          </span>
          <button
            type="button"
            className="sidebar-signout"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main id="main" className="main">{children}</main>
    </div>
  );
}
