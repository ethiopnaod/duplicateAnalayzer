import { NextRequest, NextResponse } from 'next/server';
import aiClient from '@/lib/aiClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload: any = { question: body.question };
    if (body.plan) payload.plan = body.plan;
    
    const response = await aiClient.post('/api/sql', payload);

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error processing natural query:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process natural query',
        message: 'Failed to get AI response'
      },
      { status: 500 }
    );
  }
}
