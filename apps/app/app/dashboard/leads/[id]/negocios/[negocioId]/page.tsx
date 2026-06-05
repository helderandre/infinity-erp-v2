import { redirect } from 'next/navigation'

/**
 * A página dedicada do negócio foi descontinuada — o detalhe vive agora numa
 * sheet aberta a partir da página do lead (ou do CRM kanban).
 *
 * Este redirect mantém os links antigos válidos (`/dashboard/leads/<id>/negocios/<id>`
 * → `/dashboard/leads/<id>?negocio=<id>`).
 */
export default async function NegocioRedirectPage({
  params,
}: {
  params: Promise<{ id: string; negocioId: string }>
}) {
  const { id, negocioId } = await params
  redirect(`/dashboard/leads/${id}?negocio=${negocioId}`)
}
