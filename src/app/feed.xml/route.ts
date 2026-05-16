export const dynamic = "force-static";
import { buildRssXml } from "@/lib/rss";

export function GET() {
  return new Response(buildRssXml(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}