import axios, { AxiosError, AxiosInstance } from 'axios';

// Get backend URL from environment or use default
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api: AxiosInstance = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10000,
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

// Export axios instance for direct use
export default api;