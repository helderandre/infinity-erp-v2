'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CreditBankList } from '@/components/credit/credit-bank-list'
import { CreditBankForm } from '@/components/credit/credit-bank-form'
import { useCreditBanks } from '@/hooks/use-credit-banks'
import { ArrowLeft, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { CreditBank } from '@/types/credit'

export default function BancosPage() {
  const router = useRouter()
  const { banks, isLoading, addBank, updateBank, deleteBank } = useCreditBanks()
  const [formOpen, setFormOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<CreditBank | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true)
    try {
      if (editingBank) {
        await updateBank(editingBank.id, data)
        toast.success('Banco actualizado com sucesso')
      } else {
        await addBank(data)
        toast.success('Banco adicionado com sucesso')
      }
      setFormOpen(false)
      setEditingBank(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar banco')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (bank: CreditBank) => {
    setEditingBank(bank)
    setFormOpen(true)
  }

  const handleDelete = async (bankId: string) => {
    try {
      await deleteBank(bankId)
      toast.success('Banco desactivado com sucesso')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desactivar banco')
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bancos e Protocolos</h1>
            <p className="text-muted-foreground">
              Gestão de bancos parceiros e protocolos de intermediação
            </p>
          </div>
        </div>
        <Button onClick={() => { setEditingBank(null); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Banco
        </Button>
      </div>

      <CreditBankList
        banks={banks}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CreditBankForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingBank(null) }}
        onSubmit={handleSubmit}
        initialData={editingBank}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
