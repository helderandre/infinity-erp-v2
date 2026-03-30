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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { ContactDialog } from '@/components/leads/contact-dialog'

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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Plus className="h-4 w-4" />
            <span className="sr-only">Acções rápidas</span>
          </Button>
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

      <ContactDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        onComplete={(id) => {
          setContactOpen(false)
          router.push(`/dashboard/leads/${id}`)
        }}
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
