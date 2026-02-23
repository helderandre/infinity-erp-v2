'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { NEGOCIO_TIPOS, NEGOCIO_ESTADOS } from '@/lib/constants'
import { NegocioForm } from '@/components/negocios/negocio-form'
import { NegocioMatches } from '@/components/negocios/negocio-matches'
import { NegocioInteressados } from '@/components/negocios/negocio-interessados'
import { NegocioChat } from '@/components/negocios/negocio-chat'
import { QuickFill } from '@/components/negocios/quick-fill'
import { NegocioSummary } from '@/components/negocios/negocio-summary'
import type { NegocioWithLeadBasic } from '@/types/lead'

export default function NegocioDetailPage() {
  const { id: leadId, negocioId } = useParams<{ id: string; negocioId: string }>()
  const router = useRouter()

  const [negocio, setNegocio] = useState<NegocioWithLeadBasic | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({})

  const loadNegocio = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}`)
      if (!res.ok) throw new Error('Negócio não encontrado')
      const data = await res.json()
      setNegocio(data)
      setForm(data)
    } catch {
      toast.error('Erro ao carregar negócio')
      router.push(`/dashboard/leads/${leadId}`)
    } finally {
      setIsLoading(false)
    }
  }, [negocioId, leadId, router])

  useEffect(() => {
    loadNegocio()
  }, [loadNegocio])

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Collect all non-system fields
      const body: Record<string, unknown> = {}
      const skipFields = ['id', 'lead_id', 'created_at', 'lead']
      for (const [key, value] of Object.entries(form)) {
        if (skipFields.includes(key)) continue
        body[key] = value ?? null
      }

      const res = await fetch(`/api/negocios/${negocioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao guardar')
      }

      toast.success('Negócio actualizado com sucesso')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao guardar')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (!negocio) return null

  const tipo = (form.tipo as string) || negocio.tipo
  const showMatches = tipo === 'Compra' || tipo === 'Compra e Venda'
  const showInteressados = tipo === 'Venda'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/leads/${leadId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Negócio — {negocio.lead?.nome || 'Lead'}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{tipo}</Badge>
              <Badge variant="outline">{(form.estado as string) || 'Aberto'}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="detalhes">
        <TabsList>
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
          <TabsTrigger value="chat">Assistente IA</TabsTrigger>
          <TabsTrigger value="quickfill">Preenchimento Rápido</TabsTrigger>
          {showMatches && <TabsTrigger value="matching">Matching</TabsTrigger>}
          {showInteressados && <TabsTrigger value="interessados">Interessados</TabsTrigger>}
        </TabsList>

        {/* Tab 1 - Detalhes */}
        <TabsContent value="detalhes" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tipo e Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo</label>
                  <Select value={tipo} onValueChange={(v) => updateField('tipo', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NEGOCIO_TIPOS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select value={(form.estado as string) || 'Aberto'} onValueChange={(v) => updateField('estado', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NEGOCIO_ESTADOS.map((e) => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Critérios do Negócio</CardTitle>
            </CardHeader>
            <CardContent>
              <NegocioForm
                tipo={tipo}
                form={form}
                updateField={updateField}
              />
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar Negócio
          </Button>
        </TabsContent>

        {/* Tab - Chat IA */}
        <TabsContent value="chat" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assistente de Preenchimento</CardTitle>
            </CardHeader>
            <CardContent>
              <NegocioChat
                negocioId={negocioId}
                onFieldsExtracted={async (fields) => {
                  // Update form and save
                  const newForm = { ...form, ...fields }
                  setForm(newForm)
                  try {
                    await fetch(`/api/negocios/${negocioId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(fields),
                    })
                  } catch {
                    // silently fail, chat already shows toast
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab - Quick Fill */}
        <TabsContent value="quickfill" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preenchimento Rápido</CardTitle>
            </CardHeader>
            <CardContent>
              <QuickFill
                negocioId={negocioId}
                onApply={async (fields) => {
                  const newForm = { ...form, ...fields }
                  setForm(newForm)
                  try {
                    await fetch(`/api/negocios/${negocioId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(fields),
                    })
                  } catch {
                    toast.error('Erro ao guardar dados extraídos')
                  }
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo do Negócio</CardTitle>
            </CardHeader>
            <CardContent>
              <NegocioSummary negocioId={negocioId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab - Matching */}
        {showMatches && (
          <TabsContent value="matching" className="mt-6">
            <NegocioMatches negocioId={negocioId} />
          </TabsContent>
        )}

        {/* Tab - Interessados */}
        {showInteressados && (
          <TabsContent value="interessados" className="mt-6">
            <NegocioInteressados negocioId={negocioId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
