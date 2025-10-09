import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entities, mergeName } = body;

    if (!entities || !Array.isArray(entities) || !mergeName) {
      return NextResponse.json({ error: 'Entities array and mergeName are required' }, { status: 400 });
    }

    // Forward request to backend
    const response = await axiosClient.post('/duplicates/resolve', {
      entities,
      mergeName
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error resolving duplicates via backend:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to resolve duplicates - backend unavailable' 
      },
      { status: 500 }
    );
  }
}
