"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { api, getToken, setToken, type MyPermissions, type User } from "@/lib/api";

type AuthState = {
  user: User | null;
  ready: boolean;
  /** What this account may do. Empty until the session is known. */
  permissions: Set<string>;
  roleName: string | null;
  can: (permission: string) => boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/** Where to land after signing in, given what the account can actually reach. */
function landingFor(permissions: Set<string>): string {
  if (permissions.has("page:*:view")) return "/pages";
  if (permissions.has("submissions:view")) return "/submissions";
  if (permissions.has("media:view")) return "/media";
  if (permissions.has("users:view")) return "/users";
  if (permissions.has("activity:view")) return "/activity";
  return "/no-access";
}

/**
 * Holds the signed-in user and what they are allowed to do. The token is a JWT
 * in localStorage — adequate for an internal admin tool that talks to the API
 * from the browser.
 *
 * The permission set here only decides what the CMS *shows*. Every endpoint
 * checks again on the server, so hiding a button is a courtesy, not the
 * control.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [roleName, setRoleName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // permissions arrive a moment after the user does; redirecting before
  // they land would send everyone to the no-access page
  const [permsReady, setPermsReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const loadPermissions = useCallback(async () => {
    try {
      const mine = await api.get<MyPermissions>("/api/cms/me/permissions");
      setPermissions(new Set(mine.permissions));
      setRoleName(mine.role);
      return new Set(mine.permissions);
    } catch {
      setPermissions(new Set());
      setRoleName(null);
      return new Set<string>();
    } finally {
      setPermsReady(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        if (!cancelled) {
          setReady(true);
          setPermsReady(true);
        }
        return;
      }
      try {
        const me = await api.get<User>("/api/auth/me");
        if (!cancelled) {
          setUser(me);
          await loadPermissions();
        }
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPermissions]);

  // bounce to the login screen once we know there is no session
  useEffect(() => {
    if (!ready) return;
    if (!user && pathname !== "/login") router.replace("/login");
    if (user && permsReady && pathname === "/login") {
      router.replace(landingFor(permissions));
    }
  }, [ready, user, permsReady, pathname, router, permissions]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.login(username, password);
      setToken(res.access_token);
      setUser(res.user);
      const granted = await loadPermissions();
      router.replace(landingFor(granted));
    },
    [router, loadPermissions],
  );

  const logout = useCallback(() => {
    // Tell the API first so the activity log has both ends of the session;
    // signing out must still work if that call fails.
    api.post("/api/auth/logout").catch(() => {});
    setToken(null);
    setUser(null);
    setPermissions(new Set());
    setRoleName(null);
    setPermsReady(true);
    router.replace("/login");
  }, [router]);

  const can = useCallback(
    (permission: string) => permissions.has(permission),
    [permissions],
  );

  const value = useMemo(
    () => ({ user, ready, permissions, roleName, can, login, logout }),
    [user, ready, permissions, roleName, can, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
