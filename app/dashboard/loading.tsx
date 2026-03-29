export default function DashboardLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <svg
          viewBox="0 0 200 100"
          className="w-24 h-12 opacity-40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M100 50 C100 25, 65 10, 45 25 C25 40, 25 60, 45 75 C65 90, 100 75, 100 50 C100 25, 135 10, 155 25 C175 40, 175 60, 155 75 C135 90, 100 75, 100 50Z"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
            style={{
              strokeDasharray: 520,
              strokeDashoffset: 520,
              animation: 'draw-loop 1.4s ease-in-out infinite',
            }}
          />
        </svg>
        <style>{`
          @keyframes draw-loop {
            0% { stroke-dashoffset: 520; }
            50% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -520; }
          }
        `}</style>
      </div>
    </div>
  )
}
