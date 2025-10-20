import { NextRequest, NextResponse } from 'next/server'
import aiClient from '@/lib/aiClient'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const response = await aiClient.post('/api/ai/answer', { question: body.question })
    return NextResponse.json(response.data)
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to analyze query' }, { status: 500 })
  }
}
