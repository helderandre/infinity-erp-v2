import { cn } from '@infinity/ui/cn'

export function PageHero({
  title,
  subtitle,
  kpis,
}: {
  title: string
  subtitle?: string
  kpis?: { label: string; value: string | number }[]
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-neutral-900">
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
      <div className="relative z-10 space-y-4 px-8 py-8 sm:px-10 sm:py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
        </div>

        {kpis && kpis.length > 0 && (
          <div className="flex justify-center">
            <div className="inline-flex items-stretch overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
              {kpis.map((k, i) => (
                <div
                  key={k.label}
                  className={cn(
                    'flex min-w-[88px] flex-col items-center justify-center gap-0.5 px-5 py-2.5',
                    i > 0 && 'border-l border-white/10',
                  )}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">{k.label}</span>
                  <span className="text-base font-bold tabular-nums text-white">{k.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-200 bg-white/60 px-6 py-16 text-center">
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-neutral-400">{hint}</p>}
    </div>
  )
}
