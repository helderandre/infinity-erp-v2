"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/kibo-ui/spinner"

interface User {
  id: string
  commercial_name: string
}

interface CreateInstanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (params: { name: string; user_id?: string }) => Promise<void>
}

export function CreateInstanceDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateInstanceDialogProps) {
  const [name, setName] = useState("")
  const [userId, setUserId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    if (!open) {
      setName("")
      setUserId("")
      return
    }

    let cancelled = false
    async function loadUsers() {
      setLoadingUsers(true)
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const { data } = await supabase
          .from("dev_users")
          .select("id, commercial_name")
          .eq("is_active", true)
          .order("commercial_name")
        if (!cancelled && data) {
          setUsers(
            data.map((u) => ({
              id: u.id,
              commercial_name: u.commercial_name || "Sem nome",
            }))
          )
        }
      } catch {
        // Ignorar — lista de utilizadores é opcional
      } finally {
        if (!cancelled) setLoadingUsers(false)
      }
    }
    loadUsers()
    return () => {
      cancelled = true
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      await onSubmit({
        name: name.trim(),
        user_id: userId && userId !== "none" ? userId : undefined,
      })
      onOpenChange(false)
    } catch {
      // Error handled by parent via toast
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nova Instância WhatsApp</DialogTitle>
          <DialogDescription>
            Crie uma nova instância para conectar um número de WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance-name">Nome da instância *</Label>
            <Input
              id="instance-name"
              placeholder="Ex: WhatsApp Comercial"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instance-user">Utilizador responsável</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="instance-user">
                <SelectValue
                  placeholder={loadingUsers ? "A carregar..." : "Nenhum (opcional)"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Spinner variant="infinite" size={16} className="mr-2" />}
              Criar Instância
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
