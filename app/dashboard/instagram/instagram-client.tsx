"use client"

import { useState, useTransition, useEffect } from "react"
import {
  Image as ImageIcon,
  Film as FilmStripIcon,
  MessageCircle as ChatCircleIcon,
  Calendar as CalendarIcon,
  Heart as HeartIcon,
  Eye as EyeIcon,
  Bookmark as BookmarkSimpleIcon,
  Share2 as ShareNetworkIcon,
  Play as PlayIcon,
  Users as UsersIcon,
  TrendingUp as TrendUpIcon,
  AlertCircle as WarningCircleIcon,
  ExternalLink as ArrowSquareOutIcon,
  Send as PaperPlaneTiltIcon,
  Loader2 as SpinnerIcon,
  CheckCircle2 as CheckCircleIcon,
  ChevronRight as CaretRightIcon,
  BarChart3 as ChartBarIcon,
  Instagram as InstagramLogoIcon,
  Filter as FunnelSimpleIcon,
  X as XIcon,
  Plus as PlusIcon,
  ImageIcon as ImageSquareIcon,
  Video as VideoCameraIcon,
  Clock as ClockIcon,
  Trash2 as TrashSimpleIcon,
  Upload as UploadSimpleIcon,
  Globe as GlobeIcon,
  Search as MagnifyingGlassIcon,
  Users2 as GenderIntersexIcon,
  MapPin as MapPinIcon,
  Flag as FlagIcon,
  Zap as MetaLogoIcon,
  Trash as TrashIcon,
  RefreshCw as ArrowsClockwiseIcon,
  Binoculars as BinocularsIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import type { IGMedia, IGComment, IGProfile, ScheduledPostRow, IGDemographics, IGCompetitor } from "./actions"
import { replyToComment, publishIGMediaWithUpload, createScheduledPost, deleteScheduledPost, publishScheduledPost, getIGDemographics, getCompetitorProfile } from "./actions"
import type { SavedCompetitor, CompetitorProfile, AdLibraryAd } from "../competitors/actions"
import { addCompetitor as addSavedCompetitor, removeCompetitor, refreshCompetitorSnapshot, fetchCompetitorProfile, searchAdLibrary } from "../competitors/actions"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return new Intl.NumberFormat("pt-PT").format(n) }
function fmtPct(n: number) { return `${n.toFixed(2)}%` }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" }) }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) }
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mes`
}

// ─── Tab types ───────────────────────────────────────────────────────────────

type Tab = "posts" | "reels" | "comentarios" | "calendario" | "demograficos" | "concorrentes"

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "posts", label: "Top Posts", icon: ImageIcon },
  { key: "reels", label: "Reels", icon: FilmStripIcon },
  { key: "comentarios", label: "Comentarios", icon: ChatCircleIcon },
  { key: "calendario", label: "Calendario", icon: CalendarIcon },
  { key: "demograficos", label: "Audiencia", icon: UsersIcon },
  { key: "concorrentes", label: "Concorrentes", icon: MagnifyingGlassIcon },
]

// ─── Profile folder tabs ────────────────────────────────────────────────────

function ProfileFolderTab({ profile, isActive, onClick }: { profile: IGProfile; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 px-5 py-4 rounded-t-2xl transition-all duration-200 text-left min-w-0",
        isActive
          ? "bg-card border border-border border-b-transparent z-10 -mb-px"
          : "bg-muted/60 border border-transparent hover:bg-muted opacity-70 hover:opacity-100"
      )}
    >
      {/* Avatar */}
      <div className={cn("shrink-0 rounded-full p-0.5", isActive ? "bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737]" : "bg-muted-foreground/30")}>
        <Avatar className="h-9 w-9 border-2 border-background">
          <AvatarImage src={profile.profile_picture_url ?? undefined} alt={profile.username} />
          <AvatarFallback>
            <InstagramLogoIcon className="h-4 w-4 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Info */}
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold truncate", isActive ? "text-foreground" : "text-muted-foreground")}>
          @{profile.username}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{profile.name}</p>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-4 ml-auto pl-4">
        <div className="text-center">
          <p className={cn("text-sm font-bold", isActive ? "text-foreground" : "text-muted-foreground")}>{fmt(profile.media_count)}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Posts</p>
        </div>
        <div className="text-center">
          <p className={cn("text-sm font-bold", isActive ? "text-foreground" : "text-muted-foreground")}>{fmt(profile.followers_count)}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Seguidores</p>
        </div>
        <div className="text-center">
          <p className={cn("text-sm font-bold", isActive ? "text-foreground" : "text-muted-foreground")}>{fmt(profile.follows_count)}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">A seguir</p>
        </div>
      </div>
    </button>
  )
}

// ─── Media card ──────────────────────────────────────────────────────────────

function MediaCard({ media }: { media: IGMedia }) {
  const isVideo = media.media_type === "VIDEO" || media.media_type === "REELS"
  const thumb = media.thumbnail_url ?? media.media_url

  return (
    <a
      href={media.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group"
    >
      <Card className="overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        {/* Thumbnail */}
        <div className="relative aspect-square bg-muted overflow-hidden">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
          {isVideo && (
            <div className="absolute top-2 right-2">
              <div className="bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
                <PlayIcon className="h-2.5 w-2.5 text-white" />
                {media.plays > 0 && <span className="text-[10px] text-white font-medium">{fmt(media.plays)}</span>}
              </div>
            </div>
          )}
          {media.media_type === "CAROUSEL_ALBUM" && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1.5">
              <ImageIcon className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        {/* Metrics */}
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><HeartIcon className="h-3 w-3 text-red-400" />{fmt(media.like_count)}</span>
              <span className="flex items-center gap-1"><ChatCircleIcon className="h-3 w-3" />{fmt(media.comments_count)}</span>
              <span className="flex items-center gap-1"><BookmarkSimpleIcon className="h-3 w-3" />{fmt(media.saved)}</span>
              <span className="flex items-center gap-1"><PaperPlaneTiltIcon className="h-3 w-3" />{fmt(media.shares)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5"><EyeIcon className="h-2.5 w-2.5" />{fmt(media.reach)}</span>
            </div>
            <Badge
              variant={media.engagement_rate >= 5 ? "default" : media.engagement_rate >= 2 ? "secondary" : "outline"}
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5",
                media.engagement_rate >= 5
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100"
                  : media.engagement_rate >= 2
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100"
                    : ""
              )}
            >
              {fmtPct(media.engagement_rate)} ER
            </Badge>
          </div>

          {media.caption && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
              {media.caption}
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">{fmtDate(media.timestamp)}</p>
            <Badge variant="outline" className="text-[9px] font-medium">
              {media.account_name}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </a>
  )
}

// ─── Posts tab ────────────────────────────────────────────────────────────────

function PostsTab({ media }: { media: IGMedia[] }) {
  const posts = media
    .filter((m) => m.media_type === "IMAGE" || m.media_type === "CAROUSEL_ALBUM")
    .sort((a, b) => b.engagement_rate - a.engagement_rate)

  // Summary metrics
  const totalReach = posts.reduce((s, m) => s + m.reach, 0)
  const totalEngagement = posts.reduce((s, m) => s + m.engagement, 0)
  const avgER = posts.length > 0 ? posts.reduce((s, m) => s + m.engagement_rate, 0) / posts.length : 0
  const totalSaved = posts.reduce((s, m) => s + m.saved, 0)

  const summaryMetrics = [
    { icon: ImageIcon, label: "Posts", value: fmt(posts.length), color: "text-purple-500" },
    { icon: EyeIcon, label: "Alcance total", value: fmt(totalReach) },
    { icon: HeartIcon, label: "Engagement total", value: fmt(totalEngagement), color: "text-red-400" },
    { icon: TrendUpIcon, label: "ER medio", value: fmtPct(avgER), color: "text-emerald-500" },
    { icon: BookmarkSimpleIcon, label: "Guardados", value: fmt(totalSaved), color: "text-amber-500" },
  ]

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {summaryMetrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <m.icon className={cn("h-3.25 w-3.25", m.color ?? "text-muted-foreground")} />
                <span className="text-[11px] text-muted-foreground">{m.label}</span>
              </div>
              <p className={cn("text-lg font-bold", m.color ?? "text-foreground")}>{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Sem posts encontrados</p>
        </div>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-foreground">
            Ordenado por Engagement Rate
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map((m) => <MediaCard key={m.id} media={m} />)}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Reels tab ───────────────────────────────────────────────────────────────

function ReelsTab({ media }: { media: IGMedia[] }) {
  type SortKey = "engagement_rate" | "plays" | "saved" | "shares"
  const [sortBy, setSortBy] = useState<SortKey>("plays")

  const reels = media
    .filter((m) => m.media_type === "REELS" || m.media_type === "VIDEO")
    .sort((a, b) => b[sortBy] - a[sortBy])

  const totalPlays = reels.reduce((s, m) => s + m.plays, 0)
  const totalReach = reels.reduce((s, m) => s + m.reach, 0)
  const avgER = reels.length > 0 ? reels.reduce((s, m) => s + m.engagement_rate, 0) / reels.length : 0
  const totalShares = reels.reduce((s, m) => s + m.shares, 0)

  const summaryMetrics = [
    { icon: FilmStripIcon, label: "Reels", value: fmt(reels.length), color: "text-purple-500" },
    { icon: PlayIcon, label: "Reproducoes", value: fmt(totalPlays), color: "text-blue-500" },
    { icon: EyeIcon, label: "Alcance total", value: fmt(totalReach) },
    { icon: TrendUpIcon, label: "ER medio", value: fmtPct(avgER), color: "text-emerald-500" },
    { icon: ShareNetworkIcon, label: "Partilhas", value: fmt(totalShares), color: "text-sky-500" },
  ]

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "plays", label: "Reproducoes" },
    { key: "engagement_rate", label: "Engagement" },
    { key: "saved", label: "Guardados" },
    { key: "shares", label: "Partilhas" },
  ]

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {summaryMetrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <m.icon className={cn("h-3.25 w-3.25", m.color ?? "text-muted-foreground")} />
                <span className="text-[11px] text-muted-foreground">{m.label}</span>
              </div>
              <p className={cn("text-lg font-bold", m.color ?? "text-foreground")}>{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sort control */}
      <div className="flex items-center gap-2 overflow-x-auto">
        <FunnelSimpleIcon className="h-3.25 w-3.25 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground shrink-0">Ordenar:</span>
        <div className="flex items-center gap-1 rounded-lg border p-0.5 bg-muted/50">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150",
                sortBy === opt.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FilmStripIcon className="h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Sem reels encontrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {reels.map((m) => <MediaCard key={m.id} media={m} />)}
        </div>
      )}
    </div>
  )
}

// ─── Comment reply dialog ────────────────────────────────────────────────────

function CommentReplyForm({ commentId, onDone }: { commentId: string; onDone: () => void }) {
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleReply() {
    if (!message.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await replyToComment(commentId, message.trim())
      if (result.success) {
        setMessage("")
        onDone()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleReply()}
          placeholder="Escrever resposta..."
          className="flex-1 h-8 rounded-full text-xs"
          disabled={isPending}
        />
        <Button
          onClick={handleReply}
          disabled={isPending || !message.trim()}
          size="icon"
          className="shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90"
        >
          {isPending ? <SpinnerIcon className="h-3 w-3 animate-spin" /> : <PaperPlaneTiltIcon className="h-3 w-3" />}
        </Button>
      </div>
      {error && (
        <p className="text-[10px] text-destructive flex items-center gap-1">
          <WarningCircleIcon className="h-2.5 w-2.5" /> {error}
        </p>
      )}
    </div>
  )
}

// ─── Comments tab ────────────────────────────────────────────────────────────

const SENTIMENT_CONFIG = {
  positive: { label: "Positivo", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  neutral: { label: "Neutro", dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground" },
  negative: { label: "Negativo", dot: "bg-destructive", badge: "bg-destructive/10 text-destructive" },
}

function CommentsTab({ comments }: { comments: IGComment[] }) {
  const [filter, setFilter] = useState<"all" | "positive" | "neutral" | "negative">("all")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  const filtered = filter === "all" ? comments : comments.filter((c) => c.sentiment === filter)

  const negativeCount = comments.filter((c) => c.sentiment === "negative").length
  const positiveCount = comments.filter((c) => c.sentiment === "positive").length

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <ChatCircleIcon className="h-3.25 w-3.25 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Total</span>
            </div>
            <p className="text-lg font-bold text-foreground">{fmt(comments.length)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircleIcon className="h-3.25 w-3.25 text-emerald-500" />
              <span className="text-[11px] text-muted-foreground">Positivos</span>
            </div>
            <p className="text-lg font-bold text-emerald-500">{fmt(positiveCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <WarningCircleIcon className="h-3.25 w-3.25 text-destructive" />
              <span className="text-[11px] text-muted-foreground">Negativos</span>
            </div>
            <p className="text-lg font-bold text-destructive">{fmt(negativeCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <TrendUpIcon className="h-3.25 w-3.25 text-sky-500" />
              <span className="text-[11px] text-muted-foreground">Sentimento</span>
            </div>
            <p className={cn("text-lg font-bold", negativeCount === 0 ? "text-emerald-500" : negativeCount > positiveCount ? "text-destructive" : "text-amber-500")}>
              {comments.length > 0 ? fmtPct((positiveCount / comments.length) * 100) : "---"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 rounded-lg border p-0.5 bg-muted/50 w-fit">
          {(["all", "negative", "neutral", "positive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150",
                filter === f
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? `Todos (${comments.length})` : `${SENTIMENT_CONFIG[f].label} (${comments.filter((c) => c.sentiment === f).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Comment list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ChatCircleIcon className="h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Sem comentarios</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((comment) => {
            const sentiment = SENTIMENT_CONFIG[comment.sentiment ?? "neutral"]
            return (
              <Card
                key={comment.id}
                className={cn(
                  "transition-all",
                  comment.sentiment === "negative" && "border-destructive/30"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-[#833AB4] to-[#F77737] text-[10px] font-bold text-white">
                        {comment.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-foreground">
                          @{comment.username}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(comment.timestamp)}</span>
                        <Badge variant="outline" className={cn("text-[9px] font-medium px-1.5 py-0.5", sentiment.badge)}>
                          {sentiment.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        {comment.text}
                      </p>

                      {/* Meta info */}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <HeartIcon className="h-2.5 w-2.5" /> {comment.like_count}
                        </span>
                        {comment.media_caption && (
                          <a
                            href={comment.media_permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-muted-foreground hover:text-foreground truncate max-w-[200px] flex items-center gap-1 transition-colors"
                          >
                            <ArrowSquareOutIcon className="h-2.5 w-2.5" />
                            {comment.media_caption}
                          </a>
                        )}
                        <button
                          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors ml-auto"
                        >
                          {replyingTo === comment.id ? <XIcon className="h-2.5 w-2.5" /> : <PaperPlaneTiltIcon className="h-2.5 w-2.5" />}
                          {replyingTo === comment.id ? "Cancelar" : "Responder"}
                        </button>
                      </div>

                      {/* Reply form */}
                      {replyingTo === comment.id && (
                        <CommentReplyForm commentId={comment.id} onDone={() => setReplyingTo(null)} />
                      )}

                      {/* Existing replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-3 ml-4 pl-3 border-l-2 border-border space-y-2">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="text-xs">
                              <span className="font-semibold text-foreground">@{reply.username}</span>
                              <span className="text-muted-foreground ml-2">{timeAgo(reply.timestamp)}</span>
                              <p className="text-muted-foreground mt-0.5">{reply.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Publish form ────────────────────────────────────────────────────────────

function PublishForm({ onDone, defaultDate }: { onDone: () => void; defaultDate?: string }) {
  const [caption, setCaption] = useState("")
  const [mediaType, setMediaType] = useState<"IMAGE" | "REELS">("IMAGE")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [mode, setMode] = useState<"now" | "schedule">(defaultDate ? "schedule" : "now")
  const [scheduledAt, setScheduledAt] = useState(defaultDate ?? "")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (f) {
      const url = URL.createObjectURL(f)
      setPreview(url)
      // Auto-detect type from file
      if (f.type.startsWith("video/")) setMediaType("REELS")
      else setMediaType("IMAGE")
    } else {
      setPreview(null)
    }
  }

  function handleSubmit() {
    if (!caption.trim() || !file) return
    if (mode === "schedule" && !scheduledAt) return
    setError(null)
    setSuccess(false)

    const formData = new FormData()
    formData.set("caption", caption.trim())
    formData.set("mediaType", mediaType)
    formData.set("file", file)

    startTransition(async () => {
      if (mode === "schedule") {
        formData.set("scheduledAt", new Date(scheduledAt).toISOString())
        const result = await createScheduledPost(formData)
        if (result.success) {
          setSuccess(true)
          setTimeout(() => onDone(), 1200)
        } else {
          setError(result.error)
        }
      } else {
        const result = await publishIGMediaWithUpload(formData)
        if (result.success) {
          setSuccess(true)
          setTimeout(() => onDone(), 1200)
        } else {
          setError(result.error)
        }
      }
    })
  }

  const MEDIA_TYPES: { key: "IMAGE" | "REELS"; label: string; icon: React.ElementType }[] = [
    { key: "IMAGE", label: "Imagem", icon: ImageSquareIcon },
    { key: "REELS", label: "Reel", icon: VideoCameraIcon },
  ]

  const hasMedia = !!file

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDone()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onDone])

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDone() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusIcon className="h-3.5 w-3.5 text-muted-foreground" />
            Nova publicacao
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Media type selector */}
          <div className="flex items-center gap-1 rounded-lg border p-0.5 bg-muted/50 w-fit">
            {MEDIA_TYPES.map((t) => {
              const TypeIcon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => setMediaType(t.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150",
                    mediaType === t.key
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <TypeIcon className="h-3 w-3" />
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* File upload */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              {mediaType === "IMAGE" ? "Imagem" : "Video"}
            </label>
            <label
              className={cn(
                "flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all",
                file
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              {preview && mediaType === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview" className="max-h-40 rounded-lg object-contain" />
              ) : preview && mediaType === "REELS" ? (
                <video src={preview} className="max-h-40 rounded-lg" controls />
              ) : (
                <>
                  <UploadSimpleIcon className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Clica ou arrasta {mediaType === "IMAGE" ? "uma imagem" : "um video"}
                  </span>
                </>
              )}
              <input
                type="file"
                accept={mediaType === "IMAGE" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/quicktime"}
                onChange={handleFileChange}
                className="hidden"
                disabled={isPending}
              />
              {file && (
                <span className="text-[10px] text-muted-foreground">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              )}
            </label>
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Legenda
            </label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escreve a legenda do post..."
              rows={4}
              className="resize-none"
              disabled={isPending}
            />
            <p className="text-[10px] text-muted-foreground mt-1">{caption.length}/2200 caracteres</p>
          </div>

          {/* Publish mode: now or schedule */}
          <div className="flex items-center gap-1 rounded-lg border p-0.5 bg-muted/50 w-fit">
            <button
              onClick={() => setMode("now")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150",
                mode === "now"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <PaperPlaneTiltIcon className="h-3 w-3" />
              Publicar agora
            </button>
            <button
              onClick={() => setMode("schedule")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150",
                mode === "schedule"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ClockIcon className="h-3 w-3" />
              Agendar
            </button>
          </div>

          {/* Schedule date/time */}
          {mode === "schedule" && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Data e hora de publicacao
              </label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                disabled={isPending}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSubmit}
              disabled={isPending || !caption.trim() || !hasMedia || (mode === "schedule" && !scheduledAt)}
              className="bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white hover:opacity-90"
            >
              {isPending ? (
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin mr-2" />
              ) : mode === "schedule" ? (
                <ClockIcon className="h-3.5 w-3.5 mr-2" />
              ) : (
                <PaperPlaneTiltIcon className="h-3.5 w-3.5 mr-2" />
              )}
              {isPending
                ? (mode === "schedule" ? "A agendar..." : "A publicar...")
                : (mode === "schedule" ? "Agendar publicacao" : "Publicar agora")}
            </Button>
            {success && (
              <span className="text-xs text-emerald-500 flex items-center gap-1">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                {mode === "schedule" ? "Agendado!" : "Publicado!"}
              </span>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-xs text-destructive">
              <WarningCircleIcon className="h-3.5 w-3.5" /> {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Calendar tab ────────────────────────────────────────────────────────────

function ScheduledPostCard({ post, onAction }: { post: ScheduledPostRow; onAction: () => void }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteScheduledPost(post.id)
      onAction()
    })
  }

  function handlePublishNow() {
    startTransition(async () => {
      await publishScheduledPost(post.id)
      onAction()
    })
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <ClockIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium truncate">
          {post.media_type === "REELS" ? "Reel" : "Post"} --- {new Date(post.scheduled_for ?? "").toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="text-[9px] text-muted-foreground truncate">{(post.caption ?? "").slice(0, 50)}</p>
      </div>
      {post.status === "scheduled" && !isPending && (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10" onClick={handlePublishNow} title="Publicar agora">
            <PaperPlaneTiltIcon className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete} title="Eliminar">
            <TrashSimpleIcon className="h-3 w-3" />
          </Button>
        </div>
      )}
      {post.status === "failed" && (
        <span className="text-[9px] text-destructive font-medium shrink-0">Falhou</span>
      )}
      {isPending && <SpinnerIcon className="h-3 w-3 animate-spin text-amber-500 shrink-0" />}
    </div>
  )
}

function CalendarTab({ media, scheduledPosts }: { media: IGMedia[]; scheduledPosts: ScheduledPostRow[] }) {
  const [publishDate, setPublishDate] = useState<string | null>(null)
  const [showPublish, setShowPublish] = useState(false)
  const [, startRefresh] = useTransition()
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1 // Monday start

  // Group media by day
  const mediaByDay = new Map<number, IGMedia[]>()
  for (const m of media) {
    const d = new Date(m.timestamp)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!mediaByDay.has(day)) mediaByDay.set(day, [])
      mediaByDay.get(day)!.push(m)
    }
  }

  // Group scheduled posts by day
  const scheduledByDay = new Map<number, ScheduledPostRow[]>()
  const pendingScheduled = scheduledPosts.filter((p) => p.status === "scheduled" || p.status === "failed")
  for (const p of pendingScheduled) {
    const d = new Date(p.scheduled_for ?? "")
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!scheduledByDay.has(day)) scheduledByDay.set(day, [])
      scheduledByDay.get(day)!.push(p)
    }
  }

  const monthLabel = new Date(year, month).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })

  function prevMonth() { setCurrentMonth(new Date(year, month - 1, 1)) }
  function nextMonth() { setCurrentMonth(new Date(year, month + 1, 1)) }

  function handleDayClick(day: number) {
    const clickedDate = new Date(year, month, day)
    const now = new Date()
    // Only allow scheduling on today or future dates
    if (clickedDate.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
      // Default to 10:00 on the selected day
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T10:00`
      setPublishDate(dateStr)
      setShowPublish(true)
    }
  }

  function handleRefresh() {
    startRefresh(() => {
      // Trigger re-render --- in a real app this would revalidate
      window.location.reload()
    })
  }

  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

  return (
    <div className="space-y-6">
      {/* Publish modal */}
      {showPublish && (
        <PublishForm
          onDone={() => { setShowPublish(false); setPublishDate(null) }}
          defaultDate={publishDate ?? undefined}
        />
      )}

      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={prevMonth}
        >
          <CaretRightIcon className="h-3.5 w-3.5 rotate-180" />
        </Button>
        <h3 className="text-sm font-semibold text-foreground capitalize">{monthLabel}</h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => { setPublishDate(null); setShowPublish(true) }}
            size="sm"
            className="bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white hover:opacity-90"
          >
            <PlusIcon className="h-3 w-3 mr-1.5" />
            Nova publicacao
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={nextMonth}
          >
            <CaretRightIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Upcoming scheduled posts */}
      {pendingScheduled.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <ClockIcon className="h-3.25 w-3.25 text-amber-500" />
              Publicacoes agendadas ({pendingScheduled.length})
            </h4>
            <div className="space-y-1.5">
              {pendingScheduled.slice(0, 5).map((p) => (
                <ScheduledPostCard key={p.id} post={p} onAction={handleRefresh} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar grid */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto min-w-0">
          <div className="min-w-[500px]">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b">
              {weekDays.map((d) => (
                <div key={d} className="p-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7">
              {/* Empty cells before first day */}
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square border-b border-r bg-muted/30" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dayMedia = mediaByDay.get(day) ?? []
                const dayScheduled = scheduledByDay.get(day) ?? []
                const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
                const isFuture = new Date(year, month, day).getTime() >= new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()

                return (
                  <div
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "min-h-[80px] border-b border-r p-1.5 transition-colors",
                      isToday && "bg-primary/5",
                      isFuture && "cursor-pointer hover:bg-muted/50",
                      !isFuture && dayMedia.length > 0 && "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[10px] font-medium",
                        isToday
                          ? "bg-gradient-to-br from-[#833AB4] to-[#F77737] text-white rounded-full h-5 w-5 flex items-center justify-center"
                          : "text-muted-foreground"
                      )}>
                        {day}
                      </span>
                      {isFuture && !isToday && (
                        <PlusIcon className="h-2.5 w-2.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100" />
                      )}
                    </div>
                    {(dayMedia.length > 0 || dayScheduled.length > 0) && (
                      <div className="mt-1 space-y-0.5">
                        {dayMedia.slice(0, 2).map((m) => (
                          <a
                            key={m.id}
                            href={m.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "block truncate text-[9px] px-1 py-0.5 rounded font-medium",
                              m.media_type === "REELS"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                : m.media_type === "VIDEO"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                  : "bg-muted text-muted-foreground"
                            )}
                          >
                            {m.media_type === "REELS" ? "Reel" : m.media_type === "VIDEO" ? "Video" : "Post"}
                            {" "}{fmtTime(m.timestamp)}
                          </a>
                        ))}
                        {dayScheduled.map((p) => (
                          <div
                            key={p.id}
                            className={cn(
                              "truncate text-[9px] px-1 py-0.5 rounded font-medium flex items-center gap-0.5",
                              p.status === "failed"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            )}
                          >
                            <ClockIcon className="h-2.0 w-2.0" />
                            {p.media_type === "REELS" ? "Reel" : "Post"}
                            {" "}{new Date(p.scheduled_for ?? "").toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        ))}
                        {dayMedia.length + dayScheduled.length > 3 && (
                          <p className="text-[8px] text-muted-foreground pl-1">+{dayMedia.length + dayScheduled.length - 3} mais</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Monthly stats */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-xs font-semibold text-foreground mb-3">Resumo do mes</h4>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 text-center">
            {[
              { label: "Publicacoes", value: Array.from(mediaByDay.values()).flat().length },
              { label: "Agendadas", value: pendingScheduled.filter((p) => { const d = new Date(p.scheduled_for ?? ""); return d.getMonth() === month && d.getFullYear() === year }).length },
              { label: "Dias ativos", value: mediaByDay.size },
              { label: "Posts", value: Array.from(mediaByDay.values()).flat().filter((m) => m.media_type === "IMAGE" || m.media_type === "CAROUSEL_ALBUM").length },
              { label: "Reels", value: Array.from(mediaByDay.values()).flat().filter((m) => m.media_type === "REELS").length },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Demographics Tab ─────────────────────────────────────────────────────────

function DemographicsTab() {
  const [demographics, setDemographics] = useState<IGDemographics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    const result = await getIGDemographics()
    setDemographics(result.demographics)
    setError(result.error)
    setLoading(false)
    setLoaded(true)
  }

  if (!loaded && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <UsersIcon className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Dados demograficos da audiencia</p>
        <Button onClick={load}>
          Carregar dados
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <SpinnerIcon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !demographics) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <WarningCircleIcon className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error ?? "Sem dados"}</p>
        <Button variant="link" onClick={load} className="text-xs text-muted-foreground">Tentar novamente</Button>
      </div>
    )
  }

  const topCities = demographics.cities.slice(0, 10)
  const topCountries = demographics.countries.slice(0, 10)
  const maxCityVal = topCities[0]?.value ?? 1
  const maxCountryVal = topCountries[0]?.value ?? 1

  // Parse gender/age into male/female groups
  const maleData = demographics.genderAge.filter((d) => d.label.startsWith("M.")).map((d) => ({ age: d.label.replace("M.", ""), value: d.value }))
  const femaleData = demographics.genderAge.filter((d) => d.label.startsWith("F.")).map((d) => ({ age: d.label.replace("F.", ""), value: d.value }))
  const totalGender = demographics.genderAge.reduce((s, d) => s + d.value, 0) || 1
  const totalMale = maleData.reduce((s, d) => s + d.value, 0)
  const totalFemale = femaleData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Gender Split */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <GenderIntersexIcon className="h-4 w-4 text-muted-foreground" />
            Genero
          </h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold text-blue-500">{((totalMale / totalGender) * 100).toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Masculino</p>
            </div>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden flex">
              <div className="bg-blue-500 h-full transition-all" style={{ width: `${(totalMale / totalGender) * 100}%` }} />
              <div className="bg-pink-500 h-full transition-all" style={{ width: `${(totalFemale / totalGender) * 100}%` }} />
            </div>
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold text-pink-500">{((totalFemale / totalGender) * 100).toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Feminino</p>
            </div>
          </div>

          {/* Age breakdown */}
          <div className="space-y-2 mt-4">
            {maleData.map((d) => {
              const f = femaleData.find((fd) => fd.age === d.age)
              const total = d.value + (f?.value ?? 0)
              return (
                <div key={d.age} className="flex items-center gap-2 text-xs">
                  <span className="w-12 text-right text-muted-foreground">{d.age}</span>
                  <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden flex">
                    <div className="bg-blue-400/60 h-full" style={{ width: `${(d.value / totalGender) * 100 * 3}%` }} />
                    <div className="bg-pink-400/60 h-full" style={{ width: `${((f?.value ?? 0) / totalGender) * 100 * 3}%` }} />
                  </div>
                  <span className="w-10 text-muted-foreground">{((total / totalGender) * 100).toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Cities */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <MapPinIcon className="h-4 w-4 text-muted-foreground" />
            Top Cidades
          </h3>
          <div className="space-y-2">
            {topCities.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                <span className="text-xs text-foreground flex-1 truncate">{c.name}</span>
                <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="bg-primary/60 h-full rounded-full transition-all" style={{ width: `${(c.value / maxCityVal) * 100}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-8 text-right">{fmt(c.value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Countries */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <FlagIcon className="h-4 w-4 text-muted-foreground" />
            Top Paises
          </h3>
          <div className="space-y-2">
            {topCountries.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                <span className="text-xs text-foreground flex-1 truncate">{c.name}</span>
                <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="bg-primary/60 h-full rounded-full transition-all" style={{ width: `${(c.value / maxCountryVal) * 100}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-8 text-right">{fmt(c.value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Locales */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <GlobeIcon className="h-4 w-4 text-muted-foreground" />
            Idiomas
          </h3>
          <div className="space-y-2">
            {demographics.locales.slice(0, 10).map((l, i) => (
              <div key={l.name} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                <span className="text-xs text-foreground flex-1">{l.name}</span>
                <span className="text-[10px] text-muted-foreground">{fmt(l.value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Competitors Tab ──────────────────────────────────────────────────────────

function CompetitorsTab({ ownProfiles, initialSavedCompetitors }: { ownProfiles: IGProfile[]; initialSavedCompetitors: SavedCompetitor[] }) {
  const [subTab, setSubTab] = useState<"tracker" | "ads">("tracker")
  const [isPending, startTransition] = useTransition()

  // ─── Tracker state ─────────────────────────────────────────────────
  const [saved, setSaved] = useState(initialSavedCompetitors)
  const [addUsername, setAddUsername] = useState("")
  const [addNotes, setAddNotes] = useState("")
  const [viewProfile, setViewProfile] = useState<CompetitorProfile | null>(null)

  // ─── Ad Library state ──────────────────────────────────────────────
  const [adSearch, setAdSearch] = useState("")
  const [adPageId, setAdPageId] = useState("")
  const [adCountry, setAdCountry] = useState("PT")
  const [ads, setAds] = useState<AdLibraryAd[]>([])
  const [adsError, setAdsError] = useState<string | null>(null)
  const [adsLoading, setAdsLoading] = useState(false)

  const ownProfile = ownProfiles[0]

  // ─── Handlers ──────────────────────────────────────────────────────

  function handleAdd() {
    if (!addUsername.trim()) return
    startTransition(async () => {
      const { competitor, error } = await addSavedCompetitor(addUsername, addNotes || undefined)
      if (error) {
        toast.error(error)
      } else if (competitor) {
        setSaved((prev) => [...prev, competitor])
        setAddUsername("")
        setAddNotes("")
        toast.success(`@${competitor.username} adicionado!`)
      }
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const { error } = await removeCompetitor(id)
      if (error) toast.error(error)
      else {
        setSaved((prev) => prev.filter((c) => c.id !== id))
        toast.success("Concorrente removido")
      }
    })
  }

  function handleRefresh(id: string, username: string) {
    startTransition(async () => {
      const { snapshot, error } = await refreshCompetitorSnapshot(id, username)
      if (error) toast.error(error)
      else if (snapshot) {
        setSaved((prev) => prev.map((c) => c.id === id ? { ...c, latestSnapshot: snapshot } : c))
        toast.success("Dados atualizados!")
      }
    })
  }

  function handleViewProfile(username: string) {
    startTransition(async () => {
      const { profile, error } = await fetchCompetitorProfile(username)
      if (error) toast.error(error)
      else if (profile) setViewProfile(profile)
    })
  }

  function handleSearchAds(terms?: string) {
    const search = terms ?? adSearch
    if (!search.trim() && !adPageId.trim()) return
    setAdsLoading(true)
    setAdsError(null)
    if (terms) setAdSearch(terms)
    startTransition(async () => {
      const { ads: results, error } = await searchAdLibrary({
        search_terms: search || undefined,
        search_page_ids: adPageId || undefined,
        ad_reached_countries: adCountry,
      })
      setAds(results)
      setAdsError(error)
      setAdsLoading(false)
    })
  }

  function handleSearchAdsForCompetitor(name: string) {
    setAdSearch(name)
    setSubTab("ads")
    handleSearchAds(name)
  }

  // ─── Sub-tabs ──────────────────────────────────────────────────────

  const subTabs = [
    { key: "tracker" as const, label: "Tracker", icon: InstagramLogoIcon },
    { key: "ads" as const, label: "Biblioteca de Anuncios", icon: MetaLogoIcon },
  ]

  return (
    <div className="space-y-5">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all",
              subTab === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Tracker Sub-tab ──────────────────────────────────────── */}
      {subTab === "tracker" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Add competitor */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <InstagramLogoIcon className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="@username do concorrente"
                className="pl-9"
              />
            </div>
            <Input
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              placeholder="Notas (opcional)"
              className="sm:w-44"
            />
            <Button
              onClick={handleAdd}
              disabled={isPending || !addUsername.trim()}
            >
              {isPending ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin mr-2" /> : <PlusIcon className="h-3.5 w-3.5 mr-2" />}
              Adicionar
            </Button>
          </div>

          {/* Comparison table */}
          {saved.length > 0 && (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead className="text-right">Seguidores</TableHead>
                      <TableHead className="text-right">Med. Likes</TableHead>
                      <TableHead className="text-right">Engagement</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ownProfile && (
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-semibold">@{ownProfile.username} (tu)</TableCell>
                        <TableCell className="text-right">{fmt(ownProfile.followers_count)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">---</TableCell>
                        <TableCell className="text-right text-muted-foreground">---</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                    {saved.map((c) => {
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {c.profile_pic_url && (
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={c.profile_pic_url} alt="" />
                                  <AvatarFallback>{c.username[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                              )}
                              <span className="font-medium">@{c.username}</span>
                            </div>
                          </TableCell>
                          <TableCell className={cn("text-right font-medium", ownProfile && c.followers_count > ownProfile.followers_count ? "text-red-500" : "text-emerald-500")}>
                            {fmt(c.followers_count)}
                          </TableCell>
                          <TableCell className="text-right">{fmt(c.media_count)}</TableCell>
                          <TableCell className="text-right font-medium">---</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-500" onClick={() => handleSearchAdsForCompetitor(c.display_name ?? c.username)} title="Ver anuncios">
                                <MetaLogoIcon className="h-3.25 w-3.25" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleViewProfile(c.username)} title="Ver perfil">
                                <EyeIcon className="h-3.25 w-3.25" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-500" onClick={() => handleRefresh(c.id, c.username)} title="Atualizar">
                                <ArrowsClockwiseIcon className="h-3.25 w-3.25" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(c.id)} title="Remover">
                                <TrashIcon className="h-3.25 w-3.25" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {saved.length === 0 && !isPending && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <BinocularsIcon className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Adiciona concorrentes para monitorizar ao longo do tempo</p>
              <p className="text-xs text-muted-foreground">Nota: apenas funciona com contas Business ou Creator</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Ad Library Sub-tab ───────────────────────────────────── */}
      {subTab === "ads" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={adSearch}
                onChange={(e) => setAdSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchAds()}
                placeholder="Palavra-chave (ex: software, marketing)"
                className="pl-9"
              />
            </div>
            <Input
              value={adPageId}
              onChange={(e) => setAdPageId(e.target.value)}
              placeholder="Page ID (opcional)"
              className="sm:w-36"
            />
            <Select value={adCountry} onValueChange={setAdCountry}>
              <SelectTrigger className="sm:w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PT">Portugal</SelectItem>
                <SelectItem value="BR">Brasil</SelectItem>
                <SelectItem value="ES">Espanha</SelectItem>
                <SelectItem value="US">EUA</SelectItem>
                <SelectItem value="GB">UK</SelectItem>
                <SelectItem value="FR">Franca</SelectItem>
                <SelectItem value="DE">Alemanha</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => handleSearchAds()}
              disabled={adsLoading || (!adSearch.trim() && !adPageId.trim())}
            >
              {adsLoading ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin mr-2" /> : <MagnifyingGlassIcon className="h-3.5 w-3.5 mr-2" />}
              Pesquisar
            </Button>
          </div>

          {adsError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">
              <WarningCircleIcon className="h-3.5 w-3.5" />
              {adsError}
            </div>
          )}

          {ads.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                {ads.length} anuncio{ads.length > 1 ? "s" : ""} encontrado{ads.length > 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ads.map((ad) => (
                  <Card key={ad.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{ad.page_name}</p>
                          {ad.ad_delivery_start_time && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                              <CalendarIcon className="h-2.5 w-2.5" /> Desde {new Date(ad.ad_delivery_start_time!).toLocaleDateString("pt-PT")}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {ad.publisher_platforms.map((p) => (
                            <Badge key={p} variant="secondary" className="text-[9px] px-1.5 py-0.5">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {ad.ad_creative_link_title && (
                        <p className="text-xs font-medium text-foreground mb-1">{ad.ad_creative_link_title}</p>
                      )}
                      {ad.ad_creative_body && (
                        <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">{ad.ad_creative_body}</p>
                      )}
                      <Separator className="my-3" />
                      <div className="flex items-center justify-between">
                        {ad.publisher_platforms.length > 0 && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><GlobeIcon className="h-2.5 w-2.5" />{ad.publisher_platforms.join(", ")}</span>
                        )}
                        <a href={ad.ad_snapshot_url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:text-blue-600 flex items-center gap-0.5 font-medium transition-colors">
                          Ver anuncio <ArrowSquareOutIcon className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : !adsLoading && !adsError && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FunnelSimpleIcon className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Pesquisa anuncios da concorrencia no Meta</p>
              <p className="text-xs text-muted-foreground">Procura por palavra-chave ou Page ID</p>
            </div>
          )}
        </div>
      )}

      {/* Profile detail modal */}
      <Dialog open={!!viewProfile} onOpenChange={(open) => { if (!open) setViewProfile(null) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewProfile && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={viewProfile.profile_pic_url ?? undefined} alt={viewProfile.name ?? ""} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500">
                      <InstagramLogoIcon className="h-4.5 w-4.5 text-white" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle>{viewProfile.name}</DialogTitle>
                    <DialogDescription>@{viewProfile.username}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-5">
                {viewProfile.biography && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{viewProfile.biography}</p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{fmt(viewProfile.followers_count)}</p>
                      <p className="text-[10px] text-muted-foreground">Seguidores</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{fmt(viewProfile.media_count)}</p>
                      <p className="text-[10px] text-muted-foreground">Posts</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{fmt(Math.round((viewProfile.recent_media ?? []).reduce((s, m) => s + (m.like_count ?? 0), 0) / Math.max((viewProfile.recent_media ?? []).length, 1)))}</p>
                      <p className="text-[10px] text-muted-foreground">Likes/post</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{fmt(viewProfile.follows_count)}</p>
                      <p className="text-[10px] text-muted-foreground">A seguir</p>
                    </CardContent>
                  </Card>
                </div>
                {(viewProfile.recent_media ?? []).length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Posts Recentes</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {(viewProfile.recent_media ?? []).map((m) => (
                        <a key={m.id} href={`https://instagram.com/p/${m.id}`} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-xl overflow-hidden bg-muted">
                          {(m.media_url || m.thumbnail_url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={(m.thumbnail_url ?? m.media_url)!} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground" /></div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="flex items-center gap-3 text-white text-xs font-medium">
                              <span className="flex items-center gap-1"><HeartIcon className="h-3 w-3" />{fmt(m.like_count)}</span>
                              <span className="flex items-center gap-1"><ChatCircleIcon className="h-3 w-3" />{fmt(m.comments_count)}</span>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Loading indicator */}
      {isPending && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg animate-in slide-in-from-bottom-2 duration-200">
          <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
          A processar...
        </div>
      )}
    </div>
  )
}

// ─── Main client ─────────────────────────────────────────────────────────────

interface InstagramClientProps {
  profiles: IGProfile[]
  media: IGMedia[]
  comments: IGComment[]
  scheduledPosts: ScheduledPostRow[]
  apiError: string | null
  savedCompetitors: SavedCompetitor[]
}

export function InstagramClient({ profiles, media, comments, scheduledPosts, apiError, savedCompetitors }: InstagramClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("posts")
  const accountNames = [...new Set(media.map((m) => m.account_name))].sort()
  const [selectedAccount, setSelectedAccount] = useState<string>("all")

  const filteredMedia = selectedAccount === "all" ? media : media.filter((m) => m.account_name === selectedAccount)
  const filteredComments = selectedAccount === "all" ? comments : comments.filter((c) => c.account_name === selectedAccount)

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Instagram</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Analytics, conteudo e comentarios
          </p>
        </div>
      </div>

      {/* API Error */}
      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <WarningCircleIcon className="h-4 w-4" />
          {apiError}
        </div>
      )}

      {/* Profile folder tabs + content area */}
      {profiles.length > 0 && (
        <div>
          {/* Folder tabs row */}
          <div className="flex items-stretch gap-1 overflow-x-auto">
            {profiles.length > 1 && (
              <button
                onClick={() => setSelectedAccount("all")}
                className={cn(
                  "flex items-center gap-3 px-5 rounded-t-2xl text-left transition-all duration-200",
                  selectedAccount === "all"
                    ? "bg-card border border-border border-b-transparent z-10 -mb-px"
                    : "bg-muted/60 border border-transparent hover:bg-muted opacity-70 hover:opacity-100"
                )}
              >
                <div className={cn("shrink-0 h-10 w-10 rounded-full flex items-center justify-center", selectedAccount === "all" ? "bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737]" : "bg-muted-foreground/30")}>
                  <UsersIcon className="h-4.5 w-4.5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold", selectedAccount === "all" ? "text-foreground" : "text-muted-foreground")}>
                    Todas as contas
                  </p>
                  <p className="text-[10px] text-muted-foreground">{profiles.length} contas</p>
                </div>
              </button>
            )}
            {profiles.map((profile) => (
              <ProfileFolderTab
                key={profile.id}
                profile={profile}
                isActive={selectedAccount === profile.account_name || (profiles.length === 1 && selectedAccount === "all")}
                onClick={() => setSelectedAccount(selectedAccount === profile.account_name ? "all" : profile.account_name)}
              />
            ))}
          </div>

          {/* Connected content panel */}
          <Card className="rounded-t-none rounded-b-2xl rounded-tr-2xl">
            <CardContent className="p-5">
              {/* Profile info (bio + website) when a single profile is selected */}
              {(() => {
                const activeProfile = profiles.find((p) => p.account_name === selectedAccount) ?? (profiles.length === 1 ? profiles[0] : null)
                if (!activeProfile || (!activeProfile.biography && !activeProfile.website)) return null
                return (
                  <div className="mb-5 flex items-start gap-3 rounded-xl bg-muted/50 border p-4">
                    {activeProfile.profile_picture_url && (
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={activeProfile.profile_picture_url} alt={activeProfile.username} />
                        <AvatarFallback>{activeProfile.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">@{activeProfile.username}</p>
                      {activeProfile.biography && (
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{activeProfile.biography}</p>
                      )}
                      {activeProfile.website && (
                        <a href={activeProfile.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                          {activeProfile.website}
                        </a>
                      )}
                    </div>
                  </div>
                )
              })()}
              {/* Section tabs */}
              <div className="overflow-x-auto -mx-5 px-5 mb-5">
                <div className="flex items-center gap-1 rounded-lg border p-0.5 bg-muted/50 w-fit">
                  {TABS.map((tab) => {
                    const TabIcon = tab.icon
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all duration-150 whitespace-nowrap",
                          activeTab === tab.key
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <TabIcon className="h-3.25 w-3.25" weight={activeTab === tab.key ? "fill" : "regular"} />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.key === "comentarios" && filteredComments.filter((c) => c.sentiment === "negative").length > 0 && (
                          <Badge variant="destructive" className="ml-0.5 text-[9px] px-1.5 py-0.5 h-auto">
                            {filteredComments.filter((c) => c.sentiment === "negative").length}
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tab content */}
              <div className="animate-in fade-in duration-150">
                {activeTab === "posts" && <PostsTab media={filteredMedia} />}
                {activeTab === "reels" && <ReelsTab media={filteredMedia} />}
                {activeTab === "comentarios" && <CommentsTab comments={filteredComments} />}
                {activeTab === "calendario" && <CalendarTab media={filteredMedia} scheduledPosts={scheduledPosts} />}
                {activeTab === "demograficos" && <DemographicsTab />}
                {activeTab === "concorrentes" && <CompetitorsTab ownProfiles={profiles} initialSavedCompetitors={savedCompetitors} />}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
