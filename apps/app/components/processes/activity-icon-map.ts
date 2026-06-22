import type { ComponentType } from 'react'
import {
  RefreshCw, UserPlus, Flag, CalendarClock, Ban,
  Upload, Mail, FileText, PlayCircle, CheckCircle2,
  Eye, PenLine, MessageSquare, Activity,
  MailCheck, MailOpen, MousePointerClick, MailX, AlertCircle, MailPlus, Clock,
  RotateCcw, CalendarPlus, CalendarX,
  Plus, Trash2, ListPlus, ListMinus, CircleCheck,
  Sparkles, CheckSquare,
  FileUp, FileCheck2, FileX, BadgeCheck, UserPen,
} from 'lucide-react'

/**
 * Mapa string → ícone Lucide para os tipos de actividade
 * (`TASK_ACTIVITY_TYPE_CONFIG` em lib/constants). Partilhado entre a
 * `<TaskActivityTimeline>` e a `<ProcessHistorySheet>` para evitar divergência
 * — inclui os ícones das submissões do proprietário (FileUp/FileCheck2/…).
 */
export const ACTIVITY_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  RefreshCw, UserPlus, Flag, CalendarClock, Ban,
  Upload, Mail, FileText, PlayCircle, CheckCircle2,
  Eye, PenLine, MessageSquare, Activity,
  MailCheck, MailOpen, MousePointerClick, MailX, AlertCircle, MailPlus, Clock,
  RotateCcw, CalendarPlus, CalendarX,
  Plus, Trash2, ListPlus, ListMinus, CircleCheck,
  Sparkles, CheckSquare,
  FileUp, FileCheck2, FileX, BadgeCheck, UserPen,
}
