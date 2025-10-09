import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityName = searchParams.get('name');
    const entityType = searchParams.get('type') || '1';

    if (!entityName) {
      return NextResponse.json({ error: 'Entity name is required' }, { status: 400 });
    }

    // Forward request to backend
    const response = await axiosClient.get('/duplicates/details', {
      params: { 
        name: entityName,
        type: entityType 
      }
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error fetching entity details from backend:', error);
    
    // Return empty data if backend is unavailable
    return NextResponse.json({
      entities: [],
    }, { status: 200 });
  }
}
