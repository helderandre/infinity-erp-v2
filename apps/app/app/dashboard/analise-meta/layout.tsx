// A secção standalone "Análise Meta" foi descontinuada — vive agora em
// CRM → Análise → Meta (components/analise-meta/meta-section-tabs.tsx). Só
// permanecem as páginas de detalhe (campanha / anúncio / formulário / lead),
// alcançadas por drill-in a partir do imóvel, da lead ou do CRM. Sem chrome de
// tabs aqui — cada detalhe tem o seu próprio cabeçalho + botão voltar.
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
      {children}
    </div>
  )
}
