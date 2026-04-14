'use client'

import { cn } from '@/lib/utils'

interface FolderIconProps {
  className?: string
  /** 'filled' (default closed folder) or 'open' (open folder empty-state) */
  variant?: 'filled' | 'open'
  /** When true, the front panel tilts open with a 3D perspective effect */
  hovered?: boolean
  /** Optional Lucide icon component rendered centered on the folder body */
  icon?: React.ComponentType<{ className?: string }>
  /** Semantic state. Overrides `variant` when set: 'empty' → open folder. 'selected' adds no extra chrome here (wrapper applies ring). */
  state?: 'empty' | 'filled' | 'selected'
  /** Optional thumbnail image rendered "peeking" out of the folder (good for image-heavy folders). */
  thumbnailUrl?: string
  /** Optional count badge shown on the top-right corner. */
  badgeCount?: number
}

// Shared defs used by both layers — extracted to avoid duplication.
// Each SVG gets its own copy (SVG defs are scoped to their document).

function TabSvg() {
  return (
    <svg
      viewBox="0 0 273 232"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <filter id="ft-drop" x="0" y="0" width="273" height="232" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="bg" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha" />
          <feOffset dy="4" />
          <feGaussianBlur stdDeviation="3" />
          <feComposite in2="ha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.18 0" />
          <feBlend mode="normal" in2="bg" result="ds" />
          <feBlend mode="normal" in="SourceGraphic" in2="ds" result="shape" />
        </filter>
        <filter id="ft-inner" x="5" y="1" width="263" height="224" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="bg" />
          <feBlend mode="normal" in="SourceGraphic" in2="bg" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha" />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="15" />
          <feComposite in2="ha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0" />
          <feBlend mode="soft-light" in2="shape" result="is" />
        </filter>
        <linearGradient id="gt-tab" x1="136.5" y1="2" x2="136.5" y2="222" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'var(--folder-tab-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--folder-tab-to)' }} />
        </linearGradient>
      </defs>

      <g filter="url(#ft-drop)">
        <g filter="url(#ft-inner)">
          <path d="M6 27C6 13.1929 17.1929 2 31 2H70.4566C81.0344 2 91.3397 5.35466 99.8904 11.5815L108.54 17.8804C112.815 20.9938 117.968 22.6711 123.257 22.6711H242C255.807 22.6711 267 33.864 267 47.6711V197C267 210.807 255.807 222 242 222H31C17.1929 222 6 210.807 6 197V27Z" fill="url(#gt-tab)" />
        </g>
        <path
          d="M70.457 1.5C81.1405 1.50008 91.5484 4.88866 100.185 11.1777L108.834 17.4766C113.024 20.5277 118.074 22.1709 123.257 22.1709H242C256.083 22.1709 267.5 33.5877 267.5 47.6709V197C267.5 211.083 256.083 222.5 242 222.5H31C16.9167 222.5 5.5 211.083 5.5 197V27C5.5 12.9167 16.9167 1.5 31 1.5H70.457Z"
          stroke="black"
          strokeOpacity="0.08"
          fill="none"
        />
      </g>
    </svg>
  )
}

function BodySvg() {
  return (
    <svg
      viewBox="0 0 273 232"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full"
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <filter id="fb-blur" x="-34" y="-7" width="341" height="259" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="bg" />
          <feBlend mode="normal" in="SourceGraphic" in2="bg" result="shape" />
          <feGaussianBlur stdDeviation="20" result="blur" />
        </filter>
        <filter id="fb-body" x="4" y="34" width="265" height="190" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="bg" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha" />
          <feOffset dy="-1" />
          <feGaussianBlur stdDeviation="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0" />
          <feBlend mode="normal" in2="bg" result="ds" />
          <feBlend mode="normal" in="SourceGraphic" in2="ds" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha2" />
          <feOffset dy="-5" />
          <feGaussianBlur stdDeviation="40" />
          <feComposite in2="ha2" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
          <feBlend mode="soft-light" in2="shape" result="is1" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha3" />
          <feOffset dy="-5" />
          <feGaussianBlur stdDeviation="20" />
          <feComposite in2="ha3" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
          <feBlend mode="soft-light" in2="is1" result="is2" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha4" />
          <feOffset dy="3" />
          <feGaussianBlur stdDeviation="1" />
          <feComposite in2="ha4" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.08 0" />
          <feBlend mode="normal" in2="is2" result="is3" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha5" />
          <feOffset dy="-4" />
          <feGaussianBlur stdDeviation="3" />
          <feComposite in2="ha5" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.75 0" />
          <feBlend mode="soft-light" in2="is3" result="is4" />
        </filter>
        <linearGradient id="gb-body" x1="136.5" y1="39" x2="136.5" y2="222" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'var(--folder-body-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--folder-body-to)' }} />
        </linearGradient>
        <radialGradient id="gb-radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(136.5 59) rotate(90) scale(179 255)">
          <stop stopColor="white" />
          <stop offset="1" stopColor="black" />
        </radialGradient>
      </defs>

    

      {/* Body panel */}
      <g filter="url(#fb-body)">
        <rect x="6" y="39" width="261" height="183" rx="25" fill="url(#gb-body)" />
        <rect x="6" y="39" width="261" height="183" rx="25" fill="url(#gb-radial)" fillOpacity="0.15" style={{ mixBlendMode: 'soft-light' }} />
      </g>
    </svg>
  )
}

/**
 * Custom folder icon with gradients and shadows.
 * Tab and body are separate HTML layers so that CSS 3D perspective
 * can be applied to the front panel on hover.
 */
export function FolderIcon({
  className,
  variant = 'filled',
  hovered = false,
  icon: Icon,
  state,
  thumbnailUrl,
  badgeCount,
}: FolderIconProps) {
  const effectiveVariant: 'filled' | 'open' =
    state === 'empty' ? 'open' : state === 'filled' || state === 'selected' ? 'filled' : variant

  if (effectiveVariant === 'open') {
    return (
      <div className={cn('relative', className)}>
        <FolderOpenIcon className="h-full w-full" />
        {badgeCount != null && badgeCount > 0 && <FolderBadge count={badgeCount} />}
      </div>
    )
  }

  return (
    <div
      className={cn('relative h-16 w-16 shrink-0', className)}
      style={{ perspective: '800px' }}
    >
      {/* Back layer: tab — stays static */}
      <TabSvg />

      {/* Thumbnail image peeking between tab and body, if provided */}
      {thumbnailUrl && (
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div
            className="mt-[14%] h-[54%] w-[72%] overflow-hidden rounded-md border border-white/40 bg-white shadow-sm"
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      )}

      {/* Front layer: body — tilts on hover from bottom-center */}
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{
          transformOrigin: 'center bottom',
          transform: hovered ? 'rotateX(-25deg)' : 'rotateX(0deg)',
        }}
      >
        <BodySvg />

        {/* Optional icon overlay centered on the body panel */}
        {Icon && !thumbnailUrl && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ top: '10%' }}>
            <Icon className="w-[20%] h-[20%] text-neutral-50" />
          </div>
        )}
      </div>

      {badgeCount != null && badgeCount > 0 && <FolderBadge count={badgeCount} />}
    </div>
  )
}

function FolderBadge({ count }: { count: number }) {
  return (
    <span
      className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.65rem] font-semibold leading-none text-primary-foreground shadow-sm"
      aria-label={`${count} ficheiros`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/** Open folder variant for empty states */
function FolderOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-16 w-16 shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <filter id="fo-drop" x="0" y="0" width="280" height="240" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="bg" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha" />
          <feOffset dy="4" />
          <feGaussianBlur stdDeviation="3" />
          <feComposite in2="ha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0" />
          <feBlend mode="normal" in2="bg" result="ds" />
          <feBlend mode="normal" in="SourceGraphic" in2="ds" result="shape" />
        </filter>

        <linearGradient id="fo-tab" x1="130" y1="5" x2="130" y2="220" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'var(--folder-tab-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--folder-tab-to)' }} />
        </linearGradient>

        <linearGradient id="fo-body" x1="140" y1="55" x2="140" y2="225" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'var(--folder-body-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--folder-body-to)' }} />
        </linearGradient>

        <radialGradient id="fo-radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(140 75) rotate(90) scale(155 245)">
          <stop stopColor="white" />
          <stop offset="1" stopColor="black" />
        </radialGradient>
      </defs>

      <g filter="url(#fo-drop)">
        <path
          d="M12 30C12 17.85 21.85 8 34 8H70C79.8 8 89 11.2 96.5 16.2L105 22C109 24.5 114 26 119 26H245C257.15 26 267 35.85 267 48V200C267 212.15 257.15 222 245 222H34C21.85 222 12 212.15 12 200V30Z"
          fill="url(#fo-tab)"
          opacity="0.45"
        />
        <path d="M12 56H267" stroke="black" strokeOpacity="0.06" />
        <rect x="8" y="55" width="264" height="170" rx="20" fill="url(#fo-body)" />
        <rect x="8" y="55" width="264" height="170" rx="20" fill="url(#fo-radial)" fillOpacity="0.35" style={{ mixBlendMode: 'soft-light' }} />
        <rect x="8.5" y="55.5" width="263" height="169" rx="19.5" stroke="black" strokeOpacity="0.06" fill="none" />
      </g>
    </svg>
  )
}
