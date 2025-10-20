import { NextRequest, NextResponse } from 'next/server'
import aiClient from '@/lib/aiClient'

export async function GET(_request: NextRequest) {
  try {
    const response = await aiClient.get('/health')
    return NextResponse.json(response.data)
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: 'AI backend health failed' }, { status: 503 })
  }
}


