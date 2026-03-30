// Placeholder — sent message threading disabled for now
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ messages: [], folder: null })
}
