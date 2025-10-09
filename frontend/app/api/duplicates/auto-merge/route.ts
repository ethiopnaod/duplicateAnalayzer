import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward request to backend
    const response = await axiosClient.post('/duplicates/auto-merge', body);

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error auto-merging duplicate via backend:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to auto-merge duplicate - backend unavailable' 
      },
      { status: 500 }
    );
  }
}