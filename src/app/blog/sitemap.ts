export const dynamic = "force-static";

import { getAllPosts } from "@/lib/posts";
import { getBlogPostCanonicalImageAsset, getSitemapImageUrls } from "@/lib/image-policy";
import type { MetadataRoute } from "next";

const BASE = "https://paralabs.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const latest = posts.reduce((max, p) => {
    const ts = new Date(p.lastModified || p.date || 0).getTime();
    return Number.isFinite(ts) ? Math.max(max, ts) : max;
  }, 0);
  const latestDate = latest > 0 ? new Date(latest) : new Date();
  return [
    { url: `${BASE}/blog`, lastModified: latestDate, changeFrequency: "daily", priority: 0.9 },
    ...posts.map(p => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: new Date(p.lastModified || p.date || Date.now()),
      changeFrequency: "monthly" as const,
      priority: 0.75,
      images: getSitemapImageUrls(getBlogPostCanonicalImageAsset(p)),
    })),
  ];
}
