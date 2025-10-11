import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function GET(request: NextRequest) {
  try {
    const response = await axiosClient.get('/health');
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error checking backend health:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy',
        message: 'Backend health check failed'
      },
      { status: 500 }
    );
  }
}
