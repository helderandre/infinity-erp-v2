'use client'

const LOGO_URL =
  'https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/43f87d7c-92b5-4403-b7bb-618c8d4a2b9e.png'

interface StaticEmailHeaderProps {
  backgroundColor?: string
  logoWidth?: number
  paddingY?: number
}

export function StaticEmailHeader({
  backgroundColor = '#000000',
  logoWidth = 180,
  paddingY = 24,
}: StaticEmailHeaderProps) {
  return (
    <div
      style={{
        backgroundColor,
        padding: `${paddingY}px 24px`,
        textAlign: 'center',
        width: '100%',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_URL}
        alt="Infinity Group"
        style={{
          width: `${logoWidth}px`,
          height: 'auto',
          display: 'inline-block',
        }}
      />
    </div>
  )
}
