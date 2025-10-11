import { NextRequest, NextResponse } from 'next/server';
import { SERVER_ENV } from '@/config/env';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: {
        username: SERVER_ENV.USERNAME,
        password: SERVER_ENV.PASSWORD,
        jwtSecret: SERVER_ENV.JWT_SECRET,
        nodeEnv: SERVER_ENV.NODE_ENV,
        port: SERVER_ENV.PORT
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
