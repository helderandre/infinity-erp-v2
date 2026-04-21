"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Mail, MessageCircle, Check, Star, Plus, ExternalLink,
  Phone, Clock, PlugZap, MoreHorizontal, WifiOff, RefreshCw, Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { InstanceConnectionSheet } from "@/components/automations/instance-connection-sheet"
import { useWhatsAppInstances } from "@/hooks/use-whatsapp-instances"

interface SmtpAccount {
  id: string
  email_address: string
  display_name: string
  smtp_host: string | null
  is_active: boolean
  is_verified: boolean
  is_default: boolean
  created_at: string
}

interface WppInstance {
  id: string
  name: string
  phone: string | null
  profile_name: string | null
  profile_pic_url: string | null
  connection_status: string
  is_default: boolean
  created_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return "Criado hoje"
  if (days === 1) return "Criado há 1 dia"
  if (days < 30) return `Criado há ${days} dias`
  const months = Math.floor(days / 30)
  if (months === 1) return "Criado há 1 mês"
  return `Criado há ${months} meses`
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export function AccountsTab() {
  const [smtp, setSmtp] = useState<SmtpAccount[]>([])
  const [wpp, setWpp] = useState<WppInstance[]>([])
  const [isLoading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [connectId, setConnectId] = useState<string | null>(null)
  const [connectName, setConnectName] = useState("")
  const [emailMuted, setEmailMuted] = useState(false)
  const [wppMuted, setWppMuted] = useState(false)
  const [emailMuteId, setEmailMuteId] = useState<string | null>(null)
  const [wppMuteId, setWppMuteId] = useState<string | null>(null)
  const [togglingChannel, setTogglingChannel] = useState<string | null>(null)
  const { connectInstance, checkStatus, disconnectInstance } = useWhatsAppInstances()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [accountsRes, mutesRes] = await Promise.all([
        fetch("/api/consultant/accounts"),
        fetch("/api/contact-automation-mutes"),
      ])
      const json = accountsRes.ok ? await accountsRes.json() : { smtp: [], wpp: [] }
      setSmtp(json.smtp ?? [])
      setWpp(json.wpp ?? [])

      // Check for global channel mutes (consultant-wide, no lead, no event_type)
      const mutesData = mutesRes.ok ? await mutesRes.json() : []
      const allMutes = Array.isArray(mutesData) ? mutesData : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emailMute = allMutes.find((m: any) => m.channel === "email" && !m.lead_id && !m.event_type)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wppMute = allMutes.find((m: any) => m.channel === "whatsapp" && !m.lead_id && !m.event_type)
      setEmailMuted(!!emailMute)
      setEmailMuteId(emailMute?.id ?? null)
      setWppMuted(!!wppMute)
      setWppMuteId(wppMute?.id ?? null)
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

  async function toggleChannel(channel: "email" | "whatsapp") {
    const isMuted = channel === "email" ? emailMuted : wppMuted
    const muteId = channel === "email" ? emailMuteId : wppMuteId
    setTogglingChannel(channel)
    try {
      if (isMuted && muteId) {
        // Remove mute → activate channel
        const res = await fetch(`/api/contact-automation-mutes?id=${muteId}`, { method: "DELETE" })
        if (!res.ok) throw new Error()
        toast.success(`Canal ${channel === "email" ? "Email" : "WhatsApp"} activado`)
      } else {
        // Create mute → deactivate channel
        const res = await fetch("/api/contact-automation-mutes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel, lead_id: null, event_type: null }),
        })
        if (!res.ok) throw new Error()
        toast.success(`Canal ${channel === "email" ? "Email" : "WhatsApp"} desactivado`)
      }
      void fetchAll()
    } catch {
      toast.error("Erro ao alterar estado do canal")
    } finally {
      setTogglingChannel(null)
    }
  }

  const hasActiveSmtp = smtp.some((s) => s.is_active && s.is_verified)
  const hasConnectedWpp = wpp.some((w) => w.connection_status === "connected")

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ═══ Contas de Email ═══ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Contas de Email
            </h3>
            <div className="flex items-center gap-2">
              {togglingChannel === "email" ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={!emailMuted && hasActiveSmtp}
                  disabled={!hasActiveSmtp}
                  onCheckedChange={() => toggleChannel("email")}
                  title={!hasActiveSmtp ? "Configure uma conta de email primeiro" : emailMuted ? "Activar canal Email" : "Desactivar canal Email"}
                />
              )}
              <span className="text-xs text-muted-foreground">
                {!hasActiveSmtp ? "Sem conta" : emailMuted ? "Desactivado" : "Activo"}
              </span>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link href="/dashboard/email">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Gerir contas
            </Link>
          </Button>
        </div>

        {smtp.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed text-center">
            <Mail className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium mb-1">Sem contas de email</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {smtp.map((acc) => {
              const isCurrent = acc.is_default
              const statusColor = acc.is_active && acc.is_verified
                ? "text-emerald-600"
                : acc.is_active
                  ? "text-amber-600"
                  : "text-red-500"
              const statusLabel = acc.is_active && acc.is_verified
                ? "Activa"
                : acc.is_active
                  ? "Não verificada"
                  : "Inactiva"

              return (
                <div
                  key={acc.id}
                  className={cn(
                    "flex flex-col rounded-xl border bg-card transition-all hover:shadow-md",
                    isCurrent && "ring-1 ring-primary/30",
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 p-4 pb-3">
                    <div className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold border-2",
                      acc.is_active ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-slate-50 text-slate-500",
                    )}>
                      {getInitials(acc.display_name || "EM")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{acc.display_name}</span>
                        <span className={cn("flex items-center gap-1 text-[11px] font-medium", statusColor)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusColor.replace("text-", "bg-"))} />
                          {statusLabel}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{acc.email_address}</p>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 pb-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{acc.smtp_host ?? "SMTP"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>{timeAgo(acc.created_at)}</span>
                    </div>
                    {isCurrent && (
                      <div className="flex items-center gap-1.5 col-span-2">
                        <Star className="h-3 w-3 text-primary fill-primary" />
                        <span className="text-primary font-medium">Conta predefinida</span>
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  <div className="px-4 pb-4 mt-auto">
                    {!acc.is_active ? (
                      <Button asChild className="w-full rounded-full" variant="default">
                        <Link href="/dashboard/email">
                          <PlugZap className="h-4 w-4 mr-1.5" />
                          Activar
                        </Link>
                      </Button>
                    ) : !isCurrent ? (
                      <Button
                        className="w-full rounded-full"
                        variant="outline"
                        disabled={busyId === acc.id}
                        onClick={() => void setDefault("smtp", acc.id)}
                      >
                        <Star className="h-4 w-4 mr-1.5" />
                        Definir como predefinida
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ═══ Instâncias WhatsApp ═══ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Instâncias WhatsApp
            </h3>
            <div className="flex items-center gap-2">
              {togglingChannel === "whatsapp" ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={!wppMuted && hasConnectedWpp}
                  disabled={!hasConnectedWpp}
                  onCheckedChange={() => toggleChannel("whatsapp")}
                  title={!hasConnectedWpp ? "Conecte uma instância primeiro" : wppMuted ? "Activar canal WhatsApp" : "Desactivar canal WhatsApp"}
                />
              )}
              <span className="text-xs text-muted-foreground">
                {!hasConnectedWpp ? "Sem instância" : wppMuted ? "Desactivado" : "Activo"}
              </span>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link href="/dashboard/automacao/instancias">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Gerir instâncias
            </Link>
          </Button>
        </div>

        {wpp.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium mb-1">Sem instâncias WhatsApp</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {wpp.map((inst) => {
              const isCurrent = inst.is_default
              const isConnected = inst.connection_status === "connected"
              const statusColor = isConnected ? "text-emerald-600" : "text-red-500"
              const statusLabel = isConnected ? "Conectado" : "Desconectado"

              return (
                <div
                  key={inst.id}
                  className={cn(
                    "flex flex-col rounded-xl border bg-card transition-all hover:shadow-md",
                    isCurrent && "ring-1 ring-primary/30",
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 p-4 pb-3">
                    <div className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold border-2 overflow-hidden",
                      isConnected ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-slate-50 text-slate-500",
                    )}>
                      {inst.profile_pic_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={inst.profile_pic_url}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                            e.currentTarget.parentElement!.textContent = getInitials(inst.name || "WP")
                          }}
                        />
                      ) : (
                        getInitials(inst.name || "WP")
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{inst.name}</span>
                        <span className={cn("flex items-center gap-1 text-[11px] font-medium", statusColor)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusColor.replace("text-", "bg-"))} />
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    {/* 3-dot menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              await checkStatus(inst.id)
                              toast.success("Estado verificado")
                              void fetchAll()
                            } catch {
                              toast.error("Erro ao verificar estado")
                            }
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-2" />
                          Verificar estado
                        </DropdownMenuItem>
                        {isConnected && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={async () => {
                              try {
                                await disconnectInstance(inst.id)
                                toast.success("Instância desconectada")
                                void fetchAll()
                              } catch {
                                toast.error("Erro ao desconectar")
                              }
                            }}
                          >
                            <WifiOff className="h-3.5 w-3.5 mr-2" />
                            Desconectar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Info rows */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 pb-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />
                      <span className="truncate">{inst.phone ?? "Sem número"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>{timeAgo(inst.created_at)}</span>
                    </div>
                    {isCurrent && (
                      <div className="flex items-center gap-1.5 col-span-2">
                        <Star className="h-3 w-3 text-primary fill-primary" />
                        <span className="text-primary font-medium">Instância predefinida</span>
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  <div className="px-4 pb-4 mt-auto">
                    {!isConnected ? (
                      <Button
                        className="w-full rounded-full"
                        variant="default"
                        onClick={() => { setConnectId(inst.id); setConnectName(inst.name) }}
                      >
                        <PlugZap className="h-4 w-4 mr-1.5" />
                        Conectar
                      </Button>
                    ) : !isCurrent ? (
                      <Button
                        className="w-full rounded-full"
                        variant="outline"
                        disabled={busyId === inst.id}
                        onClick={() => void setDefault("wpp", inst.id)}
                      >
                        <Star className="h-4 w-4 mr-1.5" />
                        Definir como predefinida
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ═══ Connection Sheet (inline, sem redirect) ═══ */}
      <InstanceConnectionSheet
        open={!!connectId}
        onOpenChange={(open) => { if (!open) setConnectId(null) }}
        instanceId={connectId}
        instanceName={connectName}
        onConnect={async (id, phone) => await connectInstance(id, phone)}
        onCheckStatus={async (id) => await checkStatus(id)}
        onSuccess={async () => {
          // Forçar verificação de estado no DB antes de refrescar a lista
          if (connectId) {
            try { await checkStatus(connectId) } catch { /* ignore */ }
          }
          setConnectId(null)
          // Pequeno delay para garantir que o DB propagou
          setTimeout(() => void fetchAll(), 500)
        }}
      />
    </div>
  )
}
