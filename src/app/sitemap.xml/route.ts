export const dynamic = "force-static";

const SITEMAPS = [
  "https://paralabs.ai/pages/sitemap.xml",
  "https://paralabs.ai/blog/sitemap.xml",
];

export function GET() {
  const now = new Date().toISOString();
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SITEMAPS.map(
      (loc) => `  <sitemap><loc>${loc}</loc><lastmod>${now}</lastmod></sitemap>`,
    ),
    "</sitemapindex>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
