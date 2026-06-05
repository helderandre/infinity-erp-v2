'use client'

import { useEffect, useState } from 'react'
import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, ImageIcon } from 'lucide-react'

interface ConsultantOption {
  id: string
  commercial_name: string
  email_signature_url: string | null
  profile_photo_url: string | null
}

interface EmailSignatureProps {
  consultantId?: string
  width?: number
  align?: string
  padding?: number
  background?: string
}

export const EmailSignature = ({
  consultantId = '',
  width = 100,
  align = 'center',
  padding = 8,
  background = 'transparent',
}: EmailSignatureProps) => {
  const {
    connectors: { connect, drag },
    actions: { setProp },
  } = useNode()

  const [consultants, setConsultants] = useState<ConsultantOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/consultants?status=active&consultant_only=false')
      .then(r => r.json())
      .then(data => {
        const list = (Array.isArray(data) ? data : data.data || []).map((c: any) => ({
          id: c.id || c.user_id,
          commercial_name: c.commercial_name,
          email_signature_url: c.email_signature_url || c.dev_consultant_profiles?.email_signature_url || c.profile?.email_signature_url || null,
          profile_photo_url: c.profile_photo_url || c.dev_consultant_profiles?.profile_photo_url || c.profile?.profile_photo_url || null,
        }))
        setConsultants(list)

        // Auto-select current user if none set
        if (!consultantId && list.length > 0) {
          fetch('/api/auth/me').then(r => r.json()).then(me => {
            const match = list.find((c: ConsultantOption) => c.id === me?.id)
            if (match) setProp((p: any) => { p.consultantId = match.id })
          }).catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const consultant = consultants.find(c => c.id === consultantId)
  const signatureUrl = consultant?.email_signature_url

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)) }}
      style={{
        padding: `${padding}px`,
        background,
        width: '100%',
        textAlign: align as React.CSSProperties['textAlign'],
      }}
    >
      {loading ? (
        <div style={{ color: '#999', fontSize: '12px', padding: '12px', textAlign: 'center' }}>
          <span>A carregar...</span>
        </div>
      ) : signatureUrl ? (
        <img
          src={signatureUrl}
          alt={`Assinatura de ${consultant?.commercial_name || 'consultor'}`}
          style={{
            width: `${width}%`,
            maxWidth: '100%',
            height: 'auto',
            display: 'inline-block',
          }}
        />
      ) : (
        <div style={{
          border: '2px dashed #d4d4d4',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'center',
          color: '#999',
          fontSize: '12px',
        }}>
          <div style={{ marginBottom: '4px' }}>✏️</div>
          {consultant ? (
            <span>{consultant.commercial_name} não tem assinatura configurada.<br/>Carregue uma imagem no perfil do consultor.</span>
          ) : (
            <span>Seleccione um consultor no painel lateral.</span>
          )}
        </div>
      )}
    </div>
  )
}

const EmailSignatureSettings = () => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({ props: node.data.props }))

  const [consultants, setConsultants] = useState<ConsultantOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/consultants?status=active&consultant_only=false')
      .then(r => r.json())
      .then(data => {
        setConsultants((Array.isArray(data) ? data : data.data || []).map((c: any) => ({
          id: c.id || c.user_id,
          commercial_name: c.commercial_name,
          email_signature_url: c.email_signature_url || c.dev_consultant_profiles?.email_signature_url || c.profile?.email_signature_url || null,
          profile_photo_url: c.profile_photo_url || c.dev_consultant_profiles?.profile_photo_url || c.profile?.profile_photo_url || null,
        })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectedConsultant = consultants.find(c => c.id === props.consultantId)

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1">
        <Label className="text-xs font-semibold">Consultor</Label>
        <p className="text-[9px] text-muted-foreground leading-tight">A assinatura aqui seleccionada serve apenas para pré-visualização. No envio, será usada a assinatura definida nas configurações do template.</p>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />A carregar...</div>
        ) : (
          <Select value={props.consultantId || ''} onValueChange={(v) => setProp((p: any) => { p.consultantId = v })}>
            <SelectTrigger className="text-xs h-8 rounded-lg">
              <SelectValue placeholder="Seleccionar consultor..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {consultants.map(c => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    {c.email_signature_url ? (
                      <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    ) : (
                      <div className="h-3 w-3 rounded-full bg-amber-400" />
                    )}
                    {c.commercial_name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedConsultant && !selectedConsultant.email_signature_url && (
          <p className="text-[10px] text-amber-600">Este consultor não tem assinatura configurada.</p>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Largura (%)</Label>
        <input
          type="range"
          min={30}
          max={100}
          value={props.width || 100}
          onChange={(e) => setProp((p: any) => { p.width = parseInt(e.target.value) })}
          className="w-full"
        />
        <span className="text-[10px] text-muted-foreground">{props.width || 100}%</span>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Alinhamento</Label>
        <div className="flex gap-1">
          {(['left', 'center', 'right'] as const).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setProp((p: any) => { p.align = a })}
              className={`flex-1 h-7 text-[10px] rounded-md border transition-colors ${props.align === a ? 'bg-accent border-accent' : 'hover:bg-muted'}`}
            >
              {a === 'left' ? 'Esquerda' : a === 'center' ? 'Centro' : 'Direita'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Cor de fundo</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={props.background === 'transparent' ? '#ffffff' : (props.background || '#ffffff')}
            onChange={(e) => setProp((p: any) => { p.background = e.target.value })}
            className="h-8 w-8 rounded border cursor-pointer"
          />
          <button
            type="button"
            className="text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => setProp((p: any) => { p.background = 'transparent' })}
          >
            Transparente
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Padding (px)</Label>
        <input
          type="number"
          className="w-full rounded-lg border px-2 py-1 text-xs h-8"
          value={props.padding || 8}
          onChange={(e) => setProp((p: any) => { p.padding = parseInt(e.target.value) || 0 })}
        />
      </div>
    </div>
  )
}

EmailSignature.craft = {
  displayName: 'Assinatura',
  props: {
    consultantId: '',
    width: 100,
    align: 'center',
    padding: 8,
    background: 'transparent',
  },
  related: {
    settings: EmailSignatureSettings,
  },
}
