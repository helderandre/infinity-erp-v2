'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface ImageCompareSliderProps {
  originalUrl: string
  modifiedUrl: string
  originalLabel?: string
  modifiedLabel?: string
  className?: string
  showLabels?: boolean
}

export function ImageCompareSlider({
  originalUrl,
  modifiedUrl,
  originalLabel = 'Original',
  modifiedLabel = 'IA',
  className,
  showLabels = true,
}: ImageCompareSliderProps) {
  const [position, setPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.min(100, Math.max(0, (x / rect.width) * 100))
    setPosition(pct)
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      updatePosition(e.clientX)
    },
    [updatePosition]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return
      updatePosition(e.clientX)
    },
    [updatePosition]
  )

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full aspect-[16/10] overflow-hidden rounded-lg select-none cursor-col-resize',
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Modified image (full, behind) */}
      <Image
        src={modifiedUrl}
        alt={modifiedLabel}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 50vw"
        draggable={false}
      />

      {/* Original image (clipped) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <Image
          src={originalUrl}
          alt={originalLabel}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          draggable={false}
        />
      </div>

      {/* Slider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
      >
        {/* Handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="text-slate-600"
          >
            <path
              d="M5 3L2 8L5 13M11 3L14 8L11 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Labels */}
      {showLabels && (
        <>
          <div className="absolute top-2 left-2 z-20">
            <span className="rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {originalLabel}
            </span>
          </div>
          <div className="absolute top-2 right-2 z-20">
            <span className="rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {modifiedLabel}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
