export interface ParsedVCard {
  fullName: string
  phones: { number: string; type: string; waid?: string }[]
  email?: string
  organization?: string
  url?: string
}

export function parseVCard(vcard: string): ParsedVCard {
  const lines = vcard.split(/\r?\n/)
  const result: ParsedVCard = { fullName: '', phones: [] }

  for (const line of lines) {
    if (line.startsWith('FN:')) {
      result.fullName = line.slice(3)
    } else if (line.startsWith('TEL')) {
      const typeMatch = line.match(/TYPE=(\w+)/)
      const waidMatch = line.match(/waid=(\d+)/)
      const number = line.split(':').pop() || ''
      result.phones.push({
        number: number.trim(),
        type: typeMatch?.[1] || 'CELL',
        waid: waidMatch?.[1],
      })
    } else if (line.startsWith('EMAIL')) {
      result.email = line.split(':').pop()?.trim()
    } else if (line.startsWith('ORG:')) {
      result.organization = line.slice(4).replace(/;$/, '')
    } else if (line.startsWith('URL:')) {
      result.url = line.slice(4)
    }
  }
  return result
}

export function generateVCard(contact: {
  fullName: string
  phone: string
  organization?: string
  email?: string
  url?: string
}): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contact.fullName}`,
    `TEL;TYPE=CELL:${contact.phone}`,
  ]
  if (contact.organization) lines.push(`ORG:${contact.organization}`)
  if (contact.email) lines.push(`EMAIL;TYPE=INTERNET:${contact.email}`)
  if (contact.url) lines.push(`URL:${contact.url}`)
  lines.push('END:VCARD')
  return lines.join('\n')
}
