import { blogPostMarkdown } from "@/lib/machine-content";
import { createSlugMarkdownRouteHandlers } from "@/lib/markdown-route";
import { getAllPosts } from "@/lib/posts";
import { SITE_URL } from "@/lib/site";

export const { dynamic, revalidate, generateStaticParams, GET } =
  createSlugMarkdownRouteHandlers({
    getSlugs: () => getAllPosts().map((post) => post.slug),
    getMarkdown: blogPostMarkdown,
    getCanonicalUrl: (slug) => `${SITE_URL}/blog/${slug}`,
  });
