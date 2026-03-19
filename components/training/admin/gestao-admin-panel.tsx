// @ts-nocheck
'use client'

import { useState } from 'react'
import { BarChart3, AlertTriangle, MessageSquare, Download, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CourseFilterSelect } from './course-filter-select'
import { CompletionOverview } from './completion-overview'
import { ReportsTable } from './reports-table'
import { CommentsTable } from './comments-table'
import { DownloadsTable } from './downloads-table'
import { UserProgressTable } from './user-progress-table'

const ADMIN_SUB_TABS = [
  { key: 'overview', label: 'Visão Geral', icon: BarChart3 },
  { key: 'reports', label: 'Reports', icon: AlertTriangle },
  { key: 'comments', label: 'Comentários', icon: MessageSquare },
  { key: 'downloads', label: 'Downloads', icon: Download },
  { key: 'users', label: 'Utilizadores', icon: Users },
] as const

type AdminSubTabKey = (typeof ADMIN_SUB_TABS)[number]['key']

export function GestaoAdminPanel() {
  const [subTab, setSubTab] = useState<AdminSubTabKey>('overview')
  const [courseId, setCourseId] = useState('all')

  const effectiveCourseId = courseId === 'all' ? undefined : courseId

  return (
    <div className="space-y-5">
      {/* Toolbar: sub-tabs + course filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 border border-border/30">
          {ADMIN_SUB_TABS.map((tab) => {
            const isActive = subTab === tab.key
            const Icon = tab.icon
            return (
              <button
                type="button"
                key={tab.key}
                onClick={() => setSubTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
                  isActive
                    ? 'bg-neutral-800 text-white shadow-sm dark:bg-white/90 dark:text-neutral-900'
                    : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <CourseFilterSelect value={courseId} onChange={setCourseId} />
      </div>

      {/* Content */}
      <div className="animate-in fade-in duration-300">
        {subTab === 'overview' && <CompletionOverview courseId={effectiveCourseId} />}
        {subTab === 'reports' && <ReportsTable courseId={effectiveCourseId} />}
        {subTab === 'comments' && <CommentsTable courseId={effectiveCourseId} />}
        {subTab === 'downloads' && <DownloadsTable courseId={effectiveCourseId} />}
        {subTab === 'users' && <UserProgressTable />}
      </div>
    </div>
  )
}
