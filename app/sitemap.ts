import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BASE_URL = "https://www.flexpasshq.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/events`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/tos`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/refund`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const { data: events } = await db
      .from("events")
      .select("id, updated_at")
      .order("date", { ascending: false })
      .limit(1000);

    const eventRoutes: MetadataRoute.Sitemap = (events || []).map((e) => ({
      url: `${BASE_URL}/events/${e.id}`,
      lastModified: e.updated_at ? new Date(e.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    return [...staticRoutes, ...eventRoutes];
  } catch {
    return staticRoutes;
  }
}