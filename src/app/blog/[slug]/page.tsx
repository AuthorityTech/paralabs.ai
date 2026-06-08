import { getPost } from "@/lib/posts";
import { normalizeMarkdown, normalizeProseHtml } from "@/lib/normalizeMarkdown";
import { notFound } from "next/navigation";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import type { Metadata } from "next";
import Link from "next/link";
import PostShareCard from "@/components/PostShareCard";
import { formatPostDisplayDate } from "@/lib/postShare";
import { getBlogPostCanonicalImageAsset } from "@/lib/image-policy";
import { generateBlogJsonLd, PL_BLOG_CONFIG } from "@editorialkit/schema";
import { buildBoundedMetaDescription, buildBoundedMetaTitle } from "@/lib/machine-metadata";

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
  const imageAsset = getBlogPostCanonicalImageAsset(post);
  const metaTitle = buildBoundedMetaTitle(post.title);
  const metaDescription = buildBoundedMetaDescription(post.description);
  return {
    title: { absolute: metaTitle },
    description: metaDescription,
    alternates: { canonical: `${BASE}/blog/${slug}` },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      type: "article",
      url: `${BASE}/blog/${slug}`,
      publishedTime: post.date,
      modifiedTime: post.lastModified || post.date,
      images: [{ url: imageAsset.imageUrl, width: imageAsset.width, height: imageAsset.height, alt: imageAsset.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
      images: [{ url: imageAsset.imageUrl, alt: imageAsset.alt }],
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

  const imageAsset = getBlogPostCanonicalImageAsset(post);

  const blogLd = generateBlogJsonLd(
    {
      slug,
      title: post.title,
      description: post.description,
      publishDate: post.date,
      lastModified: post.lastModified,
      body: html,
      featuredImage: imageAsset.imageUrl,
    },
    PL_BLOG_CONFIG,
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: blogLd }} />

      <nav className="mb-12">
        <Link
          href="/blog"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-link transition-colors duration-200 ease-nothing hover:text-nothing-primary"
        >
          &larr; Research
        </Link>
      </nav>

      <header className="mb-10">
        <h1 data-speakable="headline" className="mb-5 font-display text-[1.65rem] font-medium leading-tight tracking-[-0.02em] text-nothing-display md:text-[2rem]">
          {post.title}
        </h1>
        {post.description && (
          <p data-speakable="summary" className="mb-6 text-[0.95rem] leading-relaxed text-nothing-secondary">
            {post.description}
          </p>
        )}
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

      <PostShareCard
        imageUrl={imageAsset.imageUrl}
        alt={imageAsset.alt}
        width={imageAsset.width}
        height={imageAsset.height}
      />

      <div
        className="prose prose-nothing max-w-none prose-p:mb-5 prose-p:leading-[1.75] prose-p:text-nothing-primary prose-headings:font-medium prose-headings:tracking-tight prose-headings:text-nothing-display prose-a:text-link prose-a:no-underline prose-strong:text-nothing-primary prose-li:text-nothing-secondary prose-blockquote:border-nothing-border prose-blockquote:text-nothing-secondary prose-code:text-nothing-primary prose-pre:rounded prose-pre:border prose-pre:border-nothing-border prose-pre:bg-nothing-raised prose-hr:border-nothing-border prose-h2:mb-4 prose-h2:mt-10 hover:prose-a:text-nothing-primary"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
