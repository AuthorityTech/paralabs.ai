import { getAllPosts, getPost } from "@/lib/posts";

const BASE = "https://paralabs.ai";

/** Wrap any markdown body in a standard .md response */
export function markdownResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

export function homePageMarkdown(): string {
  const posts = getAllPosts().slice(0, 10);

  return `# Para Labs

> Independent AI brand visibility research lab. Case studies, experiments, and intelligence on how brands adapt to AI-first discovery.

- URL: ${BASE}
- Feed: ${BASE}/feed.xml
- llms.txt: ${BASE}/llms.txt

## Latest Research

${
  posts.length > 0
    ? posts
        .map(
          (p) =>
            `- [${p.title}](${BASE}/blog/${p.slug}) — ${p.description?.slice(0, 140) || ""}`
        )
        .join("\n")
    : "- Research publishing soon."
}
`;
}

export function blogIndexMarkdown(): string {
  const posts = getAllPosts();

  return `# Para Labs — Research Index

> AI brand visibility research — case studies, experiments, and tactical intelligence on how brands win AI-first discovery.

${
  posts.length > 0
    ? posts
        .map(
          (p) =>
            `- [${p.title}](${BASE}/blog/${p.slug}): ${p.description?.slice(0, 140) || ""} (${p.date})`
        )
        .join("\n")
    : "- Research publishing soon."
}
`;
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
`;
}
