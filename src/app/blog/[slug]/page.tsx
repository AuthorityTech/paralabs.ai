import { getAllPosts, getPost } from "@/lib/posts";
import { normalizeMarkdown, normalizeProseHtml } from "@/lib/normalizeMarkdown";
import { notFound } from "next/navigation";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import type { Metadata } from "next";
import Link from "next/link";
import PostShareCard from "@/components/PostShareCard";
import {
  formatPostDisplayDate,
  getPostShareImageUrl,
  POST_SHARE_IMAGE_HEIGHT,
  POST_SHARE_IMAGE_WIDTH,
} from "@/lib/postShare";

export const dynamicParams = true;
export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return [];
}

const BASE = "https://paralabs.ai";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const image = getPostShareImageUrl(slug);
  const imageAlt = `${post.title} — Para Labs research image`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `${BASE}/blog/${slug}` },
    openGraph: {
      title: post.title + " — Para Labs",
      description: post.description,
      type: "article",
      url: `${BASE}/blog/${slug}`,
      publishedTime: post.date,
      modifiedTime: post.lastModified || post.date,
      images: [{ url: image, width: POST_SHARE_IMAGE_WIDTH, height: POST_SHARE_IMAGE_HEIGHT, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title + " — Para Labs",
      description: post.description,
      images: [{ url: image, alt: imageAlt }],
    },
  };
}

function formatDate(d: string) {
  return formatPostDisplayDate(d);
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const normalizedContent = normalizeMarkdown(post.content);
  const processed = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(normalizedContent);
  const html = normalizeProseHtml(processed.toString());

  const image = getPostShareImageUrl(slug);
  const pageUrl = `${BASE}/blog/${slug}`;
  const webPageId = pageUrl + "#webpage";
  const articleId = pageUrl + "#article";
  const imageId = pageUrl + "#primaryimage";
  const breadcrumbId = pageUrl + "#breadcrumb";
  const imageAlt = `${post.title} — Para Labs research image`;
  const imageObject = {
    "@type": "ImageObject",
    "@id": imageId,
    url: image,
    contentUrl: image,
    width: POST_SHARE_IMAGE_WIDTH,
    height: POST_SHARE_IMAGE_HEIGHT,
    caption: imageAlt,
    description: post.description,
    representativeOfPage: true,
  };

  const postSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": webPageId,
        url: pageUrl,
        name: post.title,
        isPartOf: { "@id": `${BASE}/#website` },
        breadcrumb: { "@id": breadcrumbId },
        mainEntity: { "@id": articleId },
        primaryImageOfPage: { "@id": imageId },
      },
      imageObject,
      {
        "@type": "BlogPosting",
        "@id": articleId,
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.lastModified || post.date,
        url: pageUrl,
        image: { "@id": imageId },
        thumbnailUrl: image,
        author: {
          "@type": "Organization",
          "@id": `${BASE}/#organization`,
          name: "Para Labs",
          url: BASE,
        },
        publisher: { "@type": "Organization", "@id": `${BASE}/#organization` },
        mainEntityOfPage: { "@id": webPageId },
        keywords: post.tags?.join(", ") ?? "",
        isPartOf: { "@type": "Blog", "@id": `${BASE}/blog#blog` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: { "@type": "WebPage", "@id": BASE, name: "Home" } },
          { "@type": "ListItem", position: 2, name: "Research", item: { "@type": "WebPage", "@id": `${BASE}/blog`, name: "Research" } },
          { "@type": "ListItem", position: 3, name: post.title, item: { "@type": "WebPage", "@id": pageUrl, name: post.title } },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(postSchema) }} />

      <nav className="mb-12">
        <Link
          href="/blog"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-link transition-colors duration-200 ease-nothing hover:text-nothing-primary"
        >
          &larr; Research
        </Link>
      </nav>

      <header className="mb-10">
        <h1 className="mb-5 font-display text-[1.65rem] font-medium leading-tight tracking-[-0.02em] text-nothing-display md:text-[2rem]">
          {post.title}
        </h1>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-nothing-secondary">Para Labs Research</span>
          <span className="text-nothing-border">&middot;</span>
          <time className="font-mono text-[11px] uppercase tracking-[0.06em] text-nothing-disabled">{formatDate(post.date)}</time>
          {post.tags && post.tags.length > 0 && (
            <>
              <span className="text-nothing-border">&middot;</span>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="border border-nothing-borderHi bg-nothing-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-nothing-secondary">
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      <PostShareCard date={post.date} tags={post.tags} />

      <div
        className="prose prose-nothing max-w-none prose-p:mb-5 prose-p:leading-[1.75] prose-p:text-nothing-primary prose-headings:font-medium prose-headings:tracking-tight prose-headings:text-nothing-display prose-a:text-link prose-a:no-underline prose-strong:text-nothing-primary prose-li:text-nothing-secondary prose-blockquote:border-nothing-border prose-blockquote:text-nothing-secondary prose-code:text-nothing-primary prose-pre:rounded prose-pre:border prose-pre:border-nothing-border prose-pre:bg-nothing-raised prose-hr:border-nothing-border prose-h2:mb-4 prose-h2:mt-10 hover:prose-a:text-nothing-primary"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
