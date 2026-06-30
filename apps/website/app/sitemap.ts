import type { MetadataRoute } from "next";
import { createAnonServerClient } from "@/lib/supabase-server";

const SITE = "https://infinitygroup.pt";
const VISIBLE_STATUSES = new Set(["active", "reserved", "sold", "rented"]);

// Edge/CDN cache for an hour (mirrors the worker's s-maxage=3600).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, priority: 1.0 },
    { url: `${SITE}/about`, priority: 0.6 },
    { url: `${SITE}/services`, priority: 0.6 },
    { url: `${SITE}/property`, priority: 0.6 },
    { url: `${SITE}/agents`, priority: 0.6 },
    { url: `${SITE}/contact`, priority: 0.6 },
    { url: `${SITE}/terms`, priority: 0.6 },
    { url: `${SITE}/legal`, priority: 0.6 },
    { url: `${SITE}/privacy`, priority: 0.6 },
    { url: `${SITE}/cookies`, priority: 0.6 },
  ];

  try {
    const supabase = createAnonServerClient();
    const { data } = await supabase
      .from("dev_properties")
      .select("slug, status, show_on_website, updated_at")
      .eq("show_on_website", true)
      .order("updated_at", { ascending: false })
      .limit(5000);

    const properties: MetadataRoute.Sitemap = (data ?? [])
      .filter(
        (p) =>
          (p as { slug?: string }).slug &&
          VISIBLE_STATUSES.has(String((p as { status?: string }).status ?? "").toLowerCase()),
      )
      .map((p) => {
        const row = p as { slug: string; updated_at?: string };
        return {
          url: `${SITE}/property/${encodeURIComponent(row.slug)}`,
          lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
          priority: 0.8,
        };
      });

    return [...staticRoutes, ...properties];
  } catch {
    return staticRoutes;
  }
}
