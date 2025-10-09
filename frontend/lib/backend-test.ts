/**
 * Backend connection test utility
 */
import axiosClient from './axiosClient';

export interface BackendHealthCheck {
  status: 'healthy' | 'unhealthy';
  message: string;
  responseTime?: number;
  backendUrl: string;
}

/**
 * Test backend connection and health
 */
export async function testBackendConnection(): Promise<BackendHealthCheck> {
  const startTime = Date.now();
  const backendUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005/api/v1';
  
  try {
    // Test basic connectivity
    const response = await axiosClient.get('/health', {
      timeout: 10000, // 10 second timeout for health check
    });
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      message: `Backend is responding (${responseTime}ms)`,
      responseTime,
      backendUrl,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    let message = 'Backend connection failed';
    if (error.code === 'ECONNREFUSED') {
      message = 'Backend server is not running or not accessible';
    } else if (error.code === 'ETIMEDOUT') {
      message = 'Backend request timed out';
    } else if (error.response?.status === 404) {
      message = 'Backend is running but health endpoint not found';
    } else if (error.response?.status === 401) {
      message = 'Backend is running but authentication failed';
    } else if (error.response?.status >= 500) {
      message = 'Backend server error';
    }
    
    return {
      status: 'unhealthy',
      message: `${message} (${responseTime}ms)`,
      responseTime,
      backendUrl,
    };
  }
}

/**
 * Test specific duplicate endpoints
 */
export async function testDuplicateEndpoints(): Promise<{
  duplicates: boolean;
  count: boolean;
  merge: boolean;
  delete: boolean;
  autoMerge: boolean;
}> {
  const results = {
    duplicates: false,
    count: false,
    merge: false,
    delete: false,
    autoMerge: false,
  };
  
  try {
    // Test duplicates endpoint
    await axiosClient.get('/duplicates', { params: { type: '1', page: 1, pageSize: 1 } });
    results.duplicates = true;
  } catch (error) {
    console.warn('Duplicates endpoint test failed:', error);
  }
  
  try {
    // Test count endpoint
    await axiosClient.get('/duplicates/count', { params: { type: '1' } });
    results.count = true;
  } catch (error) {
    console.warn('Count endpoint test failed:', error);
  }
  
  // Note: We don't test POST/DELETE endpoints as they would modify data
  
  return results;
}
