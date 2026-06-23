import { getPost } from "@/lib/posts";
import { renderMarkdownWithSectionNav } from "@/lib/section-nav";
import { notFound } from "next/navigation";
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

  const { html, sectionNav } = await renderMarkdownWithSectionNav(post.content);
  const showSectionNav = sectionNav.length >= 3;

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
    <div
      className={
        showSectionNav
          ? "mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-16 md:py-20 xl:grid-cols-[minmax(0,42rem)_14rem]"
          : "mx-auto max-w-content px-6 py-16 md:py-20"
      }
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: blogLd }} />

      <main className={showSectionNav ? "mx-auto w-full max-w-content xl:mx-0" : "w-full"}>
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
      </main>

      {showSectionNav && (
        <aside className="hidden xl:block">
          <nav aria-label="Article sections" className="sticky top-24 border-l border-nothing-border pl-5">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.1em] text-nothing-disabled">On this page</p>
            <ol className="space-y-3">
              {sectionNav.map((item) => (
                <li key={item.id} className={item.level === 3 ? "pl-3" : undefined}>
                  <a
                    href={`#${item.id}`}
                    className="block text-[12px] leading-snug text-nothing-secondary transition-colors duration-200 ease-nothing hover:text-link"
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
      )}
    </div>
  );
}
