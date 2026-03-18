'use client'

import { useState, useMemo } from 'react'
import { useEmailAccount } from '@/hooks/use-email-account'
import { useEmailInbox, useEmailMessage } from '@/hooks/use-email-inbox'
import { FolderSidebar } from '@/components/email/inbox/folder-sidebar'
import { MessageList } from '@/components/email/inbox/message-list'
import { MessageView } from '@/components/email/inbox/message-view'
import { ComposeEmailDialog } from '@/components/email/compose-email-dialog'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PenSquare,
  Mail,
  Settings,
  ArrowLeft,
  Folder,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import type { FullMessage } from '@/hooks/use-email-inbox'

export default function EmailInboxPage() {
  const {
    accounts,
    isEmailAdmin,
    selectedAccount,
    selectedAccountId,
    setSelectedAccountId,
    isLoading: accountLoading,
  } = useEmailAccount()

  const inbox = useEmailInbox(selectedAccountId)
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const { message, isLoading: messageLoading, error: messageError } = useEmailMessage(
    selectedUid,
    inbox.folder,
    selectedAccountId
  )

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<FullMessage | null>(null)
  const [forwardMsg, setForwardMsg] = useState<FullMessage | null>(null)

  // Mobile: show message view when a message is selected
  const [mobileView, setMobileView] = useState<'list' | 'message'>('list')

  // Group accounts by consultant for admin view
  const groupedAccounts = useMemo(() => {
    if (!isEmailAdmin) return null
    const groups = new Map<string, typeof accounts>()
    for (const acc of accounts) {
      const key = acc.consultant_name || 'Sem consultor'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(acc)
    }
    return groups
  }, [accounts, isEmailAdmin])

  function handleSelectMessage(uid: number) {
    setSelectedUid(uid)
    setMobileView('message')
    inbox.markRead(uid)
  }

  function handleReply(msg: FullMessage) {
    setReplyTo(msg)
    setForwardMsg(null)
    setComposeOpen(true)
  }

  function handleForward(msg: FullMessage) {
    setForwardMsg(msg)
    setReplyTo(null)
    setComposeOpen(true)
  }

  function handleNewEmail() {
    setReplyTo(null)
    setForwardMsg(null)
    setComposeOpen(true)
  }

  function handleBack() {
    setSelectedUid(null)
    setMobileView('list')
  }

  function handleAccountChange(accountId: string) {
    setSelectedAccountId(accountId)
    setSelectedUid(null)
    setMobileView('list')
  }

  // Move to folder
  const [moveDialogUid, setMoveDialogUid] = useState<number | null>(null)

  async function handleDelete(uid: number) {
    const ok = await inbox.deleteMessage(uid)
    if (ok) {
      toast.success('Mensagem eliminada')
      if (selectedUid === uid) {
        setSelectedUid(null)
        setMobileView('list')
      }
    } else {
      toast.error('Erro ao eliminar mensagem')
    }
  }

  async function handleArchive(uid: number) {
    const ok = await inbox.archiveMessage(uid)
    if (ok) {
      toast.success('Mensagem arquivada')
      if (selectedUid === uid) {
        setSelectedUid(null)
        setMobileView('list')
      }
    } else {
      toast.error('Erro ao arquivar mensagem')
    }
  }

  async function handleMoveToFolder(uid: number, destination: string) {
    const ok = await inbox.moveToFolder(uid, destination)
    if (ok) {
      toast.success('Mensagem movida')
      setMoveDialogUid(null)
      if (selectedUid === uid) {
        setSelectedUid(null)
        setMobileView('list')
      }
    } else {
      toast.error('Erro ao mover mensagem')
    }
  }

  // ─── Account not configured ──────────────────────────────────
  if (accountLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="rounded-full bg-muted p-4">
          <Mail className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Email não configurado</h2>
          <p className="text-muted-foreground mt-1 max-w-md">
            Para usar o email profissional, configure primeiro a sua conta de email
            nas definições.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/definicoes/email">
            <Settings className="mr-2 h-4 w-4" />
            Configurar Email
          </Link>
        </Button>
      </div>
    )
  }

  // ─── Main inbox layout ───────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile back button */}
            {mobileView === 'message' && (
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden h-8 w-8"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-semibold">Email</h1>
              </div>

              {/* Account selector */}
              {accounts.length > 1 ? (
                <Select value={selectedAccountId ?? ''} onValueChange={handleAccountChange}>
                  <SelectTrigger className="h-8 w-auto min-w-[200px] max-w-[320px] text-xs">
                    <SelectValue placeholder="Seleccionar conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {groupedAccounts ? (
                      // Admin view: grouped by consultant
                      Array.from(groupedAccounts.entries()).map(([consultantName, accs]) => (
                        <SelectGroup key={consultantName}>
                          <SelectLabel className="flex items-center gap-1.5 text-xs">
                            <Users className="h-3 w-3" />
                            {consultantName}
                          </SelectLabel>
                          {accs.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id} className="text-xs">
                              {acc.display_name} &lt;{acc.email_address}&gt;
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))
                    ) : (
                      // Regular user: flat list
                      accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id} className="text-xs">
                          {acc.display_name} &lt;{acc.email_address}&gt;
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {selectedAccount?.email_address}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleNewEmail} disabled={!selectedAccount}>
              <PenSquare className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Novo Email</span>
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" asChild>
              <Link href="/dashboard/definicoes/email">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Body: 3-column resizable layout (desktop) / stacked (mobile) */}

        {/* Mobile layout */}
        <div className="flex-1 flex overflow-hidden sm:hidden">
          <div className={`w-full ${mobileView === 'message' ? 'hidden' : ''}`}>
            <MessageList
              messages={inbox.messages}
              total={inbox.total}
              page={inbox.page}
              limit={inbox.limit}
              isLoading={inbox.isLoading}
              selectedUid={selectedUid}
              searchQuery={inbox.searchQuery}
              isSearching={inbox.isSearching}
              onSelect={handleSelectMessage}
              onPageChange={inbox.changePage}
              onRefresh={inbox.refresh}
              onToggleFlag={inbox.toggleFlag}
              onSearch={inbox.search}
              onClearSearch={inbox.clearSearch}
            />
          </div>
          <div className={`w-full ${mobileView === 'list' ? 'hidden' : ''}`}>
            <MessageView
              message={message}
              isLoading={messageLoading}
              error={messageError}
              onReply={handleReply}
              onForward={handleForward}
              onBack={handleBack}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onMoveToFolder={(uid) => setMoveDialogUid(uid)}
            />
          </div>
        </div>

        {/* Desktop resizable layout */}
        <div className="flex-1 min-h-0 hidden sm:flex">
          <ResizablePanelGroup orientation="horizontal" className="h-full">
            {/* Folders panel */}
            <ResizablePanel defaultSize="10%" minSize="8%" maxSize="18%">
              <div className="h-full overflow-hidden">
                <FolderSidebar
                  folders={inbox.folders}
                  activeFolder={inbox.folder}
                  onFolderChange={(path) => {
                    inbox.changeFolder(path)
                    setSelectedUid(null)
                  }}
                  isLoading={inbox.foldersLoading}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Message list panel */}
            <ResizablePanel defaultSize="16%" minSize="15%" maxSize="30%">
              <div className="h-full overflow-hidden">
                <MessageList
                  messages={inbox.messages}
                  total={inbox.total}
                  page={inbox.page}
                  limit={inbox.limit}
                  isLoading={inbox.isLoading}
                  selectedUid={selectedUid}
                  searchQuery={inbox.searchQuery}
                  isSearching={inbox.isSearching}
                  onSelect={handleSelectMessage}
                  onPageChange={inbox.changePage}
                  onRefresh={inbox.refresh}
                  onToggleFlag={inbox.toggleFlag}
                  onSearch={inbox.search}
                  onClearSearch={inbox.clearSearch}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Message view panel */}
            <ResizablePanel defaultSize="50%" minSize="25%">
              <div className="h-full overflow-hidden">
                <MessageView
                  message={message}
                  isLoading={messageLoading}
                  error={messageError}
                  onReply={handleReply}
                  onForward={handleForward}
                  onBack={handleBack}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                  onMoveToFolder={(uid) => setMoveDialogUid(uid)}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      {/* Move to folder dialog */}
      <Dialog open={moveDialogUid !== null} onOpenChange={(open) => !open && setMoveDialogUid(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover para pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {inbox.folders
              .filter((f) => f.path !== inbox.folder)
              .map((f) => (
                <Button
                  key={f.path}
                  variant="ghost"
                  className="w-full justify-start gap-2 text-sm"
                  onClick={() => moveDialogUid && handleMoveToFolder(moveDialogUid, f.path)}
                >
                  <Folder className="h-4 w-4 shrink-0" />
                  {f.name}
                </Button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Compose dialog */}
      <ComposeEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        replyTo={replyTo}
        forwardMessage={forwardMsg}
        senderEmail={selectedAccount?.email_address}
        senderName={selectedAccount?.display_name}
        accountId={selectedAccountId}
        onSent={inbox.refresh}
      />
    </TooltipProvider>
  )
}
