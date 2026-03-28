// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Settings2, FileSignature, ScrollText, Plus, Mail, Send, Pencil, ExternalLink, Eye, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { SubmissionsTab } from '@/components/recrutamento/submissions-tab'
import { FormBuilder } from '@/components/recrutamento/form-builder'
import { ContractEditor } from '@/components/recrutamento/contract-editor'
import { getContractTemplates, updateContractTemplate } from '@/app/dashboard/recrutamento/actions'
import { createAdminClient } from '@/lib/supabase/admin'

type Tab = 'submissions' | 'formulario' | 'contratos' | 'emails'

export default function FormularioPage() {
  const [tab, setTab] = useState<Tab>('submissions')

  // Contract template state
  const [contractTemplate, setContractTemplate] = useState<any>(null)
  const [contractsLoading, setContractsLoading] = useState(false)
  const [contractSaving, setContractSaving] = useState(false)

  const loadContractTemplate = useCallback(async () => {
    setContractsLoading(true)
    try {
      const { templates, error } = await getContractTemplates()
      if (error) throw new Error(error)

      if (templates.length > 0) {
        setContractTemplate(templates[0])
      } else {
        // Auto-seed the default template only if none exists
        await fetch('/api/entry-form/seed-contract-template', { method: 'POST' })
        const { templates: t2 } = await getContractTemplates()
        if (t2.length > 0) setContractTemplate(t2[0])
      }
    } catch { /* */ }
    finally { setContractsLoading(false) }
  }, [])

  const handleSaveContract = useCallback(async (html: string) => {
    if (!contractTemplate) return
    setContractSaving(true)
    try {
      const { error } = await updateContractTemplate(contractTemplate.id, { content_html: html })
      if (error) throw new Error(error)
      toast.success('Template de contrato guardado')
      setContractTemplate((prev: any) => prev ? { ...prev, content_html: html } : prev)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao guardar')
    } finally { setContractSaving(false) }
  }, [contractTemplate])

  useEffect(() => { if (tab === 'contratos' && !contractTemplate) loadContractTemplate() }, [tab, contractTemplate, loadContractTemplate])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Hero */}
      <div className="shrink-0">
        <div className="relative overflow-hidden rounded-xl bg-neutral-900 mx-4">
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
          <div className="relative z-10 px-8 py-8 sm:px-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Integração</h2>
            <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">Formulário de entrada, submissões, contratos e emails de novos consultores</p>
          </div>

          {/* Tab selector inside hero */}
          <div className="mt-5 inline-flex items-center gap-1 p-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
            {([
              ['submissions', 'Submissões', FileText] as const,
              ['formulario', 'Formulário', Settings2] as const,
              ['contratos', 'Contrato', FileSignature] as const,
              ['emails', 'Emails', Mail] as const,
            ]).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300',
                  tab === key
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/10'
                )}
              >
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'formulario' && <FormBuilder />}

        {tab === 'submissions' && (
          <div className="p-6 overflow-y-auto h-full">
            <SubmissionsTab />
          </div>
        )}

        {tab === 'emails' && (
          <div className="p-6 overflow-y-auto h-full">
            <EntryEmailsTab />
          </div>
        )}

        {tab === 'contratos' && (
          <div className="p-6 overflow-y-auto h-full">
            {contractsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-[500px] rounded-xl" />
              </div>
            ) : !contractTemplate ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
                <ScrollText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <h3 className="text-base font-medium">Sem template de contrato</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">Crie o template do contrato de prestação de serviços</p>
                <Button className="mt-4 rounded-full gap-1.5" onClick={loadContractTemplate}>
                  <Plus className="h-3.5 w-3.5" />Criar Template
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">{contractTemplate.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Edite o template do contrato. Use o botão &quot;Variável&quot; para inserir campos preenchidos automaticamente.
                  </p>
                </div>

                <ContractEditor
                  initialHtml={contractTemplate.content_html}
                  mode="template"
                  onSave={handleSaveContract}
                  saving={contractSaving}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Entry Emails Tab ─────────────────────────────────────────────────────────

function EntryEmailsTab() {
  const router = useRouter()
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/entry-form/email-templates')
        if (res.ok) {
          const data = await res.json()
          setTemplates(data.templates || [])
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const EMAIL_DESCRIPTIONS: Record<string, { icon: any; description: string; recipient: string }> = {
    entry_welcome: {
      icon: Send,
      description: 'Enviado ao candidato após submeter o formulário',
      recipient: 'Email do candidato',
    },
    entry_internal_notification: {
      icon: Mail,
      description: 'Notifica a equipa interna de uma nova submissão',
      recipient: 'duartegtlcosta@gmail.com',
    },
    entry_convictus: {
      icon: Mail,
      description: 'Notifica a Convictus de um novo consultor em integração',
      recipient: 'duartegtlcosta@gmail.com',
    },
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Emails de Entrada</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Emails enviados automaticamente quando um candidato submete o formulário de entrada.
          Edite o conteúdo usando o editor visual de emails.
        </p>
      </div>

      <div className="grid gap-4">
        {templates.map(tpl => {
          const meta = EMAIL_DESCRIPTIONS[tpl.slug] || { icon: Mail, description: '', recipient: '' }
          const Icon = meta.icon
          return (
            <div
              key={tpl.id}
              className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">{tpl.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{tpl.description || meta.description}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span><strong>Assunto:</strong> {tpl.subject}</span>
                    <span><strong>Para:</strong> {meta.recipient}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 rounded-xl"
                  onClick={() => router.push(`/dashboard/templates-email/${tpl.id}`)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
              </div>
            </div>
          )
        })}

        {templates.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
            <Mail className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-medium">Sem templates de email</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Execute a migração SQL para criar os templates de email de entrada.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
