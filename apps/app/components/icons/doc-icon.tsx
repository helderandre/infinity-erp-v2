'use client'

import { cn } from '@/lib/utils'

/** Supported file extensions and their badge colours */
const EXTENSION_COLORS: Record<string, { bg: string; text: string }> = {
  pdf:  { bg: '#E53E3E', text: '#FFFFFF' },
  doc:  { bg: '#2B6CB0', text: '#FFFFFF' },
  docx: { bg: '#2B6CB0', text: '#FFFFFF' },
  xls:  { bg: '#276749', text: '#FFFFFF' },
  xlsx: { bg: '#276749', text: '#FFFFFF' },
  csv:  { bg: '#276749', text: '#FFFFFF' },
  ppt:  { bg: '#C05621', text: '#FFFFFF' },
  pptx: { bg: '#C05621', text: '#FFFFFF' },
  txt:  { bg: '#718096', text: '#FFFFFF' },
  jpg:  { bg: '#9F7AEA', text: '#FFFFFF' },
  jpeg: { bg: '#9F7AEA', text: '#FFFFFF' },
  png:  { bg: '#9F7AEA', text: '#FFFFFF' },
  webp: { bg: '#9F7AEA', text: '#FFFFFF' },
  svg:  { bg: '#D69E2E', text: '#FFFFFF' },
  zip:  { bg: '#4A5568', text: '#FFFFFF' },
  rar:  { bg: '#4A5568', text: '#FFFFFF' },
  mp4:  { bg: '#D53F8C', text: '#FFFFFF' },
  mp3:  { bg: '#ED64A6', text: '#FFFFFF' },
  ogg:  { bg: '#ED64A6', text: '#FFFFFF' },
  html: { bg: '#DD6B20', text: '#FFFFFF' },
  json: { bg: '#38A169', text: '#FFFFFF' },
  pages: { bg: '#FF9500', text: '#FFFFFF' },
  key:  { bg: '#0070C9', text: '#FFFFFF' },
  numbers: { bg: '#00A650', text: '#FFFFFF' },
}

const DEFAULT_COLOR = { bg: 'hsl(var(--primary))', text: '#FFFFFF' }

/** Badge sizing per variant */
const BADGE_STYLES = {
  sm: 'bottom-[30%] rounded px-1 py-0.2 text-[0.45rem]',
  md: 'bottom-[30%] rounded-md px-1.5 py-0.5 text-[0.55rem]',
  lg: 'bottom-[28%] rounded-lg px-3 py-.5 text-[1rem]',
} as const

interface DocIconProps {
  className?: string
  /** File extension shown as a coloured badge (e.g. "pdf", "docx") */
  extension?: string
  /** Badge size — auto-detected from className when omitted */
  size?: 'sm' | 'md' | 'lg'
}

/** Guess a reasonable badge size from the outer className (h-XX / w-XX). */
function detectSize(className?: string): 'sm' | 'md' | 'lg' {
  if (!className) return 'sm'
  const match = className.match(/(?:^|\s)[hw]-(\d+)/)
  if (!match) return 'sm'
  const n = Number(match[1])
  if (n >= 24) return 'lg'
  if (n >= 12) return 'md'
  return 'sm'
}

/**
 * Document icon with an optional coloured extension badge.
 * Based on a paper-with-folded-corner design.
 */
export function DocIcon({ className, extension, size }: DocIconProps) {
  const ext = extension?.toLowerCase().replace(/^\./, '')
  const hasKnownExt = ext && EXTENSION_COLORS[ext]
  const badgeLabel = hasKnownExt ? ext : 'doc'
  const color = hasKnownExt ? EXTENSION_COLORS[ext] : DEFAULT_COLOR
  const badgeSize = size ?? detectSize(className)

  return (
    <div className={cn('relative h-16 w-16 shrink-0', className)}>
      {/* Document SVG */}
      <svg
        viewBox="0 0 227 294"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          {/* Drop shadow */}
          <filter id="di-drop" x="0" y="0" width="227" height="294" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="bg" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha" />
            <feOffset dy="4" />
            <feGaussianBlur stdDeviation="3" />
            <feComposite in2="ha" operator="out" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0" />
            <feBlend mode="normal" in2="bg" result="ds" />
            <feBlend mode="normal" in="SourceGraphic" in2="ds" result="shape" />
          </filter>

          {/* Corner shadow blur */}
          <filter id="di-corner-blur" x="102" y="-32" width="155" height="153" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="bg" />
            <feBlend mode="normal" in="SourceGraphic" in2="bg" result="shape" />
            <feGaussianBlur stdDeviation="20" result="blur" />
          </filter>

          {/* Inner shadows for body */}
          <filter id="di-inner" x="6" y="0" width="215" height="285" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="bg" />
            <feBlend mode="normal" in="SourceGraphic" in2="bg" result="shape" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha" />
            <feOffset dy="1" />
            <feGaussianBlur stdDeviation="1" />
            <feComposite in2="ha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
            <feBlend mode="normal" in2="shape" result="is1" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha2" />
            <feOffset />
            <feGaussianBlur stdDeviation="1" />
            <feComposite in2="ha2" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.769 0 0 0 0 0.803 0 0 0 0 0.858 0 0 0 1 0" />
            <feBlend mode="normal" in2="is1" result="is2" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha3" />
            <feOffset dy="-3" />
            <feGaussianBlur stdDeviation="1" />
            <feComposite in2="ha3" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.866 0 0 0 0 0.881 0 0 0 0 0.892 0 0 0 1 0" />
            <feBlend mode="normal" in2="is2" result="is3" />
          </filter>

          {/* Body radial gradient */}
          <radialGradient id="di-body" cx="0" cy="0" r="1" gradientTransform="matrix(153 -200 152.153 117.027 -4 300)" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" />
            <stop offset="1" stopColor="#F9FBFF" />
          </radialGradient>

          {/* Corner fold radial fill */}
          <radialGradient id="di-fold-fill" cx="0" cy="0" r="1" gradientTransform="matrix(62.83 -65.57 203.79 196.31 142 81)" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" />
            <stop offset="0.5" stopColor="#F9FBFF" />
            <stop offset="0.63" stopColor="white" />
          </radialGradient>

          {/* Corner fold stroke */}
          <radialGradient id="di-fold-stroke" cx="0" cy="0" r="1" gradientTransform="matrix(60 -66 66.62 60.89 129 93)" gradientUnits="userSpaceOnUse">
            <stop stopOpacity="0.15" />
            <stop offset="1" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g filter="url(#di-drop)">
          {/* Main body */}
          <path
            d="M7 17C7 9.268 13.268 3 21 3H129.901C137.872 3 145.514 6.172 151.143 11.815L211.242 72.075C216.85 77.699 220 85.317 220 93.26V269C220 276.732 213.732 283 206 283H21C13.268 283 7 276.732 7 269V17Z"
            fill="url(#di-body)"
          />

          {/* Masked corner fold group */}
          <mask id="di-mask" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="7" y="3" width="213" height="280">
            <path
              d="M7 17C7 9.268 13.268 3 21 3H129.901C137.872 3 145.514 6.172 151.143 11.815L211.242 72.075C216.85 77.699 220 85.317 220 93.26V269C220 276.732 213.732 283 206 283H21C13.268 283 7 276.732 7 269V17Z"
              fill="white"
            />
          </mask>
          <g mask="url(#di-mask)">
            {/* Corner shadow */}
            <g filter="url(#di-corner-blur)">
              <path d="M142 80.857L156.242 7.643L216.794 66.214L142 80.857Z" fill="black" fillOpacity="0.5" />
            </g>
            {/* Corner fold */}
            <path
              d="M141.99 -1.355L223.772 79.645L224.635 80.5H155.639C147.631 80.5 141.139 74.008 141.139 66V-2.199L141.99 -1.355Z"
              fill="url(#di-fold-fill)"
              stroke="url(#di-fold-stroke)"
            />
          </g>

          {/* Inner shadows overlay */}
          <g filter="url(#di-inner)">
            <path
              d="M7 17C7 9.268 13.268 3 21 3H129.901C137.872 3 145.514 6.172 151.143 11.815L211.242 72.075C216.85 77.699 220 85.317 220 93.26V269C220 276.732 213.732 283 206 283H21C13.268 283 7 276.732 7 269V17Z"
              fill="white"
              fillOpacity="0.01"
              style={{ mixBlendMode: 'darken' }}
            />
          </g>

          {/* Outline */}
          <path
            d="M129.901 2.5C138.005 2.5 145.775 5.724 151.497 11.462L211.596 71.723C217.298 77.44 220.5 85.185 220.5 93.26V269C220.5 277.008 214.008 283.5 206 283.5H21C12.992 283.5 6.5 277.008 6.5 269V17C6.5 8.992 12.992 2.5 21 2.5H129.901Z"
            stroke="black"
            strokeOpacity="0.08"
            fill="none"
          />
        </g>
      </svg>

      {/* Extension badge — bottom-center of document */}
      <div
        className={cn('absolute left-1/2 -translate-x-1/2 uppercase leading-none tracking-wide select-none', BADGE_STYLES[badgeSize])}
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        {badgeLabel}
      </div>
    </div>
  )
}
