import type { Metadata } from "next";
import { PropertyDetailPage } from "@/app/pages/PropertyDetailPage";
import { supabase } from "@/lib/supabase";

const SITE_URL = "https://infinitygroup.pt";
const FALLBACK_IMG =
  "https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/logoinfitiy.png";

// Server-side OG/SEO metadata per property (replaces the Cloudflare worker's
// HTMLRewriter head injection). The page body itself stays client-rendered.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    if (!supabase) return {};
    const { data: property } = await supabase
      .from("dev_properties")
      .select("id, title, description_pt, city, zone, asking_price, listing_price, slug")
      .eq("slug", slug)
      .maybeSingle();

    if (!property) {
      return { title: "Imóvel não encontrado", robots: { index: false } };
    }

    const p = property as Record<string, unknown>;
    let image = FALLBACK_IMG;
    const { data: media } = await supabase
      .from("dev_property_media")
      .select("url, is_cover, order_index")
      .eq("property_id", p.id as string)
      .order("is_cover", { ascending: false })
      .order("order_index", { ascending: true })
      .limit(1);
    const firstMedia = media?.[0] as { url?: string } | undefined;
    if (firstMedia?.url) image = firstMedia.url;

    const price = (p.asking_price ?? p.listing_price) as number | null;
    const loc = [p.zone, p.city].filter(Boolean).join(", ");
    const title = (p.title as string) || "Imóvel";
    const cleanDesc =
      typeof p.description_pt === "string"
        ? p.description_pt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)
        : "";
    const description =
      cleanDesc ||
      [loc, price ? `${Number(price).toLocaleString("pt-PT")} €` : null]
        .filter(Boolean)
        .join(" · ") ||
      "Imóvel Infinity Group";
    const url = `${SITE_URL}/property/${encodeURIComponent(slug)}`;

    return {
      title,
      description,
      alternates: { canonical: `/property/${slug}` },
      openGraph: {
        type: "website",
        url,
        title,
        description,
        images: [{ url: image }],
      },
      twitter: { card: "summary_large_image", title, description, images: [image] },
    };
  } catch {
    return {};
  }
}

export default function Page() {
  return <PropertyDetailPage />;
}
