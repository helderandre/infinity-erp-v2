'use client'

import {
  AGENCY_FOOTER_LINE,
  AGENCY_INDEPENDENCE_NOTICE,
  REMAX_LOGO_URL,
  REMAX_COLLECTION_CONVICTUS_LOGO_URL,
} from '@/lib/constants'

const LOGO_URL =
  'https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/43f87d7c-92b5-4403-b7bb-618c8d4a2b9e.png'
const DEFAULT_ACTIVITY_TEXT = `${AGENCY_INDEPENDENCE_NOTICE} · ${AGENCY_FOOTER_LINE}`

interface StaticEmailFooterProps {
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

export function StaticEmailFooter({
  backgroundColor = '#1a1a1a',
  textColor = '#ffffff',
  logoWidth = 60,
  paddingY = 20,
  companyName = 'Infinity Group',
  activityText = DEFAULT_ACTIVITY_TEXT,
  showInstagram = true,
  showFacebook = true,
  showLinkedin = true,
  showWebsite = true,
  instagramUrl = 'https://www.instagram.com/o.infinitygroup?igsh=MWc5eTJ4cnc1Y2w3aw%3D%3D',
  facebookUrl = 'https://www.facebook.com/infinitygroupbyfilipepereira/',
  linkedinUrl = 'https://remax.pt/en/agente/filipe-pereira/121491860',
  websiteUrl = 'https://www.infinitygroup.pt',
}: StaticEmailFooterProps) {
  const socialLinks = [
    {
      show: showWebsite,
      url: websiteUrl,
      label: 'Infinity Group',
      icon: `data:image/svg+xml,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>'
      )}`,
      isLogo: true,
    },
    {
      show: showLinkedin,
      url: linkedinUrl,
      label: 'RE/MAX',
      icon: `data:image/svg+xml,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'
      )}`,
    },
    {
      show: showInstagram,
      url: instagramUrl,
      label: 'Instagram',
      icon: 'https://cdn-icons-png.flaticon.com/32/174/174855.png',
    },
    {
      show: showFacebook,
      url: facebookUrl,
      label: 'Facebook',
      icon: 'https://cdn-icons-png.flaticon.com/32/124/124010.png',
    },
  ].filter((s) => s.show)

  return (
    <div
      style={{
        backgroundColor,
        padding: `${paddingY}px 24px`,
        textAlign: 'center',
        width: '100%',
      }}
    >
      {socialLinks.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.icon}
                alt={s.label}
                width={s.isLogo ? 22 : 18}
                height={s.isLogo ? 22 : 18}
                style={{
                  display: 'block',
                  borderRadius: s.isLogo ? '50%' : '4px',
                  objectFit: 'cover',
                }}
              />
            </a>
          ))}
        </div>
      )}

      {/* Logos row: [RE/MAX] [Infinity Group] [Convictus] — ~30% smaller */}
      <div style={{ marginBottom: '12px', lineHeight: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={REMAX_LOGO_URL}
          alt="RE/MAX"
          style={{
            height: `${Math.round(Math.max(98, Math.round(logoWidth * 0.7)) * 0.7)}px`,
            width: 'auto',
            display: 'inline-block',
            margin: '0 10px',
            verticalAlign: 'middle',
            background: '#ffffff',
            borderRadius: '8px',
            padding: '6px',
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_URL}
          alt={companyName}
          style={{
            width: `${Math.max(98, Math.round(logoWidth * 0.7))}px`,
            height: 'auto',
            display: 'inline-block',
            margin: '0 10px',
            verticalAlign: 'middle',
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={REMAX_COLLECTION_CONVICTUS_LOGO_URL}
          alt="RE/MAX Collection Convictus"
          style={{
            height: `${Math.round(Math.max(98, Math.round(logoWidth * 0.7)) * 0.7)}px`,
            width: 'auto',
            display: 'inline-block',
            margin: '0 10px',
            verticalAlign: 'middle',
            background: '#ffffff',
            borderRadius: '8px',
            padding: '6px',
          }}
        />
      </div>

      <p
        style={{
          color: textColor,
          fontSize: '10px',
          lineHeight: '1.4',
          margin: 0,
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        {activityText}
      </p>
    </div>
  )
}
