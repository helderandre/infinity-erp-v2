'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface User {
  id: string
  commercial_name: string
}

interface ProcessTaskAssignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
  taskTitle: string
  processId: string
  currentAssignedTo?: string | null
  onAssigned: () => void
}

export function ProcessTaskAssignDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  processId,
  currentAssignedTo,
  onAssigned,
}: ProcessTaskAssignDialogProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>(currentAssignedTo || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      loadUsers()
      setSelectedUserId(currentAssignedTo || '')
    }
  }, [open, currentAssignedTo])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/users/consultants')
      if (!res.ok) throw new Error('Erro ao carregar utilizadores')
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      toast.error('Erro ao carregar lista de utilizadores')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedUserId) return

    setIsSubmitting(true)
    try {
      const response = await fetch(
        `/api/processes/${processId}/tasks/${taskId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'assign',
            assigned_to: selectedUserId,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atribuir tarefa')
      }

      toast.success('Tarefa atribuída com sucesso!')
      onOpenChange(false)
      onAssigned()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir Tarefa</DialogTitle>
          <DialogDescription>
            Seleccione o utilizador responsável por esta tarefa
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm font-medium mb-3">{taskTitle}</p>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              A carregar utilizadores...
            </div>
          ) : (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar utilizador" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedUserId}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
