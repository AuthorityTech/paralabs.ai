export const dynamic = "force-static";
export const revalidate = 3600;

import { markdownResponse, homePageMarkdown } from "@/lib/machine-content";
import { SITE_URL } from "@/lib/site";

export function GET() {
  return markdownResponse(homePageMarkdown(), SITE_URL);
}
