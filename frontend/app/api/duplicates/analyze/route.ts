import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entities, entityType } = body;

    if (!entities || !Array.isArray(entities)) {
      return NextResponse.json({ error: 'Entities array is required' }, { status: 400 });
    }

    // Forward request to backend
    const response = await axiosClient.post('/duplicates/analyze', {
      entities,
      entityType
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error analyzing duplicates via backend:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze duplicates - backend unavailable' 
      },
      { status: 500 }
    );
  }
}
