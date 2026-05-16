import { getAllPosts, type PostMeta } from "@/lib/posts";

const BASE = "https://paralabs.ai";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc2822(value: string | undefined): string {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return new Date().toUTCString();
  return parsed.toUTCString();
}

function renderItem(post: PostMeta): string {
  const url = `${BASE}/blog/${post.slug}`;
  const title = escapeXml(post.title || post.slug);
  const description = escapeXml(post.description || "");
  const published = toRfc2822(post.date);
  const updated = toRfc2822(post.lastModified || post.date);
  const guid = escapeXml(`${url}#article`);
  const categories =
    post.tags?.map((tag) => `<category>${escapeXml(tag)}</category>`).join("") ?? "";

  return [
    "<item>",
    `<title>${title}</title>`,
    `<link>${url}</link>`,
    `<guid isPermaLink="false">${guid}</guid>`,
    `<description>${description}</description>`,
    `<pubDate>${published}</pubDate>`,
    `<dc:date>${updated}</dc:date>`,
    categories,
    "</item>",
  ].join("");
}

export function buildRssXml(): string {
  const posts = getAllPosts();
  const latestTimestamp = posts.reduce((max, post) => {
    const ts = new Date(post.lastModified || post.date || 0).getTime();
    return Number.isFinite(ts) ? Math.max(max, ts) : max;
  }, 0);
  const latest = latestTimestamp > 0 ? new Date(latestTimestamp).toUTCString() : new Date().toUTCString();
  const items = posts.map(renderItem).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Para Labs — AI Brand Visibility Lab</title>
    <description>How brands are adapting to AI-first discovery. Case studies, experiments, and tactical intelligence.</description>
    <link>${BASE}/blog</link>
    <language>en-us</language>
    <managingEditor>research@paralabs.ai (Para Labs Research)</managingEditor>
    <webMaster>research@paralabs.ai (Para Labs Research)</webMaster>
    <lastBuildDate>${latest}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;
}
