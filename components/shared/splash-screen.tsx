'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function SplashScreen() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  // Skip the splash entirely on public presentation/ficha routes. Puppeteer
  // snapshots the PDF within ~1s of network idle, so a 2.4s splash overlay
  // would otherwise cover every page.
  const skip =
    pathname?.startsWith('/apresentacao') || pathname?.startsWith('/fichas')

  useEffect(() => {
    if (skip) {
      setVisible(false)
      return
    }
    const fadeTimer = setTimeout(() => setFadeOut(true), 1800)
    const removeTimer = setTimeout(() => setVisible(false), 2400)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [skip])

  if (!visible || skip) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#09090b] transition-opacity duration-600 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <svg
        height={80}
        preserveAspectRatio="xMidYMid"
        viewBox="0 0 100 100"
        width={80}
        xmlns="http://www.w3.org/2000/svg"
        className="sm:w-[100px] sm:h-[100px]"
      >
        <path
          d="M24.3 30C11.4 30 5 43.3 5 50s6.4 20 19.3 20c19.3 0 32.1-40 51.4-40 C88.6 30 95 43.3 95 50s-6.4 20-19.3 20C56.4 70 43.6 30 24.3 30z"
          fill="none"
          stroke="white"
          strokeDasharray="205.271142578125 51.317785644531256"
          strokeLinecap="round"
          strokeWidth="6"
          style={{ transform: 'scale(0.8)', transformOrigin: '50px 50px' }}
        >
          <animate
            attributeName="stroke-dashoffset"
            dur="2s"
            keyTimes="0;1"
            repeatCount="indefinite"
            values="0;256.58892822265625"
          />
        </path>
      </svg>

      <div className="mt-6 text-center splash-text">
        <p className="text-white text-xl sm:text-2xl font-light tracking-[0.2em]">
          infinity group
        </p>
      </div>

      <style jsx>{`
        .splash-text {
          opacity: 0;
          animation: fade-in-text 0.8s ease-out 0.6s forwards;
        }
        @keyframes fade-in-text {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
