"use client";

export function InfinityLoader() {
  // Smooth lemniscate-style infinity, wide and slightly flattened
  const d =
    'M60,25 C45,0 10,0 10,25 C10,50 45,50 60,25 C75,0 110,0 110,25 C110,50 75,50 60,25';

  const len = 300;

  return (
    <div className="flex items-center justify-center py-20">
      <svg
        width="160"
        height="65"
        viewBox="0 0 120 50"
        fill="none"
        aria-label="Loading"
      >
        {/* Faint track */}
        <path d={d} stroke="#e5e7eb" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* Animated segment */}
        <path
          d={d}
          stroke="black"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          style={{
            strokeDasharray: `${len * 0.35} ${len * 0.65}`,
            animation: 'infinityDraw 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        />

        <style>{`
          @keyframes infinityDraw {
            0%   { stroke-dashoffset: ${len}; }
            100% { stroke-dashoffset: 0; }
          }
        `}</style>
      </svg>
    </div>
  );
}
