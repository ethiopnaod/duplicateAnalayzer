import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type) {
      return NextResponse.json(
        { error: 'Type parameter is required' },
        { status: 400 }
      );
    }

    const response = await axiosClient.get('/duplicates/count', {
      params: { type }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching duplicate count:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch duplicate count',
        data: { count: 0 }
      },
      { status: 500 }
    );
  }
}