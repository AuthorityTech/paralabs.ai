import { buildMachineManifest } from "@/lib/site-manifest";

export const dynamic = "force-static";
export const revalidate = 3600;

export function GET() {
  return Response.json(buildMachineManifest(), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
