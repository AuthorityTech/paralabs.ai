export const dynamic = "force-static";
export const revalidate = 3600;

import { markdownResponse, blogPostMarkdown } from "@/lib/machine-content";
import { getAllPosts } from "@/lib/posts";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const md = blogPostMarkdown(slug);
  if (!md) {
    return new Response("Not found", { status: 404 });
  }
  return markdownResponse(md);
}
