'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Users,
  Zap,
  Handshake,
  CheckSquare,
  Bug,
  Lightbulb,
  Library,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { AcquisitionDialog } from '@/components/acquisitions/acquisition-dialog'
import { DealDialog } from '@/components/deals/deal-dialog'
import { TaskForm } from '@/components/tasks/task-form'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { LeadEntryDialog } from '@/components/leads/lead-entry-dialog'

export function QuickActions() {
  const router = useRouter()
  const [contactOpen, setContactOpen] = useState(false)
  const [acquisitionOpen, setAcquisitionOpen] = useState(false)
  const [fechoOpen, setFechoOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [ideiaOpen, setIdeiaOpen] = useState(false)
  const [consultants, setConsultants] = useState<Array<{ id: string; commercial_name: string }>>([])

  useEffect(() => {
    fetch('/api/users/consultants')
      .then((res) => res.json())
      .then((data) => setConsultants(data.data || data || []))
      .catch(() => {})
  }, [])

  // Listen for mobile toolbar events
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent).detail
      if (key === 'lead') setContactOpen(true)
      else if (key === 'acquisition') setAcquisitionOpen(true)
      else if (key === 'deal') setFechoOpen(true)
      else if (key === 'task') setTaskOpen(true)
    }
    window.addEventListener('open-quick-action', handler)
    return () => window.removeEventListener('open-quick-action', handler)
  }, [])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-muted/50 transition-colors"
          >
            <Plus className="size-4" />
            <span className="sr-only">Acções rápidas</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setContactOpen(true)}>
            <Users className="mr-2 h-4 w-4" />
            Nova Lead
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAcquisitionOpen(true)}>
            <Zap className="mr-2 h-4 w-4" />
            Nova Angariação
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFechoOpen(true)}>
            <Handshake className="mr-2 h-4 w-4" />
            Novo Fecho
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTaskOpen(true)}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Nova Tarefa
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/documentos')}>
            <Library className="mr-2 h-4 w-4" />
            Documentos e Marketing
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTicketOpen(true)}>
            <Bug className="mr-2 h-4 w-4" />
            Reportar Problema
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIdeiaOpen(true)}>
            <Lightbulb className="mr-2 h-4 w-4" />
            Sugerir Ideia
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LeadEntryDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        onComplete={() => setContactOpen(false)}
      />

      <AcquisitionDialog
        open={acquisitionOpen}
        onOpenChange={setAcquisitionOpen}
        onComplete={(procInstanceId) => {
          setAcquisitionOpen(false)
          router.push(`/dashboard/processos/${procInstanceId}`)
        }}
      />

      <DealDialog
        open={fechoOpen}
        onOpenChange={setFechoOpen}
        onComplete={(dealId) => {
          setFechoOpen(false)
          router.push(`/dashboard/fechos/${dealId}`)
        }}
      />

      <TaskForm
        open={taskOpen}
        onOpenChange={setTaskOpen}
        onSuccess={() => setTaskOpen(false)}
        consultants={consultants}
      />

      <FeedbackDialog
        type="ticket"
        open={ticketOpen}
        onOpenChange={setTicketOpen}
      />

      <FeedbackDialog
        type="ideia"
        open={ideiaOpen}
        onOpenChange={setIdeiaOpen}
      />
    </>
  )
}
