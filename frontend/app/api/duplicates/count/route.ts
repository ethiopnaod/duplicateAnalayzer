import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('type') || '1';

    // Forward request to backend
    const response = await axiosClient.get('/duplicates/count', {
      params: { type: entityType }
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error getting duplicate count from backend:', error);
    
    // Return zero count if backend is unavailable
    return NextResponse.json({ count: 0 });
  }
}