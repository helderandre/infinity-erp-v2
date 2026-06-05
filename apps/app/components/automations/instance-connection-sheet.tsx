"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, QrCode, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/kibo-ui/spinner"

interface ConnectionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: string | null
  instanceName: string
  onConnect: (instanceId: string, phone?: string) => Promise<{
    mode: "qrcode" | "paircode"
    qrcode?: string | null
    paircode?: string | null
    connected: boolean
    logged_in: boolean
  }>
  onCheckStatus: (instanceId: string) => Promise<{
    connection_status: string
    connected: boolean
    logged_in: boolean
  }>
  onSuccess: () => void
}

export function InstanceConnectionSheet({
  open,
  onOpenChange,
  instanceId,
  instanceName,
  onConnect,
  onCheckStatus,
  onSuccess,
}: ConnectionSheetProps) {
  const [mode, setMode] = useState<"qrcode" | "paircode">("qrcode")
  const [phone, setPhone] = useState("")
  const [qrcode, setQrcode] = useState<string | null>(null)
  const [paircode, setPaircode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [polling, setPolling] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!open) {
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = null
      setPolling(false)
      setQrcode(null)
      setPaircode(null)
      setConnected(false)
      setPhone("")
      setLoading(false)
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [open])

  const startPolling = useCallback(
    (instId: string) => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      setPolling(true)

      pollingRef.current = setInterval(async () => {
        try {
          const status = await onCheckStatus(instId)
          if (status.connected && status.logged_in) {
            if (pollingRef.current) clearInterval(pollingRef.current)
            pollingRef.current = null
            setPolling(false)
            setConnected(true)
            toast.success("WhatsApp conectado com sucesso!")
            onSuccess()
          }
        } catch {
          // Ignorar erros de polling
        }
      }, 5000)
    },
    [onCheckStatus, onSuccess]
  )

  const handleConnect = async (connectMode: "qrcode" | "paircode") => {
    if (!instanceId) return
    setLoading(true)
    setConnected(false)
    setQrcode(null)
    setPaircode(null)

    try {
      const phoneParam = connectMode === "paircode" && phone.trim() ? phone.trim() : undefined
      const result = await onConnect(instanceId, phoneParam)

      if (result.connected && result.logged_in) {
        setConnected(true)
        toast.success("WhatsApp já está conectado!")
        onSuccess()
        return
      }

      if (result.mode === "qrcode" && result.qrcode) {
        setQrcode(result.qrcode)
        setMode("qrcode")
      } else if (result.mode === "paircode" && result.paircode) {
        setPaircode(result.paircode)
        setMode("paircode")
      }

      startPolling(instanceId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao conectar")
    } finally {
      setLoading(false)
    }
  }

  const handleManualCheck = async () => {
    if (!instanceId) return
    setLoading(true)
    try {
      const status = await onCheckStatus(instanceId)
      if (status.connected && status.logged_in) {
        setConnected(true)
        if (pollingRef.current) clearInterval(pollingRef.current)
        setPolling(false)
        toast.success("WhatsApp conectado com sucesso!")
        onSuccess()
      } else {
        toast.info("Ainda não conectado. A aguardar...")
      }
    } catch {
      toast.error("Erro ao verificar estado")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0" side="right">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-100 p-2 shrink-0">
              <Smartphone className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base">Conectar WhatsApp</SheetTitle>
              <p className="text-xs text-muted-foreground truncate">{instanceName}</p>
            </div>
            {polling && (
              <Badge variant="outline" className="ml-auto bg-amber-50 text-amber-700 border-amber-200 text-xs shrink-0">
                A aguardar
              </Badge>
            )}
            {connected && (
              <Badge variant="outline" className="ml-auto bg-emerald-50 text-emerald-700 border-emerald-200 text-xs shrink-0">
                Conectado
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {connected ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
              <p className="text-lg font-medium text-emerald-700">Conectado com sucesso!</p>
              <p className="text-sm text-muted-foreground text-center">
                A instância está pronta para enviar e receber mensagens.
              </p>
            </div>
          ) : (
            <Tabs value={mode} onValueChange={(v) => setMode(v as "qrcode" | "paircode")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="qrcode" className="gap-1.5">
                  <QrCode className="h-3.5 w-3.5" />
                  QR Code
                </TabsTrigger>
                <TabsTrigger value="paircode" className="gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  Código de Par
                </TabsTrigger>
              </TabsList>

              <TabsContent value="qrcode" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Abra o WhatsApp no telemóvel, vá a{" "}
                  <strong>Dispositivos Vinculados</strong> e leia o QR code abaixo.
                </p>

                {qrcode ? (
                  <div className="flex justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 p-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrcode}
                      alt="QR Code WhatsApp"
                      className="h-52 w-52 rounded-lg object-contain"
                    />
                  </div>
                ) : (
                  <Button
                    onClick={() => handleConnect("qrcode")}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <Spinner variant="infinite" size={16} className="mr-2" />
                    ) : (
                      <QrCode className="mr-2 h-4 w-4" />
                    )}
                    Gerar QR Code
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="paircode" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Insira o número de telefone para gerar um código de par.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="phone">Número de telefone</Label>
                  <Input
                    id="phone"
                    placeholder="+351 912 345 678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                {paircode ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 p-8">
                    <p className="text-xs text-muted-foreground">Código de par:</p>
                    <p className="text-3xl font-bold tracking-widest font-mono">{paircode}</p>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Insira este código no WhatsApp do telemóvel
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleConnect("paircode")}
                    disabled={loading || !phone.trim()}
                    className="w-full"
                  >
                    {loading ? (
                      <Spinner variant="infinite" size={16} className="mr-2" />
                    ) : (
                      <Smartphone className="mr-2 h-4 w-4" />
                    )}
                    Gerar Código
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          )}

          {polling && !connected && (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner variant="infinite" size={18} />
                <span>A aguardar conexão...</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="px-4 py-3 border-t shrink-0 flex items-center justify-between gap-3">
          {connected ? (
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleManualCheck}
                disabled={loading || !polling}
              >
                {loading ? (
                  <Spinner variant="infinite" size={16} className="mr-2" />
                ) : null}
                Verificar estado
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
