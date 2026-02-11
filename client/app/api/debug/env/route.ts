import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        HAS_NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
        HAS_NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
        HAS_GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
        HAS_GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT_SET',
        NODE_ENV: process.env.NODE_ENV
    });
}
