'use client'

import { useState, useCallback } from 'react'
import { Smartphone, Wifi, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { InstanceConnectionSheet } from '@/components/automations/instance-connection-sheet'

interface WppInstance {
  id: string
  name: string
  connection_status: string
  phone?: string | null
  profile_name?: string | null
  profile_pic_url?: string | null
  user_id?: string | null
}

interface WhatsAppSetupProps {
  userId: string
  onInstanceCreated: (instance: WppInstance) => void
}

const API_URL = '/api/automacao/instancias'

export function WhatsAppSetup({ userId, onInstanceCreated }: WhatsAppSetupProps) {
  const [creating, setCreating] = useState(false)
  const [createdInstance, setCreatedInstance] = useState<WppInstance | null>(null)
  const [showConnect, setShowConnect] = useState(false)

  const handleCreate = useCallback(async () => {
    setCreating(true)
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: `WhatsApp`,
          user_id: userId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar instância')

      const instance: WppInstance = {
        id: data.instance.id,
        name: data.instance.name,
        connection_status: 'disconnected',
        user_id: userId,
      }
      setCreatedInstance(instance)
      setShowConnect(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar instância')
    } finally {
      setCreating(false)
    }
  }, [userId])

  const handleConnect = useCallback(async (instanceId: string, phone?: string) => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'connect',
        instance_id: instanceId,
        ...(phone ? { phone } : {}),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao conectar')
    return data
  }, [])

  const handleCheckStatus = useCallback(async (instanceId: string) => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', instance_id: instanceId }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao verificar estado')
    return data
  }, [])

  const handleSuccess = useCallback(() => {
    if (createdInstance) {
      onInstanceCreated({ ...createdInstance, connection_status: 'connected' })
    }
  }, [createdInstance, onInstanceCreated])

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-6 w-fit">
          <Smartphone className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Conectar o seu WhatsApp</h2>
          <p className="text-sm text-muted-foreground">
            Para utilizar o WhatsApp Web no ERP, precisa de conectar o seu telemóvel.
            O processo é rápido e seguro — basta ler um QR code ou usar um código de par.
          </p>
        </div>

        <div className="space-y-3 text-left bg-muted/50 rounded-lg p-4">
          <h3 className="text-sm font-medium">Como funciona:</h3>
          <ol className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
              Clique em &quot;Conectar WhatsApp&quot; abaixo
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
              Abra o WhatsApp no telemóvel → Dispositivos Vinculados
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span>
              Leia o QR code ou insira o código de par
            </li>
          </ol>
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Wifi className="h-4 w-4 mr-2" />
          )}
          Conectar WhatsApp
        </Button>
      </div>

      {/* Connection Sheet */}
      {createdInstance && (
        <InstanceConnectionSheet
          open={showConnect}
          onOpenChange={setShowConnect}
          instanceId={createdInstance.id}
          instanceName={createdInstance.name}
          onConnect={handleConnect}
          onCheckStatus={handleCheckStatus}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
