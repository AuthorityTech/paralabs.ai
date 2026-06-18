import { getPost } from "../src/lib/posts";
import { renderMarkdownWithSectionNav } from "../src/lib/section-nav";

const REPRESENTATIVE_LONG_POST_SLUG = "small-brand-specificity-ai-search-visibility-2026";
const EXCLUDED_TITLES = new Set(["sources", "references", "footnotes"]);

function fail(message: string): never {
  throw new Error(message);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function textKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function sourceFaqQuestionTitles(markdown: string): Set<string> {
  const titles = new Set<string>();
  let inFaq = false;

  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;

    const level = match[1].length;
    const title = match[2].replace(/\s+#+$/, "").trim();

    if (level === 2) {
      inFaq = textKey(title) === "faq";
      continue;
    }

    if (inFaq && level === 3) {
      titles.add(textKey(title));
    }
  }

  return titles;
}

async function main() {
  const post = getPost(REPRESENTATIVE_LONG_POST_SLUG);
  assert(post, `Missing representative post: ${REPRESENTATIVE_LONG_POST_SLUG}`);

  const { html, sectionNav } = await renderMarkdownWithSectionNav(post.content);
  assert(sectionNav.length >= 3, `Expected at least 3 section nav items, found ${sectionNav.length}.`);

  const ids = new Set<string>();
  for (const item of sectionNav) {
    assert(!ids.has(item.id), `Duplicate section nav id: ${item.id}`);
    ids.add(item.id);

    assert(!EXCLUDED_TITLES.has(textKey(item.title)), `Excluded section appeared in nav: ${item.title}`);

    const headingPattern = new RegExp(`<h${item.level}\\s+id="${escapeRegExp(item.id)}"(?:\\s|>)`);
    assert(headingPattern.test(html), `Nav href #${item.id} has no matching rendered h${item.level} id.`);
  }

  const faqItems = sectionNav.filter((item) => textKey(item.title) === "faq");
  assert(faqItems.length === 1, `Expected FAQ to appear once as a top-level item, found ${faqItems.length}.`);
  assert(faqItems[0].level === 2, "FAQ nav item must be level 2.");

  const faqQuestionTitles = sourceFaqQuestionTitles(post.content);
  for (const item of sectionNav) {
    assert(!faqQuestionTitles.has(textKey(item.title)), `FAQ question leaked into section nav: ${item.title}`);
  }

  console.log(`section-nav ok: ${post.slug} has ${sectionNav.length} items with matching heading ids.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
