const KEY = "easy-job-token";
const OLD_KEY = "orcha-office-token";

function storedToken(): string | null {
  const next = sessionStorage.getItem(KEY);
  if (next) return next;
  const old = sessionStorage.getItem(OLD_KEY);
  if (!old) return null;
  sessionStorage.setItem(KEY, old);
  sessionStorage.removeItem(OLD_KEY);
  return old;
}

export function loadToken(): string | null {
  const raw = location.hash.replace(/^#/, "");
  if (raw.startsWith("t=")) {
    const token = decodeURIComponent(raw.slice(2));
    sessionStorage.setItem(KEY, token);
    location.replace(`${location.pathname}${location.search}#home`);
    return token;
  }
  return storedToken();
}

export function token(): string | null {
  return storedToken();
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = token();
  const headers = new Headers(init.headers);
  if (auth) headers.set("authorization", `Bearer ${auth}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data as T;
}
