import { redirect } from 'next/navigation'

// O detalhe do candidato passou a abrir em sheet sobre o quadro (design
// quintino). Links antigos /dashboard/recrutamento/<id> continuam a funcionar
// via este redirect (dashboard, calendário, alertas, notificações push).
export default async function CandidateDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dashboard/recrutamento/candidatos?candidato=${id}`)
}
