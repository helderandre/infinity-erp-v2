'use client'

import { Fragment, useMemo } from 'react'

// WhatsApp uses a subset of markdown:
// *bold* → <strong>
// _italic_ → <em>
// ~strikethrough~ → <del>
// ```monospace``` or `code` → <code>
// URLs → <a>
// @<lid> → mention

const URL_REGEX = /(https?:\/\/[^\s<]+)/g
const MENTION_REGEX = /@(\d{5,20})/g

// Replace @<lid_number> with display names
function resolveMentions(
  text: string,
  mentionMap?: Record<string, string>
): string {
  if (!mentionMap || Object.keys(mentionMap).length === 0) return text
  return text.replace(MENTION_REGEX, (match, lid) => {
    // Try direct lid match, then try with @lid suffix
    const name = mentionMap[lid] || mentionMap[`${lid}@lid`]
    return name ? `@${name}` : match
  })
}

// Parse WhatsApp formatting tokens into React nodes
function parseWhatsAppFormatting(
  text: string,
  mentionMap?: Record<string, string>,
  hasMentions = false
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let remaining = text
  let key = 0

  const lm = (t: string, k: number) => linkifyAndMention(t, k, hasMentions)

  // Process formatting patterns: *bold*, _italic_, ~strike~, `code`, ```code```
  const patterns: { regex: RegExp; render: (content: string, k: number) => React.ReactNode }[] = [
    {
      regex: /```([\s\S]+?)```/,
      render: (c, k) => (
        <code key={k} className="block bg-muted/60 rounded px-2 py-1 my-1 text-xs font-mono whitespace-pre-wrap">
          {c}
        </code>
      ),
    },
    {
      regex: /`([^`]+)`/,
      render: (c, k) => (
        <code key={k} className="bg-muted/60 rounded px-1 py-0.5 text-xs font-mono">
          {c}
        </code>
      ),
    },
    {
      regex: /\*([^\s*](?:[^*]*[^\s*])?)\*/,
      render: (c, k) => <strong key={k}>{lm(c, k)}</strong>,
    },
    {
      regex: /_([^\s_](?:[^_]*[^\s_])?)_/,
      render: (c, k) => <em key={k}>{lm(c, k)}</em>,
    },
    {
      regex: /~([^\s~](?:[^~]*[^\s~])?)~/,
      render: (c, k) => <del key={k}>{lm(c, k)}</del>,
    },
  ]

  while (remaining.length > 0) {
    let earliest: { index: number; length: number; node: React.ReactNode } | null = null

    for (const { regex, render } of patterns) {
      const match = regex.exec(remaining)
      if (match && (!earliest || match.index < earliest.index)) {
        earliest = {
          index: match.index,
          length: match[0].length,
          node: render(match[1], key++),
        }
      }
    }

    if (!earliest) {
      nodes.push(...lm(remaining, key++))
      break
    }

    if (earliest.index > 0) {
      const before = remaining.slice(0, earliest.index)
      nodes.push(...lm(before, key++))
    }

    nodes.push(earliest.node)
    remaining = remaining.slice(earliest.index + earliest.length)
  }

  return nodes
}

// Convert URLs and resolved @mentions in plain text to styled nodes
const MENTION_DISPLAY_REGEX = /(@[\wÀ-ÿ][\wÀ-ÿ\s-]{0,30}[\wÀ-ÿ])/g

function linkifyAndMention(text: string, baseKey: number, hasMentions: boolean): React.ReactNode[] {
  // Split by URLs first
  const urlParts = text.split(URL_REGEX)
  const nodes: React.ReactNode[] = []

  urlParts.forEach((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0
      const displayUrl = part.length > 60 ? part.slice(0, 57) + '...' : part
      nodes.push(
        <a
          key={`${baseKey}-link-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 underline underline-offset-2 break-all hover:text-blue-700 dark:hover:text-blue-300"
        >
          {displayUrl}
        </a>
      )
      return
    }

    // If mentions were resolved, style @Name tokens
    if (hasMentions) {
      const mentionParts = part.split(MENTION_DISPLAY_REGEX)
      mentionParts.forEach((mp, j) => {
        if (MENTION_DISPLAY_REGEX.test(mp)) {
          MENTION_DISPLAY_REGEX.lastIndex = 0
          nodes.push(
            <span
              key={`${baseKey}-mention-${i}-${j}`}
              className="text-blue-600 dark:text-blue-400 font-medium"
            >
              {mp}
            </span>
          )
        } else if (mp) {
          nodes.push(<Fragment key={`${baseKey}-txt-${i}-${j}`}>{mp}</Fragment>)
        }
      })
    } else {
      nodes.push(<Fragment key={`${baseKey}-txt-${i}`}>{part}</Fragment>)
    }
  })

  return nodes
}

interface MessageTextProps {
  text: string
  /** Map of lid (e.g. "98127587582077" or "98127587582077@lid") → display name */
  mentionMap?: Record<string, string>
}

export function MessageText({ text, mentionMap }: MessageTextProps) {
  const nodes = useMemo(() => {
    const resolved = resolveMentions(text, mentionMap)
    const hasMentions = resolved !== text
    return parseWhatsAppFormatting(resolved, mentionMap, hasMentions)
  }, [text, mentionMap])

  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {nodes}
    </p>
  )
}
