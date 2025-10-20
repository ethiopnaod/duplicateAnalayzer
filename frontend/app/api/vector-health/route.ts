import { NextRequest, NextResponse } from 'next/server';
import aiClient from '@/lib/aiClient';

export async function GET(request: NextRequest) {
  try {
    const response = await aiClient.get('/api/vector-health');
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error checking vector service health:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        vector_service: 'disconnected',
        error: 'Failed to check vector service health'
      },
      { status: 500 }
    );
  }
}
