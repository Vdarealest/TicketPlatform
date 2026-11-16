import { API_URL } from './config';

// The browser side of a login: a 15-minute access token (sent on every API
// call) and a refresh token that lib/api.ts trades for a new pair when the
// access token expires. Both live in localStorage so every tab shares them.

const ACCESS = 'access_token';
const REFRESH = 'refresh_token';

export interface SessionTokens {
  access_token: string;
  refresh_token?: string;
}

export function saveSession(tokens: SessionTokens) {
  localStorage.setItem(ACCESS, tokens.access_token);
  if (tokens.refresh_token) localStorage.setItem(REFRESH, tokens.refresh_token);
}

export function clearSession() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}

export function getAccessToken() {
  return typeof window === 'undefined' ? null : localStorage.getItem(ACCESS);
}

export function getRefreshToken() {
  return typeof window === 'undefined' ? null : localStorage.getItem(REFRESH);
}

/**
 * Ends the session here and on the server. The local tokens go first so the
 * UI logs out instantly; the server call is best-effort (keepalive lets it
 * finish even if the page navigates away).
 */
export function logout() {
  const refresh = getRefreshToken();
  clearSession();
  window.dispatchEvent(new Event('auth-changed'));
  if (refresh) {
    fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
      keepalive: true,
    }).catch(() => {});
  }
}
