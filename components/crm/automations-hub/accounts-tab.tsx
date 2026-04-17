"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Mail, MessageCircle, Check, Star, Plus, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface SmtpAccount {
  id: string
  email_address: string
  display_name: string
  is_active: boolean
  is_verified: boolean
  is_default: boolean
  created_at: string
}

interface WppInstance {
  id: string
  name: string
  phone: string | null
  connection_status: string
  is_default: boolean
  created_at: string
}

export function AccountsTab() {
  const [smtp, setSmtp] = useState<SmtpAccount[]>([])
  const [wpp, setWpp] = useState<WppInstance[]>([])
  const [isLoading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/consultant/accounts")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      setSmtp(json.smtp ?? [])
      setWpp(json.wpp ?? [])
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  async function setDefault(type: "smtp" | "wpp", id: string) {
    setBusyId(id)
    try {
      const res = await fetch("/api/consultant/accounts/default", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, id }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro")
      toast.success("Conta predefinida actualizada")
      void fetchAll()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading) return <Skeleton className="h-64" />

  const activeSmtp = smtp.filter((s) => s.is_active)
  const connectedWpp = wpp.filter((w) => w.connection_status === "connected")
  const currentSmtp = activeSmtp.find((s) => s.is_default) ?? activeSmtp[0] ?? null
  const currentWpp = connectedWpp.find((w) => w.is_default) ?? connectedWpp[0] ?? null

  return (
    <div className="space-y-6">
      {/* ═══ Contas de Email ═══ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Contas de Email
          </h3>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link href="/dashboard/email">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Gerir contas
            </Link>
          </Button>
        </div>

        {activeSmtp.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed text-center">
            <Mail className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium mb-1">Sem contas de email activas</p>
            <p className="text-xs text-muted-foreground mb-4">
              Configure uma conta de email para enviar automatismos.
            </p>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/dashboard/email">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Configurar Email
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            {activeSmtp.map((acc) => {
              const isCurrent = currentSmtp?.id === acc.id
              return (
                <div
                  key={acc.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 transition-colors",
                    isCurrent ? "border-primary/40 bg-primary/5" : "border-border",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isCurrent ? (
                      <Star className="h-4 w-4 text-primary shrink-0 fill-primary" />
                    ) : (
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{acc.display_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{acc.email_address}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!acc.is_verified && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Não verificada
                      </Badge>
                    )}
                    {isCurrent ? (
                      <Badge variant="default" className="gap-1 rounded-full">
                        <Check className="h-3 w-3" />
                        Predefinida
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={busyId === acc.id}
                        onClick={() => void setDefault("smtp", acc.id)}
                      >
                        Definir como predefinida
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ═══ Instâncias WhatsApp ═══ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Instâncias WhatsApp
          </h3>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link href="/dashboard/automacao/instancias">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Gerir instâncias
            </Link>
          </Button>
        </div>

        {connectedWpp.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium mb-1">Sem instâncias WhatsApp conectadas</p>
            <p className="text-xs text-muted-foreground mb-4">
              Configure uma instância WhatsApp para enviar automatismos.
            </p>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/dashboard/automacao/instancias">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Configurar WhatsApp
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            {connectedWpp.map((inst) => {
              const isCurrent = currentWpp?.id === inst.id
              return (
                <div
                  key={inst.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 transition-colors",
                    isCurrent ? "border-primary/40 bg-primary/5" : "border-border",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isCurrent ? (
                      <Star className="h-4 w-4 text-primary shrink-0 fill-primary" />
                    ) : (
                      <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{inst.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {inst.phone ?? "Sem número"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300 rounded-full">
                      Conectada
                    </Badge>
                    {isCurrent ? (
                      <Badge variant="default" className="gap-1 rounded-full">
                        <Check className="h-3 w-3" />
                        Predefinida
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={busyId === inst.id}
                        onClick={() => void setDefault("wpp", inst.id)}
                      >
                        Definir como predefinida
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
