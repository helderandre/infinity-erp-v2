"use client"

import { useRef, useEffect } from "react"
import {
  Phone,
  MoreVertical,
  Check,
  CheckCheck,
  Mic,
  Play,
  FileText,
  ImageIcon,
  Video,
} from "lucide-react"
import type { WhatsAppTemplateMessage } from "@/lib/types/whatsapp-template"
import { renderTemplate } from "@/lib/template-engine"

interface WppPreviewProps {
  messages: WhatsAppTemplateMessage[]
  variables: Record<string, string>
  contactName?: string
  contactPhoto?: string
}

const MESSAGE_TYPE_ICON: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Mic,
  ptt: Mic,
  document: FileText,
}

function formatWhatsAppText(text: string) {
  return text
    .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/~(.*?)~/g, "<del>$1</del>")
    .replace(/\n/g, "<br/>")
}

function MessageBubble({
  message,
  variables,
  index,
}: {
  message: WhatsAppTemplateMessage
  variables: Record<string, string>
  index: number
}) {
  const resolvedContent = message.content
    ? renderTemplate(message.content, variables)
    : ""

  const time = new Date()
  time.setMinutes(time.getMinutes() + index)
  const timeStr = time.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="flex justify-end mb-1.5">
      <div className="max-w-[85%] rounded-lg bg-[#d9fdd3] dark:bg-[#005c4b] px-2 py-1.5 shadow-sm">
        {/* Media preview */}
        {message.type === "image" && (
          <div className="mb-1 rounded-md overflow-hidden bg-emerald-200/40 dark:bg-emerald-900/30 flex items-center justify-center h-32">
            {message.mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={message.mediaUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-emerald-600/50" />
            )}
          </div>
        )}

        {message.type === "video" && (
          <div className="mb-1 rounded-md overflow-hidden bg-emerald-200/40 dark:bg-emerald-900/30 flex items-center justify-center h-32 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/40 p-2">
                <Play className="h-5 w-5 text-white fill-white" />
              </div>
            </div>
            <Video className="h-8 w-8 text-emerald-600/50" />
          </div>
        )}

        {(message.type === "audio" || message.type === "ptt") && (
          <div className="flex items-center gap-2 py-1 px-1">
            <div className="rounded-full bg-emerald-500 p-1.5">
              <Play className="h-3 w-3 text-white fill-white" />
            </div>
            <div className="flex-1 flex items-center gap-0.5">
              {Array.from({ length: 28 }).map((_, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-emerald-700/40 dark:bg-emerald-300/40 rounded-full"
                  style={{
                    height: `${4 + Math.random() * 12}px`,
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              0:12
            </span>
          </div>
        )}

        {message.type === "document" && (
          <div className="mb-1 rounded-md bg-emerald-200/30 dark:bg-emerald-900/20 p-2.5 flex items-center gap-2">
            <FileText className="h-8 w-8 text-red-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">
                {message.docName || "documento.pdf"}
              </p>
              <p className="text-[10px] text-gray-500">PDF</p>
            </div>
          </div>
        )}

        {/* Text content */}
        {resolvedContent && (
          <p
            className="text-[13px] leading-[18px] text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{
              __html: formatWhatsAppText(resolvedContent),
            }}
          />
        )}

        {/* Timestamp + check marks */}
        <div className="flex items-center justify-end gap-0.5 -mb-0.5 mt-0.5">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {timeStr}
          </span>
          <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
        </div>
      </div>
    </div>
  )
}

export function WppPreview({
  messages,
  variables,
  contactName = "Contacto",
  contactPhoto,
}: WppPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, variables])

  return (
    <div className="w-full max-w-[320px] mx-auto">
      {/* Phone frame */}
      <div className="rounded-2xl border-2 border-gray-300 dark:border-gray-600 bg-[#efeae2] dark:bg-[#0b141a] overflow-hidden shadow-xl">
        {/* WhatsApp header */}
        <div className="bg-[#008069] dark:bg-[#1f2c34] px-3 py-2.5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center overflow-hidden shrink-0">
            {contactPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contactPhoto}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Phone className="h-4 w-4 text-gray-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {contactName}
            </p>
            <p className="text-emerald-200 text-[10px]">online</p>
          </div>
          <MoreVertical className="h-4 w-4 text-white/70" />
        </div>

        {/* Chat area */}
        <div
          ref={scrollRef}
          className="h-[380px] overflow-y-auto px-2.5 py-3 space-y-0.5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Adicione mensagens para ver o preview
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                variables={variables}
                index={i}
              />
            ))
          )}
        </div>

        {/* Input bar */}
        <div className="bg-[#f0f2f5] dark:bg-[#1f2c34] px-2 py-1.5 flex items-center gap-1.5">
          <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-full px-3 py-1.5">
            <p className="text-xs text-gray-400">Mensagem</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#008069] flex items-center justify-center">
            <Mic className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>
    </div>
  )
}
