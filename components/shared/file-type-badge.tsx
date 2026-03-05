import { cn } from '@/lib/utils'

const FILE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  pdf: { bg: 'bg-red-100', text: 'text-red-600' },
  doc: { bg: 'bg-blue-100', text: 'text-blue-600' },
  docx: { bg: 'bg-blue-100', text: 'text-blue-600' },
  xls: { bg: 'bg-green-100', text: 'text-green-600' },
  xlsx: { bg: 'bg-green-100', text: 'text-green-600' },
  csv: { bg: 'bg-green-100', text: 'text-green-600' },
  ppt: { bg: 'bg-orange-100', text: 'text-orange-600' },
  pptx: { bg: 'bg-orange-100', text: 'text-orange-600' },
  jpg: { bg: 'bg-purple-100', text: 'text-purple-600' },
  jpeg: { bg: 'bg-purple-100', text: 'text-purple-600' },
  png: { bg: 'bg-pink-100', text: 'text-pink-600' },
  gif: { bg: 'bg-pink-100', text: 'text-pink-600' },
  webp: { bg: 'bg-pink-100', text: 'text-pink-600' },
  svg: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  zip: { bg: 'bg-amber-100', text: 'text-amber-600' },
  rar: { bg: 'bg-amber-100', text: 'text-amber-600' },
  '7z': { bg: 'bg-amber-100', text: 'text-amber-600' },
  txt: { bg: 'bg-slate-100', text: 'text-slate-600' },
  mp4: { bg: 'bg-violet-100', text: 'text-violet-600' },
  mp3: { bg: 'bg-teal-100', text: 'text-teal-600' },
}

interface FileTypeBadgeProps {
  fileName: string
  className?: string
}

export function FileTypeBadge({ fileName, className }: FileTypeBadgeProps) {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  const colors = FILE_TYPE_COLORS[extension] ?? { bg: 'bg-slate-100', text: 'text-slate-500' }
  const label = extension.toUpperCase().slice(0, 4)

  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded',
        colors.bg,
        className,
      )}
    >
      <span className={cn('text-[10px] font-bold leading-none tracking-tight', colors.text)}>
        {label}
      </span>
    </div>
  )
}
