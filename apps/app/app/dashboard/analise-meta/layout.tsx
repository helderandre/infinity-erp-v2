import { MetaChrome } from './_components/meta-chrome'

export default function AnaliseMetaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative space-y-6 p-6">
      {/* Ambient glow — feeds the glassmorphic cards below */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-64 bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent blur-2xl"
      />
      {/* Title + tabs — only on the list views, hidden inside a record */}
      <MetaChrome />

      {children}
    </div>
  )
}
