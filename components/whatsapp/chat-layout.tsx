'use client'

import { useState } from 'react'
import { ChatSidebar } from './chat-sidebar'
import { ChatThread } from './chat-thread'
import { ChatInfoPanel } from './chat-info-panel'
import { EmptyChatState } from './empty-chat-state'

interface WppInstance {
  id: string
  name: string
  connection_status: string
  phone?: string | null
  profile_name?: string | null
  profile_pic_url?: string | null
}

interface ChatLayoutProps {
  instances: WppInstance[]
}

export function ChatLayout({ instances }: ChatLayoutProps) {
  const [selectedInstance, setSelectedInstance] = useState(instances[0]?.id || '')
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

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
        />
      </div>

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
