import axios, { AxiosError, AxiosInstance } from 'axios';
import { API_URL } from './config';

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
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('access_token')
      : null;
    
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

// Response interceptor - handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const hasToken = !!localStorage.getItem('access_token');
        if (hasToken) {
          // Session expired — clear and redirect
          localStorage.removeItem('access_token');
          window.location.href = '/login';
        }
        // No token means this is a login/auth attempt — let the catch block handle it
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