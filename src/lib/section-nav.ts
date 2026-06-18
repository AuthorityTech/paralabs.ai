import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import type { Heading, Root } from "mdast";
import { toString } from "mdast-util-to-string";
import GithubSlugger from "github-slugger";
import { normalizeMarkdown, normalizeProseHtml } from "./normalizeMarkdown";

declare module "unist" {
  interface Data {
    hProperties?: Record<string, unknown>;
  }
}

export interface SectionNavItem {
  id: string;
  title: string;
  level: 2 | 3;
}

const EXCLUDED_TOP_LEVEL_SECTIONS = new Set(["sources", "references", "footnotes"]);

function normalizeHeadingTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function navTitleKey(value: string): string {
  return normalizeHeadingTitle(value).toLowerCase();
}

function setHeadingId(node: Heading, id: string): void {
  const data = node.data ?? {};
  node.data = data;
  data.hProperties = { ...data.hProperties, id };
}

export function sectionNavPlugin(sectionNav: SectionNavItem[]) {
  return (tree: Root) => {
    const slugger = new GithubSlugger();
    let inExcludedSection = false;
    let inFaqSection = false;

    for (const node of tree.children) {
      if (node.type !== "heading" || (node.depth !== 2 && node.depth !== 3)) {
        continue;
      }

      const title = normalizeHeadingTitle(toString(node));
      const id = slugger.slug(title);
      setHeadingId(node, id);

      if (node.depth === 2) {
        const key = navTitleKey(title);
        inExcludedSection = EXCLUDED_TOP_LEVEL_SECTIONS.has(key);
        inFaqSection = key === "faq";
      }

      if (!title || inExcludedSection || (inFaqSection && node.depth === 3)) {
        continue;
      }

      sectionNav.push({ id, title, level: node.depth });
    }
  };
}

export async function renderMarkdownWithSectionNav(content: string): Promise<{
  html: string;
  sectionNav: SectionNavItem[];
}> {
  const sectionNav: SectionNavItem[] = [];
  const processed = await remark()
    .use(remarkGfm)
    .use(sectionNavPlugin, sectionNav)
    .use(remarkHtml, { sanitize: false })
    .process(normalizeMarkdown(content));

  return {
    html: normalizeProseHtml(processed.toString()),
    sectionNav,
  };
}
