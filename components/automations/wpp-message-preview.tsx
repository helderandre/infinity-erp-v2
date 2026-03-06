"use client"

import { Check, FileText, ImageIcon, Mic, Play, Video } from "lucide-react"
import type { WhatsAppMessageType } from "@/lib/types/automation-flow"

interface WppMessagePreviewProps {
  type: WhatsAppMessageType
  content: string
  mediaUrl?: string
  docName?: string
}

function formatTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
}

/** Strip WhatsApp markdown for plain preview */
function stripVariableBraces(text: string) {
  return text.replace(/\{\{([^}]+)\}\}/g, "$1")
}

function TextBubble({ content }: { content: string }) {
  const displayText = stripVariableBraces(content)
  return (
    <div className="max-w-[75%] ml-auto">
      <div className="bg-[#d9fdd3] rounded-lg rounded-tr-none px-2.5 py-1.5 shadow-sm relative">
        <p className="text-[13px] text-[#111b21] whitespace-pre-wrap break-words leading-[19px]">
          {displayText || (
            <span className="text-[#667781] italic">Mensagem vazia...</span>
          )}
        </p>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[10px] text-[#667781] leading-none">{formatTime()}</span>
          <Check className="h-3 w-3 text-[#53bdeb]" />
        </div>
      </div>
    </div>
  )
}

function ImageBubble({ content, mediaUrl }: { content: string; mediaUrl?: string }) {
  const displayText = stripVariableBraces(content)
  return (
    <div className="max-w-[75%] ml-auto">
      <div className="bg-[#d9fdd3] rounded-lg rounded-tr-none shadow-sm overflow-hidden">
        {mediaUrl ? (
          <div className="bg-[#e2e8f0] h-[140px] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="bg-[#d1d5db]/50 h-[140px] flex flex-col items-center justify-center gap-1.5">
            <ImageIcon className="h-8 w-8 text-[#667781]/60" />
            <span className="text-[10px] text-[#667781]/60">Imagem</span>
          </div>
        )}
        <div className="px-2.5 py-1.5">
          {displayText && (
            <p className="text-[13px] text-[#111b21] whitespace-pre-wrap break-words leading-[19px]">
              {displayText}
            </p>
          )}
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[10px] text-[#667781] leading-none">{formatTime()}</span>
            <Check className="h-3 w-3 text-[#53bdeb]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function VideoBubble({ content }: { content: string }) {
  const displayText = stripVariableBraces(content)
  return (
    <div className="max-w-[75%] ml-auto">
      <div className="bg-[#d9fdd3] rounded-lg rounded-tr-none shadow-sm overflow-hidden">
        <div className="bg-[#1a1a2e] h-[140px] flex items-center justify-center relative">
          <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="h-5 w-5 text-white fill-white ml-0.5" />
          </div>
          <span className="absolute bottom-2 left-2 text-[10px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded">
            0:00
          </span>
        </div>
        <div className="px-2.5 py-1.5">
          {displayText && (
            <p className="text-[13px] text-[#111b21] whitespace-pre-wrap break-words leading-[19px]">
              {displayText}
            </p>
          )}
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[10px] text-[#667781] leading-none">{formatTime()}</span>
            <Check className="h-3 w-3 text-[#53bdeb]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function AudioBubble() {
  return (
    <div className="max-w-[75%] ml-auto">
      <div className="bg-[#d9fdd3] rounded-lg rounded-tr-none px-2.5 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-[#00a884] flex items-center justify-center shrink-0">
            <Play className="h-3.5 w-3.5 text-white fill-white ml-0.5" />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[2px] bg-[#8696a0] rounded-full"
                  style={{ height: `${Math.random() * 12 + 4}px` }}
                />
              ))}
            </div>
            <span className="text-[10px] text-[#667781]">0:00</span>
          </div>
          <Mic className="h-4 w-4 text-[#53bdeb] shrink-0" />
        </div>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[10px] text-[#667781] leading-none">{formatTime()}</span>
          <Check className="h-3 w-3 text-[#53bdeb]" />
        </div>
      </div>
    </div>
  )
}

function DocumentBubble({ content, docName }: { content: string; docName?: string }) {
  const displayText = stripVariableBraces(content)
  return (
    <div className="max-w-[75%] ml-auto">
      <div className="bg-[#d9fdd3] rounded-lg rounded-tr-none shadow-sm overflow-hidden">
        <div className="bg-[#d1d5db]/30 mx-1 mt-1 rounded-md px-3 py-2.5 flex items-center gap-2.5">
          <FileText className="h-8 w-8 text-[#667781]/80 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-[#111b21] font-medium truncate">
              {docName || "documento.pdf"}
            </p>
            <p className="text-[10px] text-[#667781]">PDF</p>
          </div>
        </div>
        <div className="px-2.5 py-1.5">
          {displayText && (
            <p className="text-[13px] text-[#111b21] whitespace-pre-wrap break-words leading-[19px]">
              {displayText}
            </p>
          )}
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[10px] text-[#667781] leading-none">{formatTime()}</span>
            <Check className="h-3 w-3 text-[#53bdeb]" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function WppMessagePreview({
  type,
  content,
  mediaUrl,
  docName,
}: WppMessagePreviewProps) {
  return (
    <div className="max-h-[350px] overflow-y-auto rounded-lg border bg-[#efeae2] relative">
      {/* Subtle WhatsApp pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 5v2M20 33v2M5 20h2M33 20h2M11.5 11.5l1.4 1.4M27.1 27.1l1.4 1.4M11.5 28.5l1.4-1.4M27.1 12.9l1.4-1.4' stroke='%23000' stroke-width='1' fill='none'/%3E%3C/svg%3E")`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Chat area */}
      <div className="relative p-3 min-h-[120px] flex flex-col justify-end">
        {type === "text" && <TextBubble content={content} />}
        {type === "image" && <ImageBubble content={content} mediaUrl={mediaUrl} />}
        {type === "video" && <VideoBubble content={content} />}
        {(type === "audio" || type === "ptt") && <AudioBubble />}
        {type === "document" && <DocumentBubble content={content} docName={docName} />}
      </div>
    </div>
  )
}
