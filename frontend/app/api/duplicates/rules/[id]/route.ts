import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await params;

    // Forward request to backend
    const response = await axiosClient.put(`/duplicates/rules/${id}`, body);
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error updating duplicate rule via backend:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update duplicate rule - backend unavailable' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Forward request to backend
    const response = await axiosClient.delete(`/duplicates/rules/${id}`);
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error deleting duplicate rule via backend:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete duplicate rule - backend unavailable' 
      },
      { status: 500 }
    );
  }
}
