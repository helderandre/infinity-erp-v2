import { NextRequest, NextResponse } from "next/server"
import {
  getIGConversations,
  getIGMessages,
  sendIGMessage,
  hideIGConversation,
} from "@/app/dashboard/instagram/actions"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const conversationId = searchParams.get("conversationId")
  const accountPageId = searchParams.get("accountPageId") ?? undefined

  try {
    if (conversationId) {
      const result = await getIGMessages(conversationId, accountPageId)
      return NextResponse.json(result)
    }

    const result = await getIGConversations()
    return NextResponse.json(result)
  } catch (err) {
    console.error("instagram-dms GET error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, recipientId, message, conversationId, accountPageId } = body as {
      action: "send" | "hide"
      recipientId?: string
      message?: string
      conversationId?: string
      accountPageId?: string
    }

    if (action === "send") {
      if (!recipientId || !message) {
        return NextResponse.json({ error: "recipientId and message required" }, { status: 400 })
      }
      const result = await sendIGMessage(recipientId, message, accountPageId)
      return NextResponse.json(result)
    }

    if (action === "hide") {
      if (!conversationId) {
        return NextResponse.json({ error: "conversationId required" }, { status: 400 })
      }
      const result = await hideIGConversation(conversationId)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    console.error("instagram-dms POST error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
