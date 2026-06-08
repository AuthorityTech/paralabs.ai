import { getPost } from "@/lib/posts";
import {
  buildBlogIndexMarkdown,
  buildHomePageMarkdown,
  buildMachineReadableLinks,
} from "@/lib/site-manifest";

const BASE = "https://paralabs.ai";

export function markdownResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

export function homePageMarkdown(): string {
  return buildHomePageMarkdown();
}

export function blogIndexMarkdown(): string {
  return buildBlogIndexMarkdown();
}

export function blogPostMarkdown(slug: string): string | null {
  const post = getPost(slug);
  if (!post) return null;

  const tags =
    post.tags && post.tags.length > 0
      ? `Tags: ${post.tags.join(", ")}`
      : "";

  return `# ${post.title}

> ${post.description}

- Published: ${post.date}
- URL: ${BASE}/blog/${post.slug}
${tags ? `- ${tags}` : ""}

---

${post.content.trim()}

${buildMachineReadableLinks(post.slug, post.tags)}
`;
}
