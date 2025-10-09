import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function GET(request: NextRequest) {
  try {
    // Forward request to backend
    const response = await axiosClient.get('/duplicates/ai-decisions');
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error fetching AI decisions from backend:', error);
    
    // Return empty data if backend is unavailable
    return NextResponse.json({
      groups: [],
    }, { status: 200 });
  }
}
