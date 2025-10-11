import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await axiosClient.post('/natural-query', {
      question: body.question
    });

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
