import { buildMachineSitemapXml } from "@/lib/site-manifest";

export const dynamic = "force-static";
export const revalidate = 3600;

export function GET() {
  return new Response(buildMachineSitemapXml(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
