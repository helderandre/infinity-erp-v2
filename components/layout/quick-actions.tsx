'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Building2,
  Users,
  UserCircle,
  FileText,
  Mail,
  Zap,
  Handshake,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { AcquisitionDialog } from '@/components/acquisitions/acquisition-dialog'
import { DealDialog } from '@/components/deals/deal-dialog'

export function QuickActions() {
  const router = useRouter()
  const [acquisitionOpen, setAcquisitionOpen] = useState(false)
  const [fechoOpen, setFechoOpen] = useState(false)

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
          <DropdownMenuItem onClick={() => setAcquisitionOpen(true)}>
            <Zap className="mr-2 h-4 w-4" />
            Nova Angariação
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFechoOpen(true)}>
            <Handshake className="mr-2 h-4 w-4" />
            Novo Fecho
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/leads/novo')}>
            <Users className="mr-2 h-4 w-4" />
            Novo Lead
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/imoveis/novo')}>
            <Building2 className="mr-2 h-4 w-4" />
            Novo Imóvel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/proprietarios/novo')}>
            <UserCircle className="mr-2 h-4 w-4" />
            Novo Proprietário
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileText className="mr-2 h-4 w-4" />
              Novo Template
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => router.push('/dashboard/templates/documentos/novo')}>
                <FileText className="mr-2 h-4 w-4" />
                Documentos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/templates/emails/novo')}>
                <Mail className="mr-2 h-4 w-4" />
                Email
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

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
    </>
  )
}
