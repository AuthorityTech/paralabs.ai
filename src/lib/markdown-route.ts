import { markdownResponse } from "./machine-content";

type SlugRouteConfig = {
  getSlugs: () => string[];
  getMarkdown: (slug: string) => string | null;
  getCanonicalUrl: (slug: string) => string;
};

export const MARKDOWN_ROUTE_CONFIG = {
  dynamic: "force-static" as const,
  revalidate: 3600,
};

export function createSlugMarkdownRouteHandlers(config: SlugRouteConfig) {
  return {
    ...MARKDOWN_ROUTE_CONFIG,
    generateStaticParams(): Array<{ slug: string }> {
      return config.getSlugs().map((slug) => ({ slug }));
    },
    async GET(
      _req: Request,
      context: { params: Promise<{ slug: string }> }
    ): Promise<Response> {
      const { slug } = await context.params;
      const md = config.getMarkdown(slug);
      if (!md) return new Response("Not found", { status: 404 });
      return markdownResponse(md, config.getCanonicalUrl(slug));
    },
  };
}
