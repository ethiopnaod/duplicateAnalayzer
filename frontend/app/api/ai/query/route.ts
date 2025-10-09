import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Forward request to backend
    const response = await axiosClient.post('/ai/query', {
      query
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error querying AI via backend:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        response: 'AI service unavailable - backend offline',
        error: 'Failed to query AI - backend unavailable' 
      },
      { status: 500 }
    );
  }
}
