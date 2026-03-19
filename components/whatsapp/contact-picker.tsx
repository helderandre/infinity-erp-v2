"use client"

import { useState } from "react"
import { UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface ContactPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: (name: string, phone: string, organization?: string, email?: string) => void
}

export function ContactPicker({ open, onOpenChange, onSend }: ContactPickerProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [organization, setOrganization] = useState("")
  const [email, setEmail] = useState("")

  const reset = () => {
    setName("")
    setPhone("")
    setOrganization("")
    setEmail("")
  }

  const canSend = name.trim().length > 0 && phone.trim().length > 0

  const handleSend = () => {
    if (!canSend) return
    onSend(
      name.trim(),
      phone.trim(),
      organization.trim() || undefined,
      email.trim() || undefined,
    )
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-blue-600" />
            Enviar Contacto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="contact-name">Nome *</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="contact-phone">Telemóvel *</Label>
            <Input
              id="contact-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+351 912 345 678"
            />
          </div>

          <div>
            <Label htmlFor="contact-org">Organização</Label>
            <Input
              id="contact-org"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Empresa (opcional)"
            />
          </div>

          <div>
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.pt (opcional)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset() }}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            Enviar Contacto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
