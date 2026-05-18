export const dynamic = "force-static";
export const revalidate = 3600;

import { markdownResponse, homePageMarkdown } from "@/lib/machine-content";

export function GET() {
  return markdownResponse(homePageMarkdown());
}
