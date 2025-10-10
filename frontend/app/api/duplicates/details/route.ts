import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const type = searchParams.get('type');

  if (!name || !type) {
    return NextResponse.json(
      { error: 'Name and type parameters are required' },
      { status: 400 }
    );
  }

  try {
    // Forward request to backend
    const response = await axiosClient.get('/duplicates/details', {
      params: {
        name: name,
        type: type
      }
    });

    return NextResponse.json(response.data.data || response.data);
  } catch (error: any) {
    console.error('Error fetching entity details from backend:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entity details from backend' },
      { status: 500 }
    );
  }
}