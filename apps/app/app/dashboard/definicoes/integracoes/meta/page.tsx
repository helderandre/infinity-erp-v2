import { MetaIntegrationsClient } from "./meta-client"
import { getCustomAudiences } from "./actions"

export const metadata = { title: "Integrações Meta — ERP Infinity" }

export default async function MetaIntegrationsPage() {
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/meta/leads`
  const appId = process.env.META_APP_ID ?? ""
  const hasAppSecret = !!process.env.META_APP_SECRET
  const hasAccessToken = !!process.env.META_ACCESS_TOKEN
  const hasPixelId = !!process.env.META_PIXEL_ID
  const pixelId = process.env.META_PIXEL_ID ?? ""

  const { audiences, error: audiencesError } = await getCustomAudiences()

  return (
    <MetaIntegrationsClient
      webhookUrl={webhookUrl}
      appId={appId}
      hasAppSecret={hasAppSecret}
      hasAccessToken={hasAccessToken}
      hasPixelId={hasPixelId}
      pixelId={pixelId}
      audiences={audiences}
      audiencesError={audiencesError}
    />
  )
}
