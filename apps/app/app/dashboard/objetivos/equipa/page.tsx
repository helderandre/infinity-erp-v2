import { redirect } from 'next/navigation'

/**
 * Legacy URL — agora os relatórios semanais vivem como tab dentro de
 * /dashboard/objetivos para utilizadores manager. Mantemos um redirect
 * para não partir bookmarks.
 */
export default function EquipaPage() {
  redirect('/dashboard/objetivos?tab=relatorios')
}
