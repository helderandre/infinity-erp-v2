'use client'

import { useState, useEffect } from 'react'
import { Clock, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export function WhatsAppActivitySettings() {
  const [gapHours, setGapHours] = useState('18')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetch('/api/crm/settings')
      .then((r) => r.json())
      .then((data) => {
        const gap = data.settings?.find((s: any) => s.key === 'whatsapp_activity_gap_hours')
        if (gap) setGapHours(String(gap.value))
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  async function handleSave() {
    const hours = Number(gapHours)
    if (isNaN(hours) || hours < 1 || hours > 168) {
      toast.error('O intervalo deve ser entre 1 e 168 horas')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/crm/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'whatsapp_activity_gap_hours', value: hours }),
      })
      if (!res.ok) throw new Error()
      toast.success('Definição guardada com sucesso')
    } catch {
      toast.error('Erro ao guardar definição')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Sessões de actividade WhatsApp
        </CardTitle>
        <CardDescription>
          Define o intervalo de tempo entre sessões de actividade. Mensagens enviadas dentro deste intervalo são agrupadas numa única sessão de contacto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> A carregar...
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gap-hours" className="text-sm">Intervalo entre sessões</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="gap-hours"
                  type="number"
                  min={1}
                  max={168}
                  value={gapHours}
                  onChange={(e) => setGapHours(e.target.value)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">horas</span>
              </div>
            </div>
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Guardar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
