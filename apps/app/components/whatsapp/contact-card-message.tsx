"use client"

import { User, Copy, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { parseVCard } from "@/lib/utils/vcard"
import type { WppMessage } from "@/lib/types/whatsapp-web"

interface ContactCardMessageProps {
  message: WppMessage
}

export function ContactCardMessage({ message }: ContactCardMessageProps) {
  const vcard = message.vcard
  const parsed = vcard ? parseVCard(vcard) : null
  const name = parsed?.fullName || message.text || "Contacto"
  const phone = parsed?.phones?.[0]?.number
  const org = parsed?.organization
  const email = parsed?.email

  const copyPhone = () => {
    if (phone) {
      navigator.clipboard.writeText(phone)
      toast.success("Número copiado")
    }
  }

  return (
    <div className="min-w-[240px] max-w-[300px]">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{name}</p>
          {org && (
            <p className="text-xs text-muted-foreground truncate">{org}</p>
          )}
          {phone && (
            <div className="flex items-center gap-1 mt-1">
              <p className="text-xs text-muted-foreground">{phone}</p>
              <button onClick={copyPhone} className="text-muted-foreground hover:text-foreground transition-colors">
                <Copy className="h-3 w-3" />
              </button>
            </div>
          )}
          {email && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{email}</p>
          )}
        </div>
      </div>

      {phone && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-1 text-xs text-emerald-600 hover:text-emerald-700"
          onClick={() => {
            const waid = parsed?.phones?.[0]?.waid
            if (waid) {
              window.open(`/dashboard/whatsapp?chat=${waid}@s.whatsapp.net`, '_blank')
            }
          }}
        >
          <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
          Enviar mensagem
        </Button>
      )}
    </div>
  )
}
