// ─── YouTube Utilities (Server-Side) ────────────────────

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

/**
 * Parse ISO 8601 duration string to seconds
 * e.g. "PT1H2M10S" → 3730
 */
export function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Fetch YouTube video duration via Data API v3
 * Returns duration in seconds, or null on failure
 */
export async function getYouTubeDuration(videoUrl: string): Promise<number | null> {
  try {
    const videoId = extractYouTubeId(videoUrl)
    if (!videoId) return null

    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      console.warn('YOUTUBE_API_KEY não configurada — não é possível detectar duração')
      return null
    }

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${apiKey}`
    )
    if (!res.ok) return null

    const data = await res.json()
    if (!data.items || data.items.length === 0) return null

    return parseISO8601Duration(data.items[0].contentDetails.duration)
  } catch (error) {
    console.error('Erro ao obter duração do YouTube:', error)
    return null
  }
}
