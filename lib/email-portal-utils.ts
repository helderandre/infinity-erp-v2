/**
 * Utility to populate EmailPortalLinks nodes in a Craft.js editor state
 * with actual portal URL data from a property.
 *
 * This is used at runtime (process tasks, email compose) to inject
 * the real portal links into the template before rendering.
 */

interface PortalItem {
  portal: string
  name: string
  url: string
}

/**
 * Walk through a serialized Craft.js editor state and populate
 * all EmailPortalLinks nodes with the given portal links.
 *
 * If portalLinks is empty, the nodes are left untouched (they'll
 * render the placeholder in the canvas, or nothing in the HTML renderer).
 */
export function populatePortalLinksInState(
  editorStateStr: string,
  portalLinks: PortalItem[]
): string {
  if (!portalLinks || portalLinks.length === 0) return editorStateStr

  try {
    const state = JSON.parse(editorStateStr)
    let changed = false

    for (const node of Object.values(state)) {
      const n = node as { type?: { resolvedName?: string }; props?: Record<string, unknown> }
      if (n.type?.resolvedName === 'EmailPortalLinks') {
        n.props = n.props || {}
        n.props.portals = portalLinks
        changed = true
      }
    }

    return changed ? JSON.stringify(state) : editorStateStr
  } catch {
    return editorStateStr
  }
}

/**
 * Fetch portal links for a given property from the preview-data API.
 * Returns the portal_links array and optionally the resolved variables.
 */
export async function fetchPortalLinks(
  propertyId: string,
  opts?: { ownerId?: string; consultantId?: string; processId?: string }
): Promise<{ portalLinks: PortalItem[]; variables: Record<string, string> }> {
  try {
    const res = await fetch('/api/libraries/emails/preview-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: propertyId,
        owner_id: opts?.ownerId,
        consultant_id: opts?.consultantId,
        process_id: opts?.processId,
      }),
    })

    if (!res.ok) return { portalLinks: [], variables: {} }

    const data = await res.json()
    return {
      portalLinks: (data.portal_links as PortalItem[]) || [],
      variables: (data.variables as Record<string, string>) || {},
    }
  } catch {
    return { portalLinks: [], variables: {} }
  }
}
