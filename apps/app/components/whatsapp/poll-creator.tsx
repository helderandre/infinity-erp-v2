"use client"

import { useState } from "react"
import { Plus, Trash2, BarChart3 } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PollCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: (question: string, options: string[], selectableCount: number) => void
}

const MAX_OPTIONS = 12

export function PollCreator({ open, onOpenChange, onSend }: PollCreatorProps) {
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [selectableCount, setSelectableCount] = useState(1)

  const reset = () => {
    setQuestion("")
    setOptions(["", ""])
    setSelectableCount(1)
  }

  const addOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, ""])
    }
  }

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index: number, value: string) => {
    const updated = [...options]
    updated[index] = value
    setOptions(updated)
  }

  const validOptions = options.filter(o => o.trim().length > 0)
  const canSend = question.trim().length > 0 && validOptions.length >= 2

  const handleSend = () => {
    if (!canSend) return
    onSend(question.trim(), validOptions, selectableCount)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            Criar Sondagem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="poll-question">Pergunta</Label>
            <Input
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Escreva a pergunta..."
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Opções</Label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Opção ${i + 1}`}
                />
                {options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-9 w-9"
                    onClick={() => removeOption(i)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <Button variant="outline" size="sm" onClick={addOption} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Adicionar opção
              </Button>
            )}
          </div>

          <div>
            <Label>Respostas permitidas</Label>
            <Select
              value={String(selectableCount)}
              onValueChange={(v) => setSelectableCount(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: validOptions.length || 1 }, (_, i) => i + 1).map(n => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 1 ? "1 resposta" : `Até ${n} respostas`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset() }}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            Enviar Sondagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
