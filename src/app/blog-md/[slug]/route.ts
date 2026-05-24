import { blogPostMarkdown } from "@/lib/machine-content";
import { createSlugMarkdownRouteHandlers } from "@/lib/markdown-route";
import { getAllPosts } from "@/lib/posts";

export const { dynamic, revalidate, generateStaticParams, GET } =
  createSlugMarkdownRouteHandlers({
    getSlugs: () => getAllPosts().map((post) => post.slug),
    getMarkdown: blogPostMarkdown,
  });
