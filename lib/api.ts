/** Thin client for the CMS API. */

export const API_BASE =
  process.env.NEXT_PUBLIC_CMS_API_URL ?? "http://127.0.0.1:8001";

export const SITE_BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";

const TOKEN_KEY = "eti_cms_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
    // the cached sidebar belongs to the session that just ended
    window.localStorage.removeItem("eti-cms.pages");
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  { auth = true }: { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(API_BASE + path, { ...init, headers });

  if (res.status === 401) {
    setToken(null);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError("Session expired — please sign in again", 401);
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T,>(path: string) => request<T>(path, { method: "DELETE" }),

  async login(username: string, password: string) {
    const form = new URLSearchParams({ username, password });
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) {
      throw new ApiError(
        res.status === 401 ? "Incorrect username or password" : `Login failed (${res.status})`,
        res.status,
      );
    }
    return (await res.json()) as { access_token: string; user: User };
  },

  async uploadMedia(file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<Media>("/api/media", { method: "POST", body: form });
  },
};

/** Media URLs from the API are relative to it, not to this app. */
export function mediaUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("/api/media/")) return API_BASE + url;
  if (url.startsWith("/")) return SITE_BASE + url;
  return url;
}

// ------------------------------------------------------------------ types --
export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
};

export type SlotKind = "text" | "richtext" | "image" | "video" | "link";

export type Slot = {
  id: number;
  key: string;
  kind: SlotKind;
  label: string;
  group: string | null;
  sort_order: number;
  default_value: string;
  value: string | null;
  live_value: string;
  media_id: number | null;
  alt_text: string | null;
};

export type Page = {
  id: number;
  route: string;
  title: string;
  meta_description: string | null;
  section: string | null;
  sort_order: number;
  is_published: boolean;
  content_updated_at: string | null;
  updated_at: string;
};

export type PageDetail = Page & { slots: Slot[] };

export type Media = {
  id: number;
  filename: string;
  content_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  url: string;
  created_at: string;
};

export type SaveResult = {
  route: string;
  saved_slots: number;
  revalidated: boolean;
  revalidate_detail: string | null;
};

export type Submission = {
  id: number;
  form_key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  program: string | null;
  is_read: boolean;
  created_at: string;
};

export type SubmissionDetail = Submission & { answers: Record<string, string> };

export type SubmissionPage = {
  items: Submission[];
  total: number;
  unread: number;
};

// ------------------------------------------------------------------ rbac --
export type Role = {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
  is_owner: boolean;
  user_count: number;
};

export type Account = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_superuser: boolean;
  role_id: number | null;
  role_name: string | null;
  extra_permissions: string[];
  permissions: string[];
  last_login_at: string | null;
  created_at: string | null;
};

export type MatrixAction = { key: string; label: string; hint: string };

export type MatrixObject = {
  key: string;
  label: string;
  hint: string;
  actions: string[];
  section?: string | null;
  is_wildcard?: boolean;
};

export type MatrixGroup = { group: string; objects: MatrixObject[] };

export type PermissionMatrixData = {
  actions: MatrixAction[];
  groups: MatrixGroup[];
};

export type MyPermissions = {
  username: string;
  is_superuser: boolean;
  role: string | null;
  permissions: string[];
};

export type ActivityRow = {
  id: number;
  username: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  summary: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type ActivityPage = { items: ActivityRow[]; total: number };
