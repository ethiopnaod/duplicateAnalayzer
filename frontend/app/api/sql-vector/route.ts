import { NextRequest, NextResponse } from 'next/server';
import aiClient from '@/lib/aiClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question } = body;

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    const response = await aiClient.post('/api/sql-vector', { question });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error processing vector SQL query:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process vector SQL query',
        message: 'Failed to get AI response'
      },
      { status: 500 }
    );
  }
}
