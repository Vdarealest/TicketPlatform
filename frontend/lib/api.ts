import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './config';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveSession,
  type SessionTokens,
} from './session';

const BACKEND_URL = API_URL;

export const api: AxiosInstance = axios.create({
  baseURL: BACKEND_URL,
  // Render free tier sleeps when idle and takes 20-40s to wake. A 10s
  // timeout made the first visit after a quiet period fail to load data.
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token if available
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Calls whose 401 means "wrong credentials / bad code", not "token expired".
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/oauth/exchange'];

// One refresh at a time: when several requests fail together they all wait
// for the same new token instead of each spending the refresh token.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const used = getRefreshToken();
  if (!used) return null;
  try {
    // Plain axios, not `api`: this call must not trigger the interceptor.
    const res = await axios.post<SessionTokens>(
      `${BACKEND_URL}/auth/refresh`,
      { refresh_token: used },
      { timeout: 45000 },
    );
    saveSession(res.data);
    return res.data.access_token;
  } catch {
    // Another tab may have rotated the token a moment earlier; if so the
    // new pair is already in localStorage and we can use it.
    const current = getRefreshToken();
    return current && current !== used ? getAccessToken() : null;
  }
}

// Response interceptor: renew the access token once on 401, then give up.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthCall = AUTH_ENDPOINTS.some((p) => original?.url?.startsWith(p));

    if (error.response?.status === 401 && original && !isAuthCall && typeof window !== 'undefined') {
      if (!original._retried && getRefreshToken()) {
        original._retried = true;
        refreshing ??= refreshAccessToken().finally(() => {
          refreshing = null;
        });
        const token = await refreshing;
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      }
      // No way to renew: the session is over.
      if (getAccessToken()) {
        clearSession();
        window.location.href = '/login';
      }
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      console.error('❌ Backend connection failed:', BACKEND_URL);
      console.error('Make sure backend is running on', BACKEND_URL);
    }

    return Promise.reject(error);
  }
);

/**
 * The message to show for a failed API call. Nest sends `message` as a
 * string from services, but as an array of strings from ValidationPipe
 * (one per invalid field), which used to render glued together.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(err)) {
    const message = err.response?.data?.message;
    if (Array.isArray(message)) return message.filter(Boolean).join(' ') || fallback;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

// Export axios instance for direct use
export default api;
