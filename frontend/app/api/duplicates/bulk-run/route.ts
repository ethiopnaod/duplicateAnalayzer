import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward request to backend
    const response = await axiosClient.post('/duplicates/bulk-run', body);

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error running bulk operations via backend:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        tasks: [],
        error: 'Failed to run bulk operations - backend unavailable' 
      },
      { status: 500 }
    );
  }
}
