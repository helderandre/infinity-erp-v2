// Open to all authenticated users — consultor sees the team in read-only.
// Mutation controls inside the pages are gated by `consultants` permission.
export default function ConsultoresLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
