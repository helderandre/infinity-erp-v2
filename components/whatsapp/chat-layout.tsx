'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { ChatSidebar } from './chat-sidebar'
import { ChatThread } from './chat-thread'
import { ChatInfoPanel } from './chat-info-panel'
import { EmptyChatState } from './empty-chat-state'
import { WhatsAppSetup } from './whatsapp-setup'
import { InstanceConnectionSheet } from '@/components/automations/instance-connection-sheet'
import { CreateInstanceDialog } from '@/components/automations/create-instance-dialog'

interface WppInstance {
  id: string
  name: string
  connection_status: string
  phone?: string | null
  profile_name?: string | null
  profile_pic_url?: string | null
  user_id?: string | null
  is_business?: boolean
  created_at?: string
}

interface ChatLayoutProps {
  instances: WppInstance[]
  userId: string
  isAdmin: boolean
  initialChatId?: string
}

const API_URL = '/api/automacao/instancias'

async function postAction(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro na operação')
  return data
}

export function ChatLayout({ instances: initialInstances, userId, isAdmin, initialChatId }: ChatLayoutProps) {
  const [instances, setInstances] = useState(initialInstances)
  const [selectedInstance, setSelectedInstance] = useState(instances[0]?.id || '')
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialChatId || null)
  const [showInfo, setShowInfo] = useState(false)
  const [connectId, setConnectId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const refetchInstances = useCallback(async () => {
    try {
      const res = await fetch(API_URL)
      const data = await res.json()
      const filtered = (data.instances ?? []).filter(
        (i: WppInstance) => isAdmin || i.user_id === userId
      )
      setInstances(filtered)
      return filtered as WppInstance[]
    } catch {
      return instances
    }
  }, [isAdmin, userId, instances])

  const handleRenameInstance = useCallback(async (id: string, name: string) => {
    await postAction('rename', { instance_id: id, name })
    await refetchInstances()
    toast.success('Nome actualizado com sucesso')
  }, [refetchInstances])

  const handleConnectInstance = useCallback(
    async (instanceId: string, phone?: string) => {
      return await postAction('connect', { instance_id: instanceId, phone })
    }, []
  )

  const handleCheckStatus = useCallback(
    async (instanceId: string) => {
      return await postAction('status', { instance_id: instanceId })
    }, []
  )

  const handleDisconnectInstance = useCallback(async (id: string) => {
    await postAction('disconnect', { instance_id: id })
    await refetchInstances()
    toast.success('Instância desconectada')
  }, [refetchInstances])

  const handleDeleteInstance = useCallback(async (id: string) => {
    await postAction('delete', { instance_id: id })
    const updated = await refetchInstances()
    if (id === selectedInstance) {
      setSelectedInstance(updated[0]?.id || '')
      setSelectedChatId(null)
    }
    toast.success('Instância eliminada com sucesso')
  }, [refetchInstances, selectedInstance])

  const handleCreateInstance = useCallback(async (params: { name: string; user_id?: string }) => {
    const data = await postAction('create', { ...params, user_id: params.user_id ?? userId })
    await refetchInstances()
    toast.success('Instância criada com sucesso')
    return data.instance
  }, [refetchInstances, userId])

  const connectingInstance = instances.find((i) => i.id === connectId)

  // No instances available — show setup
  if (instances.length === 0) {
    return (
      <WhatsAppSetup
        userId={userId}
        onInstanceCreated={(instance) => {
          setInstances([instance])
          setSelectedInstance(instance.id)
        }}
      />
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r flex-shrink-0 flex flex-col">
        <ChatSidebar
          instances={instances}
          selectedInstance={selectedInstance}
          onInstanceChange={(id) => {
            setSelectedInstance(id)
            setSelectedChatId(null)
            setShowInfo(false)
          }}
          selectedChatId={selectedChatId}
          onChatSelect={(id) => {
            setSelectedChatId(id)
            setShowInfo(false)
          }}
          onRenameInstance={handleRenameInstance}
          onConnectInstance={setConnectId}
          onDisconnectInstance={handleDisconnectInstance}
          onDeleteInstance={handleDeleteInstance}
          onCreateInstance={() => setCreateOpen(true)}
        />
      </div>

      {/* Connection Sheet */}
      {connectingInstance && (
        <InstanceConnectionSheet
          open={!!connectId}
          onOpenChange={(open) => { if (!open) setConnectId(null) }}
          instanceId={connectId}
          instanceName={connectingInstance.name}
          onConnect={handleConnectInstance}
          onCheckStatus={handleCheckStatus}
          onSuccess={async () => {
            setConnectId(null)
            await refetchInstances()
          }}
        />
      )}

      {/* Create Dialog */}
      <CreateInstanceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreateInstance}
      />

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedChatId ? (
          <ChatThread
            chatId={selectedChatId}
            instanceId={selectedInstance}
            onToggleInfo={() => setShowInfo((v) => !v)}
          />
        ) : (
          <EmptyChatState />
        )}
      </div>

      {/* Info Panel */}
      {showInfo && selectedChatId && (
        <div className="w-80 border-l flex-shrink-0 overflow-y-auto">
          <ChatInfoPanel
            chatId={selectedChatId}
            instanceId={selectedInstance}
            onClose={() => setShowInfo(false)}
            onChatSelect={(id) => {
              setSelectedChatId(id)
              setShowInfo(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
