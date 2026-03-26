'use client'

import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

const LOGO_URL = 'https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/43f87d7c-92b5-4403-b7bb-618c8d4a2b9e.png'

interface EmailFooterProps {
  backgroundColor?: string
  textColor?: string
  logoWidth?: number
  paddingY?: number
  companyName?: string
  activityText?: string
  showInstagram?: boolean
  showFacebook?: boolean
  showLinkedin?: boolean
  showWebsite?: boolean
  instagramUrl?: string
  facebookUrl?: string
  linkedinUrl?: string
  websiteUrl?: string
}

export const EmailFooter = ({
  backgroundColor = '#1a1a1a',
  textColor = '#ffffff',
  logoWidth = 60,
  paddingY = 20,
  companyName = 'Infinity Group',
  activityText = 'Atividade exercida ao abrigo da Licença AMI 4719 - Convictus Mediação Imobiliária, Lda',
  showInstagram = true,
  showFacebook = true,
  showLinkedin = true,
  showWebsite = true,
  instagramUrl = 'https://www.instagram.com/o.infinitygroup?igsh=MWc5eTJ4cnc1Y2w3aw%3D%3D',
  facebookUrl = 'https://www.facebook.com/infinitygroupbyfilipepereira/',
  linkedinUrl = 'https://remax.pt/en/agente/filipe-pereira/121491860',
  websiteUrl = 'https://www.infinitygroup.pt',
}: EmailFooterProps) => {
  const {
    connectors: { connect, drag },
  } = useNode()

  const socialLinks = [
    { show: showWebsite, url: websiteUrl, label: 'Infinity Group', icon: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>')}`, isLogo: true },
    { show: showLinkedin, url: linkedinUrl, label: 'RE/MAX', icon: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>')}` },
    { show: showInstagram, url: instagramUrl, label: 'Instagram', icon: 'https://cdn-icons-png.flaticon.com/32/174/174855.png' },
    { show: showFacebook, url: facebookUrl, label: 'Facebook', icon: 'https://cdn-icons-png.flaticon.com/32/124/124010.png' },
  ].filter(s => s.show)

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)) }}
      style={{
        backgroundColor,
        padding: `${paddingY}px 24px`,
        textAlign: 'center',
        width: '100%',
      }}
    >
      {/* Logo */}
      <img
        src={LOGO_URL}
        alt={companyName}
        style={{
          width: `${logoWidth}px`,
          height: 'auto',
          display: 'inline-block',
          marginBottom: '10px',
        }}
      />

      {/* Social icons */}
      {socialLinks.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          {socialLinks.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                margin: '0 6px',
                textDecoration: 'none',
                verticalAlign: 'middle',
              }}
            >
              <img
                src={s.icon}
                alt={s.label}
                width={(s as any).isLogo ? '22' : '18'}
                height={(s as any).isLogo ? '22' : '18'}
                style={{
                  display: 'block',
                  borderRadius: (s as any).isLogo ? '50%' : '4px',
                  objectFit: 'cover',
                }}
              />
            </a>
          ))}
        </div>
      )}

      {/* Activity text */}
      <p style={{
        color: textColor,
        fontSize: '10px',
        lineHeight: '1.4',
        margin: '0',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}>
        {activityText}
      </p>
    </div>
  )
}

const EmailFooterSettings = () => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({ props: node.data.props }))

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1">
        <Label className="text-xs">Cor de fundo</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={props.backgroundColor || '#1a1a1a'}
            onChange={(e) => setProp((p: any) => { p.backgroundColor = e.target.value })}
            className="h-8 w-8 rounded border cursor-pointer"
          />
          <Input
            value={props.backgroundColor || '#1a1a1a'}
            onChange={(e) => setProp((p: any) => { p.backgroundColor = e.target.value })}
            className="flex-1 text-xs h-8"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Cor do texto</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={props.textColor || '#999999'}
            onChange={(e) => setProp((p: any) => { p.textColor = e.target.value })}
            className="h-8 w-8 rounded border cursor-pointer"
          />
          <Input
            value={props.textColor || '#999999'}
            onChange={(e) => setProp((p: any) => { p.textColor = e.target.value })}
            className="flex-1 text-xs h-8"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Largura do logo (px)</Label>
        <Input
          type="number"
          value={props.logoWidth || 120}
          onChange={(e) => setProp((p: any) => { p.logoWidth = parseInt(e.target.value) || 120 })}
          className="text-xs h-8"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Nome da empresa</Label>
        <Input
          value={props.companyName || 'Infinity Group'}
          onChange={(e) => setProp((p: any) => { p.companyName = e.target.value })}
          className="text-xs h-8"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Texto de atividade</Label>
        <Input
          value={props.activityText || ''}
          onChange={(e) => setProp((p: any) => { p.activityText = e.target.value })}
          className="text-xs h-8"
        />
      </div>

      <div className="border-t pt-3 mt-3 space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Redes Sociais</Label>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Instagram</Label>
          <Switch checked={props.showInstagram ?? true} onCheckedChange={(v) => setProp((p: any) => { p.showInstagram = v })} />
        </div>
        {props.showInstagram && (
          <Input value={props.instagramUrl || ''} onChange={(e) => setProp((p: any) => { p.instagramUrl = e.target.value })} placeholder="URL Instagram" className="text-xs h-7" />
        )}

        <div className="flex items-center justify-between">
          <Label className="text-xs">Facebook</Label>
          <Switch checked={props.showFacebook ?? true} onCheckedChange={(v) => setProp((p: any) => { p.showFacebook = v })} />
        </div>
        {props.showFacebook && (
          <Input value={props.facebookUrl || ''} onChange={(e) => setProp((p: any) => { p.facebookUrl = e.target.value })} placeholder="URL Facebook" className="text-xs h-7" />
        )}

        <div className="flex items-center justify-between">
          <Label className="text-xs">RE/MAX</Label>
          <Switch checked={props.showLinkedin ?? true} onCheckedChange={(v) => setProp((p: any) => { p.showLinkedin = v })} />
        </div>
        {props.showLinkedin && (
          <Input value={props.linkedinUrl || ''} onChange={(e) => setProp((p: any) => { p.linkedinUrl = e.target.value })} placeholder="URL LinkedIn" className="text-xs h-7" />
        )}

        <div className="flex items-center justify-between">
          <Label className="text-xs">Website</Label>
          <Switch checked={props.showWebsite ?? true} onCheckedChange={(v) => setProp((p: any) => { p.showWebsite = v })} />
        </div>
        {props.showWebsite && (
          <Input value={props.websiteUrl || ''} onChange={(e) => setProp((p: any) => { p.websiteUrl = e.target.value })} placeholder="URL Website" className="text-xs h-7" />
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Padding vertical (px)</Label>
        <Input
          type="number"
          value={props.paddingY || 32}
          onChange={(e) => setProp((p: any) => { p.paddingY = parseInt(e.target.value) || 32 })}
          className="text-xs h-8"
        />
      </div>
    </div>
  )
}

EmailFooter.craft = {
  displayName: 'Rodapé',
  props: {
    backgroundColor: '#1a1a1a',
    textColor: '#ffffff',
    logoWidth: 60,
    paddingY: 20,
    companyName: 'Infinity Group',
    activityText: 'Atividade exercida ao abrigo da Licença AMI 4719 - Convictus Mediação Imobiliária, Lda',
    showInstagram: true,
    showFacebook: true,
    showLinkedin: true,
    showWebsite: true,
    instagramUrl: 'https://www.instagram.com/o.infinitygroup?igsh=MWc5eTJ4cnc1Y2w3aw%3D%3D',
    facebookUrl: 'https://www.facebook.com/infinitygroupbyfilipepereira/',
    linkedinUrl: 'https://remax.pt/en/agente/filipe-pereira/121491860',
    websiteUrl: 'https://www.infinitygroup.pt',
  },
  related: {
    settings: EmailFooterSettings,
  },
}
