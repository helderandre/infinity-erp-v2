import { type NextRequest, NextResponse } from 'next/server'

// Catch-all proxy: forwards API calls the partner app doesn't implement itself
// to the main ERP, carrying the Supabase auth cookies. The main API already
// scopes CRM reads (e.g. ?scope=referred) to the authenticated referrer, so a
// partner sees exactly their referred leads/oportunidades.
//
// Specific routes (/api/leads, /api/oportunidades, /api/consultants) win over
// this catch-all and are handled locally.
const MAIN_ORIGIN = process.env.MAIN_APP_ORIGIN || 'http://localhost:3000'

async function forward(req: NextRequest, path: string[]) {
  const url = new URL(req.url)
  const target = `${MAIN_ORIGIN}/api/${path.join('/')}${url.search}`

  const headers = new Headers(req.headers)
  headers.delete('host')
  headers.delete('content-length')

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer()
  }

  const res = await fetch(target, init)
  const body = await res.arrayBuffer()
  const outHeaders = new Headers(res.headers)
  outHeaders.delete('content-encoding')
  outHeaders.delete('content-length')
  return new NextResponse(body, { status: res.status, headers: outHeaders })
}

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path)
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path)
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path)
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path)
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path)
}
