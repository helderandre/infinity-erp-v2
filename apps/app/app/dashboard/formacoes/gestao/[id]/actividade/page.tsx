import { requirePermission } from '@/lib/auth/permissions'
import { CourseActivityClient } from '@/components/training/admin/course-activity-client'
import { NoPermissionEmptyState } from '@/components/training/admin/no-permission-empty-state'

export default async function CourseActivityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const auth = await requirePermission('training')
  if (!auth.authorized) {
    return <NoPermissionEmptyState />
  }
  return <CourseActivityClient courseId={id} />
}
