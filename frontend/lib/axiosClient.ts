import { ENV } from "@/config/env";
import axios from "axios";

const axiosClient = axios.create({
  baseURL: ENV.NEXT_PUBLIC_BASE_URL,
  timeout: 120000, // 2 minute timeout for large datasets
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication
axiosClient.interceptors.request.use(
  (config) => {
    // Add authentication headers if available
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add basic auth if no token
    if (!token && ENV.USERNAME && ENV.PASSWORD) {
      const basicAuth = Buffer.from(`${ENV.USERNAME}:${ENV.PASSWORD}`).toString('base64');
      config.headers.Authorization = `Basic ${basicAuth}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only log errors in development or if they're not 500 database errors
    if (process.env.NODE_ENV === 'development' && error.response?.status !== 500) {
      console.error('API Error:', error.response?.data || error.message);
    }
    
    // Handle specific error cases
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login or refresh token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        window.location.href = '/auth/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosClient;
