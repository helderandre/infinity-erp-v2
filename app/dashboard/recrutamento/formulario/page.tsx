'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Settings2, FileSignature, ScrollText, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
// Dialog removed — contract uses inline editor now
import { toast } from 'sonner'
import { SubmissionsTab } from '@/components/recrutamento/submissions-tab'
import { FormBuilder } from '@/components/recrutamento/form-builder'
import { ContractEditor } from '@/components/recrutamento/contract-editor'
import { getContractTemplates, updateContractTemplate } from '@/app/dashboard/recrutamento/actions'

type Tab = 'submissions' | 'formulario' | 'contratos'

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
            <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">Formulário de entrada, submissões e contratos de novos consultores</p>
          </div>

          {/* Tab selector inside hero */}
          <div className="mt-5 inline-flex items-center gap-1 p-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
            {([
              ['submissions', 'Submissões', FileText] as const,
              ['formulario', 'Formulário', Settings2] as const,
              ['contratos', 'Contrato', FileSignature] as const,
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
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">Crie o template do contrato de prestacao de servicos</p>
                <Button className="mt-4 rounded-full gap-1.5" onClick={loadContractTemplate}>
                  <Plus className="h-3.5 w-3.5" />Criar Template
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">{contractTemplate.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Edite o template do contrato. Use o botao "Variavel" para inserir campos que serao preenchidos automaticamente com os dados do consultor.
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
