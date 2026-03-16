'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { EURIBOR_REFERENCE_OPTIONS } from '@/lib/constants'
import type { CreditProposal, CreditBank } from '@/types/credit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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

interface CreditProposalFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  initialData?: CreditProposal | null
  isSubmitting: boolean
  banks: CreditBank[]
}

interface FormValues {
  banco: string
  banco_custom: string
  banco_contacto: string
  banco_email: string
  banco_telefone: string
  tem_protocolo: boolean
  protocolo_ref: string
  status: string
  montante_aprovado: string
  prazo_aprovado_anos: string
  tipo_taxa: string
  spread: string
  euribor_referencia: string
  taxa_fixa_valor: string
  taxa_fixa_periodo_anos: string
  taeg: string
  prestacao_mensal: string
  mtic: string
  ltv_aprovado: string
  financiamento_percentagem: string
  seguro_vida_mensal: string
  seguro_multirriscos_anual: string
  seguro_incluido_prestacao: boolean
  comissao_avaliacao: string
  comissao_dossier: string
  comissao_formalizacao: string
  condicoes_especiais: string
  exige_domiciliacao_salario: boolean
  exige_cartao_credito: boolean
  exige_seguros_banco: boolean
  outros_produtos_obrigatorios: string
  data_validade_aprovacao: string
  notas: string
}

const parseNum = (v: string): number | null => {
  if (!v || v.trim() === '') return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

export function CreditProposalForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isSubmitting,
  banks,
}: CreditProposalFormProps) {
  const isEditing = !!initialData

  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: getDefaults(null),
  })

  useEffect(() => {
    if (open) {
      reset(getDefaults(initialData ?? null))
    }
  }, [open, initialData, reset])

  const selectedBanco = watch('banco')
  const tipoTaxa = watch('tipo_taxa')

  const onFormSubmit = async (values: FormValues) => {
    const bancoName =
      values.banco === '__custom__' ? values.banco_custom : values.banco

    const data: Record<string, unknown> = {
      banco: bancoName,
      banco_contacto: values.banco_contacto || null,
      banco_email: values.banco_email || null,
      banco_telefone: values.banco_telefone || null,
      tem_protocolo: values.tem_protocolo,
      protocolo_ref: values.protocolo_ref || null,
      status: values.status || 'rascunho',
      montante_aprovado: parseNum(values.montante_aprovado),
      prazo_aprovado_anos: parseNum(values.prazo_aprovado_anos),
      tipo_taxa: values.tipo_taxa || null,
      spread: parseNum(values.spread),
      euribor_referencia: values.euribor_referencia || null,
      taxa_fixa_valor: parseNum(values.taxa_fixa_valor),
      taxa_fixa_periodo_anos: parseNum(values.taxa_fixa_periodo_anos),
      taeg: parseNum(values.taeg),
      prestacao_mensal: parseNum(values.prestacao_mensal),
      mtic: parseNum(values.mtic),
      ltv_aprovado: parseNum(values.ltv_aprovado),
      financiamento_percentagem: parseNum(values.financiamento_percentagem),
      seguro_vida_mensal: parseNum(values.seguro_vida_mensal),
      seguro_multirriscos_anual: parseNum(values.seguro_multirriscos_anual),
      seguro_incluido_prestacao: values.seguro_incluido_prestacao,
      comissao_avaliacao: parseNum(values.comissao_avaliacao),
      comissao_dossier: parseNum(values.comissao_dossier),
      comissao_formalizacao: parseNum(values.comissao_formalizacao),
      condicoes_especiais: values.condicoes_especiais || null,
      exige_domiciliacao_salario: values.exige_domiciliacao_salario,
      exige_cartao_credito: values.exige_cartao_credito,
      exige_seguros_banco: values.exige_seguros_banco,
      outros_produtos_obrigatorios: values.outros_produtos_obrigatorios || null,
      data_validade_aprovacao: values.data_validade_aprovacao || null,
      notas: values.notas || null,
    }

    await onSubmit(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Proposta' : 'Nova Proposta Bancaria'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Actualize os dados da proposta.'
              : 'Preencha os dados da proposta recebida do banco.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          {/* Banco */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Banco</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="banco">Banco</Label>
                <Select
                  value={selectedBanco}
                  onValueChange={(v) => setValue('banco', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar banco..." />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={b.nome}>
                        {b.nome}
                        {b.tem_protocolo && ' (Protocolo)'}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">Outro...</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedBanco === '__custom__' && (
                <div className="col-span-2">
                  <Label htmlFor="banco_custom">Nome do Banco</Label>
                  <Input id="banco_custom" {...register('banco_custom')} placeholder="Nome do banco" />
                </div>
              )}
              <div>
                <Label htmlFor="banco_contacto">Contacto</Label>
                <Input id="banco_contacto" {...register('banco_contacto')} placeholder="Nome do gestor" />
              </div>
              <div>
                <Label htmlFor="banco_email">Email</Label>
                <Input id="banco_email" type="email" {...register('banco_email')} placeholder="email@banco.pt" />
              </div>
              <div>
                <Label htmlFor="banco_telefone">Telefone</Label>
                <Input id="banco_telefone" {...register('banco_telefone')} placeholder="+351 ..." />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="tem_protocolo"
                    checked={watch('tem_protocolo')}
                    onCheckedChange={(c) => setValue('tem_protocolo', !!c)}
                  />
                  <Label htmlFor="tem_protocolo" className="text-sm">Protocolo</Label>
                </div>
                {watch('tem_protocolo') && (
                  <Input {...register('protocolo_ref')} placeholder="Ref. protocolo" className="flex-1" />
                )}
              </div>
            </div>
          </fieldset>

          {/* Condicoes */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Condicoes</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="montante_aprovado">Montante Aprovado</Label>
                <Input id="montante_aprovado" type="number" step="0.01" {...register('montante_aprovado')} placeholder="0,00" />
              </div>
              <div>
                <Label htmlFor="prazo_aprovado_anos">Prazo (anos)</Label>
                <Input id="prazo_aprovado_anos" type="number" {...register('prazo_aprovado_anos')} placeholder="30" />
              </div>
              <div>
                <Label htmlFor="tipo_taxa">Tipo de Taxa</Label>
                <Select value={tipoTaxa} onValueChange={(v) => setValue('tipo_taxa', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="variavel">Variavel</SelectItem>
                    <SelectItem value="fixa">Fixa</SelectItem>
                    <SelectItem value="mista">Mista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="spread">Spread (%)</Label>
                <Input id="spread" type="number" step="0.01" {...register('spread')} placeholder="0,90" />
              </div>
              <div>
                <Label htmlFor="euribor_referencia">Euribor Referencia</Label>
                <Select
                  value={watch('euribor_referencia')}
                  onValueChange={(v) => setValue('euribor_referencia', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EURIBOR_REFERENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(tipoTaxa === 'fixa' || tipoTaxa === 'mista') && (
                <>
                  <div>
                    <Label htmlFor="taxa_fixa_valor">Taxa Fixa (%)</Label>
                    <Input id="taxa_fixa_valor" type="number" step="0.01" {...register('taxa_fixa_valor')} />
                  </div>
                  <div>
                    <Label htmlFor="taxa_fixa_periodo_anos">Periodo Fixo (anos)</Label>
                    <Input id="taxa_fixa_periodo_anos" type="number" {...register('taxa_fixa_periodo_anos')} />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="taeg">TAEG (%)</Label>
                <Input id="taeg" type="number" step="0.01" {...register('taeg')} placeholder="3,50" />
              </div>
              <div>
                <Label htmlFor="prestacao_mensal">Prestacao Mensal</Label>
                <Input id="prestacao_mensal" type="number" step="0.01" {...register('prestacao_mensal')} placeholder="0,00" />
              </div>
              <div>
                <Label htmlFor="mtic">MTIC</Label>
                <Input id="mtic" type="number" step="0.01" {...register('mtic')} placeholder="0,00" />
              </div>
              <div>
                <Label htmlFor="ltv_aprovado">LTV (%)</Label>
                <Input id="ltv_aprovado" type="number" step="0.01" {...register('ltv_aprovado')} />
              </div>
              <div>
                <Label htmlFor="financiamento_percentagem">Financiamento (%)</Label>
                <Input id="financiamento_percentagem" type="number" step="0.01" {...register('financiamento_percentagem')} />
              </div>
            </div>
          </fieldset>

          {/* Seguros */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Seguros</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="seguro_vida_mensal">Seguro Vida Mensal</Label>
                <Input id="seguro_vida_mensal" type="number" step="0.01" {...register('seguro_vida_mensal')} placeholder="0,00" />
              </div>
              <div>
                <Label htmlFor="seguro_multirriscos_anual">Seguro Multirriscos Anual</Label>
                <Input id="seguro_multirriscos_anual" type="number" step="0.01" {...register('seguro_multirriscos_anual')} placeholder="0,00" />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Checkbox
                  id="seguro_incluido_prestacao"
                  checked={watch('seguro_incluido_prestacao')}
                  onCheckedChange={(c) => setValue('seguro_incluido_prestacao', !!c)}
                />
                <Label htmlFor="seguro_incluido_prestacao" className="text-sm">Seguro incluido na prestacao</Label>
              </div>
            </div>
          </fieldset>

          {/* Custos */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Custos</legend>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="comissao_avaliacao">Avaliacao</Label>
                <Input id="comissao_avaliacao" type="number" step="0.01" {...register('comissao_avaliacao')} placeholder="0,00" />
              </div>
              <div>
                <Label htmlFor="comissao_dossier">Dossier</Label>
                <Input id="comissao_dossier" type="number" step="0.01" {...register('comissao_dossier')} placeholder="0,00" />
              </div>
              <div>
                <Label htmlFor="comissao_formalizacao">Formalizacao</Label>
                <Input id="comissao_formalizacao" type="number" step="0.01" {...register('comissao_formalizacao')} placeholder="0,00" />
              </div>
            </div>
          </fieldset>

          {/* Condicoes especiais */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Condicoes Especiais</legend>
            <div className="space-y-3">
              <div>
                <Label htmlFor="condicoes_especiais">Descricao</Label>
                <Textarea id="condicoes_especiais" {...register('condicoes_especiais')} placeholder="Condicoes especiais da proposta..." rows={2} />
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="exige_domiciliacao_salario"
                    checked={watch('exige_domiciliacao_salario')}
                    onCheckedChange={(c) => setValue('exige_domiciliacao_salario', !!c)}
                  />
                  <Label htmlFor="exige_domiciliacao_salario" className="text-sm">Domiciliacao de salario</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="exige_cartao_credito"
                    checked={watch('exige_cartao_credito')}
                    onCheckedChange={(c) => setValue('exige_cartao_credito', !!c)}
                  />
                  <Label htmlFor="exige_cartao_credito" className="text-sm">Cartao de credito</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="exige_seguros_banco"
                    checked={watch('exige_seguros_banco')}
                    onCheckedChange={(c) => setValue('exige_seguros_banco', !!c)}
                  />
                  <Label htmlFor="exige_seguros_banco" className="text-sm">Seguros do banco</Label>
                </div>
              </div>
              <div>
                <Label htmlFor="outros_produtos_obrigatorios">Outros produtos obrigatorios</Label>
                <Input id="outros_produtos_obrigatorios" {...register('outros_produtos_obrigatorios')} />
              </div>
            </div>
          </fieldset>

          {/* Datas + Notas */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Datas e Notas</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="data_validade_aprovacao">Validade da Aprovacao</Label>
                <Input id="data_validade_aprovacao" type="date" {...register('data_validade_aprovacao')} />
              </div>
              <div>
                <Label htmlFor="status">Estado</Label>
                <Select value={watch('status')} onValueChange={(v) => setValue('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="submetida">Submetida</SelectItem>
                    <SelectItem value="em_analise">Em Analise</SelectItem>
                    <SelectItem value="pre_aprovada">Pre-Aprovada</SelectItem>
                    <SelectItem value="aprovada">Aprovada</SelectItem>
                    <SelectItem value="recusada">Recusada</SelectItem>
                    <SelectItem value="expirada">Expirada</SelectItem>
                    <SelectItem value="aceite">Aceite</SelectItem>
                    <SelectItem value="contratada">Contratada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="notas">Notas</Label>
              <Textarea id="notas" {...register('notas')} placeholder="Notas internas sobre a proposta..." rows={2} />
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Alteracoes' : 'Criar Proposta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getDefaults(data: CreditProposal | null): FormValues {
  if (!data) {
    return {
      banco: '',
      banco_custom: '',
      banco_contacto: '',
      banco_email: '',
      banco_telefone: '',
      tem_protocolo: false,
      protocolo_ref: '',
      status: 'rascunho',
      montante_aprovado: '',
      prazo_aprovado_anos: '',
      tipo_taxa: 'variavel',
      spread: '',
      euribor_referencia: '',
      taxa_fixa_valor: '',
      taxa_fixa_periodo_anos: '',
      taeg: '',
      prestacao_mensal: '',
      mtic: '',
      ltv_aprovado: '',
      financiamento_percentagem: '',
      seguro_vida_mensal: '',
      seguro_multirriscos_anual: '',
      seguro_incluido_prestacao: false,
      comissao_avaliacao: '',
      comissao_dossier: '',
      comissao_formalizacao: '',
      condicoes_especiais: '',
      exige_domiciliacao_salario: false,
      exige_cartao_credito: false,
      exige_seguros_banco: false,
      outros_produtos_obrigatorios: '',
      data_validade_aprovacao: '',
      notas: '',
    }
  }

  return {
    banco: data.banco,
    banco_custom: '',
    banco_contacto: data.banco_contacto ?? '',
    banco_email: data.banco_email ?? '',
    banco_telefone: data.banco_telefone ?? '',
    tem_protocolo: data.tem_protocolo,
    protocolo_ref: data.protocolo_ref ?? '',
    status: data.status,
    montante_aprovado: data.montante_aprovado?.toString() ?? '',
    prazo_aprovado_anos: data.prazo_aprovado_anos?.toString() ?? '',
    tipo_taxa: data.tipo_taxa ?? 'variavel',
    spread: data.spread?.toString() ?? '',
    euribor_referencia: data.euribor_referencia ?? '',
    taxa_fixa_valor: data.taxa_fixa_valor?.toString() ?? '',
    taxa_fixa_periodo_anos: data.taxa_fixa_periodo_anos?.toString() ?? '',
    taeg: data.taeg?.toString() ?? '',
    prestacao_mensal: data.prestacao_mensal?.toString() ?? '',
    mtic: data.mtic?.toString() ?? '',
    ltv_aprovado: data.ltv_aprovado?.toString() ?? '',
    financiamento_percentagem: data.financiamento_percentagem?.toString() ?? '',
    seguro_vida_mensal: data.seguro_vida_mensal?.toString() ?? '',
    seguro_multirriscos_anual: data.seguro_multirriscos_anual?.toString() ?? '',
    seguro_incluido_prestacao: data.seguro_incluido_prestacao,
    comissao_avaliacao: data.comissao_avaliacao?.toString() ?? '',
    comissao_dossier: data.comissao_dossier?.toString() ?? '',
    comissao_formalizacao: data.comissao_formalizacao?.toString() ?? '',
    condicoes_especiais: data.condicoes_especiais ?? '',
    exige_domiciliacao_salario: data.exige_domiciliacao_salario,
    exige_cartao_credito: data.exige_cartao_credito,
    exige_seguros_banco: data.exige_seguros_banco,
    outros_produtos_obrigatorios: data.outros_produtos_obrigatorios ?? '',
    data_validade_aprovacao: data.data_validade_aprovacao ?? '',
    notas: data.notas ?? '',
  }
}
