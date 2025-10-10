import { NextRequest, NextResponse } from 'next/server';
import axiosClient from '@/lib/axiosClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { primaryEntityId, duplicateEntityIds, entityType } = body;

    if (!primaryEntityId || !duplicateEntityIds || !entityType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Forward request to backend
    const response = await axiosClient.post('/duplicates/merge-entity', {
      primaryEntityId: parseInt(primaryEntityId),
      duplicateEntityIds: duplicateEntityIds,
      entityType: entityType
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error merging entities:', error);
    return NextResponse.json(
      { error: 'Failed to merge entities' },
      { status: 500 }
    );
  }
}
