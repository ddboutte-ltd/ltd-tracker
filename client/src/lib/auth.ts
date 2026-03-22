// Auth helpers — stores JWT in memory only (no localStorage/cookies from client)
let token: string | null = null;

export function setToken(t: string | null) {
  token = t;
}

export function getToken(): string | null {
  return token;
}

export function authHeaders(): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
