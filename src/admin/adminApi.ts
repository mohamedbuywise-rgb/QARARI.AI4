const STORAGE_KEY = "qarari-admin-creds";

export interface AdminCreds {
  username: string;
  password: string;
}

export function getStoredCreds(): AdminCreds | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeCreds(creds: AdminCreds) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

export function clearCreds() {
  sessionStorage.removeItem(STORAGE_KEY);
}

// Every admin API call re-sends the username/password as headers (Section 15's
// simple single-admin gate) — a 401 here always means "log in again".
export async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const creds = getStoredCreds();
  if (!creds) throw new Error("not_authenticated");

  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-username": creds.username,
      "x-admin-password": creds.password,
      ...(options.headers || {}),
    },
  });
}
