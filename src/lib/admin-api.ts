/*
 * Thin client for the existing 1320 Legends admin HTTP API.
 *
 * Auth rides the existing HttpOnly session cookie, so every request is a
 * plain same-origin fetch with credentials. Nothing here is a security
 * control: the server derives the acting admin from the session, never from
 * anything this file sends.
 */

export class ApiError extends Error {
  status: number;
  reason?: string | undefined;
  payload: unknown;
  /** True when the API host itself could not be reached (offline / not mounted). */
  offline: boolean;

  constructor(
    message: string,
    options: {
      status?: number | undefined;
      reason?: string | undefined;
      payload?: unknown;
      offline?: boolean | undefined;
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.reason = options.reason;
    this.payload = options.payload ?? null;
    this.offline = options.offline ?? false;
  }
}

type Json = Record<string, unknown>;

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export function buildQuery(params: QueryParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function api<T = Json>(
  path: string,
  options: Omit<RequestInit, "body"> & { body?: unknown } = {},
): Promise<T> {
  const { body, headers, ...rest } = options;
  let response: Response;

  try {
    response = await fetch(path, {
      ...rest,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(headers as Record<string, string> | undefined),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("The admin API could not be reached.", { offline: true });
  }

  const contentType = response.headers.get("content-type") || "";
  let payload: unknown = null;
  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => "");
    // A non-JSON body from an admin endpoint means the API is not mounted here.
    if (!response.ok || text.trim().startsWith("<")) {
      throw new ApiError(
        response.status === 404 ? "This endpoint is not available." : "Unexpected API response.",
        { status: response.status, offline: response.status === 404, payload: text },
      );
    }
    payload = { ok: response.ok };
  }

  const record = (payload ?? {}) as Json;

  if (!response.ok || record["ok"] === false) {
    const reason = typeof record["reason"] === "string" ? record["reason"] : undefined;
    const error = typeof record["error"] === "string" ? record["error"] : undefined;
    throw new ApiError(reasonText(reason) || error || `Request failed (${response.status})`, {
      status: response.status,
      reason,
      payload,
      offline: response.status === 404,
    });
  }

  return payload as T;
}

/** Human wording for the reason codes the API returns. */
export function reasonText(reason?: string): string {
  if (!reason) return "";
  const messages: Record<string, string> = {
    "account-not-found": "Account not found.",
    "invalid-password": "Password rejected.",
    "invalid-password-length": "Password rejected.",
    "invalid-username": "Username rejected.",
    "invalid-admin-login": "Login rejected. Check your username and password.",
    "admin-role-required": "Only staff (Guide and up) can sign in here.",
    "access-pending": "Your staff access is waiting for owner approval.",
    "access-denied": "Access denied. Ask an owner to restore your admin access.",
    "owner-required": "Only owners can do this.",
    "rate-limited": "Too many requests — slow down for a moment.",
  };
  return messages[reason] || "";
}

/* ------------------------------- session -------------------------------- */

export type AdminSession = {
  accountId: number;
  username: string;
  roleClass: number;
  membership?: boolean;
  canModerate?: boolean;
  canUseStaffTools?: boolean;
  accessStatus?: "approved" | "pending" | "denied" | string;
  isOwner?: boolean;
  loggedInAt?: string;
};

export type SessionResult =
  | { state: "authenticated"; session: AdminSession }
  | { state: "anonymous" }
  | { state: "unavailable"; message: string };

export async function fetchSession(): Promise<SessionResult> {
  try {
    const payload = await api<{ authenticated?: boolean; session?: AdminSession }>(
      "/api/admin/auth/session",
    );
    if (!payload.authenticated || !payload.session) return { state: "anonymous" };
    return { state: "authenticated", session: payload.session };
  } catch (error) {
    if (error instanceof ApiError && error.offline) {
      return { state: "unavailable", message: error.message };
    }
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { state: "anonymous" };
    }
    return { state: "unavailable", message: (error as Error).message };
  }
}

export const ROLE_NAMES: Record<number, string> = {
  0: "Player",
  1: "Guide",
  2: "Moderator",
  3: "Senior Mod",
  4: "Admin",
  5: "Owner",
};

export function roleName(roleClass?: number): string {
  return ROLE_NAMES[Number(roleClass ?? 0)] ?? `Role ${roleClass}`;
}

export function isOwner(session?: AdminSession | null): boolean {
  return Boolean(session?.isOwner) || Number(session?.roleClass ?? 0) >= 5;
}

export function sessionUsable(session?: AdminSession | null): boolean {
  if (!session) return false;
  return isOwner(session) || String(session.accessStatus ?? "approved") === "approved";
}

/* ------------------------------ formatting ------------------------------ */

export function money(value: unknown): string {
  const amount = Number(value ?? 0);
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function integer(value: unknown): string {
  return Number(value ?? 0).toLocaleString();
}

export function dateLabel(value?: string | number | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeLabel(value?: string | number | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString();
}

export function relativeLabel(value?: string | number | null): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
