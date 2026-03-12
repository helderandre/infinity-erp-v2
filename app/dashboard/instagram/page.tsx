import { getIGProfiles, getIGMedia, getIGComments, getScheduledPosts } from "./actions"
import { getSavedCompetitors } from "@/app/dashboard/competitors/actions"
import { InstagramClient } from "./instagram-client"

export const metadata = { title: "Instagram — ERP Infinity" }

export default async function InstagramPage() {
  const [profiles, { media, error: mediaError }, { comments, error: commentsError }, { posts: scheduledPosts }, savedCompetitors] =
    await Promise.all([getIGProfiles(), getIGMedia(), getIGComments(), getScheduledPosts(), getSavedCompetitors()])

  return (
    <InstagramClient
      profiles={profiles}
      media={media}
      comments={comments}
      scheduledPosts={scheduledPosts}
      apiError={mediaError ?? commentsError ?? null}
      savedCompetitors={savedCompetitors}
    />
  )
}
