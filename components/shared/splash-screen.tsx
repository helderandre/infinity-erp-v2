'use client'

import { useEffect, useState } from 'react'

export function SplashScreen() {
  const [visible, setVisible] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    // Start fade-out after 1.8s
    const fadeTimer = setTimeout(() => setFadeOut(true), 1800)
    // Remove from DOM after fade completes
    const removeTimer = setTimeout(() => setVisible(false), 2400)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#09090b] transition-opacity duration-600 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated infinity symbol */}
      <svg
        viewBox="0 0 200 100"
        className="w-32 h-16 sm:w-40 sm:h-20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50 C100 25, 65 10, 45 25 C25 40, 25 60, 45 75 C65 90, 100 75, 100 50 C100 25, 135 10, 155 25 C175 40, 175 60, 155 75 C135 90, 100 75, 100 50Z"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="infinity-path"
        />
      </svg>

      {/* Text */}
      <div className="mt-6 text-center splash-text">
        <p className="text-white text-xl sm:text-2xl font-light tracking-[0.2em]">
          infinity group
        </p>
      </div>

      <style jsx>{`
        .infinity-path {
          stroke-dasharray: 520;
          stroke-dashoffset: 520;
          animation: draw-infinity 1.6s ease-in-out forwards;
        }

        .splash-text {
          opacity: 0;
          animation: fade-in-text 0.8s ease-out 1s forwards;
        }

        @keyframes draw-infinity {
          0% {
            stroke-dashoffset: 520;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }

        @keyframes fade-in-text {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
