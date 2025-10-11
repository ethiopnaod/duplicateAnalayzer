import { SERVER_ENV } from "@/config/env";
import axios from "axios";

// Server-side only axios client for API routes
const axiosClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005/api/v1',
  timeout: 120000, // 2 minute timeout for large datasets
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add basic auth for server-to-server communication
axiosClient.interceptors.request.use(
  (config) => {
    // Add basic auth for server-to-server communication
    if (SERVER_ENV.USERNAME && SERVER_ENV.PASSWORD) {
      const basicAuth = Buffer.from(`${SERVER_ENV.USERNAME}:${SERVER_ENV.PASSWORD}`).toString('base64');
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
    // Only log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', error.response?.data || error.message);
    }
    
    return Promise.reject(error);
  }
);

export default axiosClient;
