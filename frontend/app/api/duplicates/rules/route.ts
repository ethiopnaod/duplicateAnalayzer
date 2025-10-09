import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function GET(request: NextRequest) {
  try {
    // Forward request to backend
    const response = await axiosClient.get('/duplicates/rules');
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error fetching duplicate rules from backend:', error);
    
    // Return empty data if backend is unavailable
    return NextResponse.json({
      rules: [],
    }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward request to backend
    const response = await axiosClient.post('/duplicates/rules', body);
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error creating duplicate rule via backend:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create duplicate rule - backend unavailable' 
      },
      { status: 500 }
    );
  }
}
