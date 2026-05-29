import { getAllPosts } from "@/lib/posts";
import { BLOG_COPY } from "@/lib/page-copy";
import { formatPostDisplayDate } from "@/lib/postShare";
import Link from "next/link";
import type { Metadata } from "next";
const BASE = "https://paralabs.ai";

export const metadata: Metadata = {
  title: BLOG_COPY.title,
  description: BLOG_COPY.metadataDescription,
  alternates: { canonical: `${BASE}/blog` },
  openGraph: {
    title: `${BLOG_COPY.title} — Para Labs`,
    description: BLOG_COPY.metadataDescription,
    url: `${BASE}/blog`,
  },
};

function buildBlogSchema(posts: ReturnType<typeof getAllPosts>) {
  const itemList = posts.map((post, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    url: `${BASE}/blog/${post.slug}`,
    item: {
      "@type": "BlogPosting",
      "@id": `${BASE}/blog/${post.slug}#article`,
      url: `${BASE}/blog/${post.slug}`,
      headline: post.title,
      datePublished: post.date,
      dateModified: post.lastModified || post.date,
    },
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${BASE}/blog#blog`,
        name: BLOG_COPY.schemaName,
        description: BLOG_COPY.schemaDescription,
        url: `${BASE}/blog`,
        publisher: { "@type": "Organization", "@id": `${BASE}/#organization` },
      },
      {
        "@type": "CollectionPage",
        "@id": `${BASE}/blog#collection`,
        url: `${BASE}/blog`,
        name: BLOG_COPY.collectionName,
        isPartOf: { "@id": `${BASE}/#website` },
        mainEntity: { "@id": `${BASE}/blog#item-list` },
        breadcrumb: { "@id": `${BASE}/blog#breadcrumb` },
      },
      {
        "@type": "ItemList",
        "@id": `${BASE}/blog#item-list`,
        name: BLOG_COPY.itemListName,
        numberOfItems: itemList.length,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        itemListElement: itemList,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${BASE}/blog#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: { "@type": "WebPage", "@id": BASE, name: "Home" } },
          { "@type": "ListItem", position: 2, name: BLOG_COPY.heading, item: { "@type": "WebPage", "@id": `${BASE}/blog`, name: BLOG_COPY.heading } },
        ],
      },
    ],
  };
}

function formatDate(d: string) {
  return formatPostDisplayDate(d);
}

function PostList({ posts }: { posts: ReturnType<typeof getAllPosts> }) {
  return (
    <div className="space-y-10">
      {posts.map((post) => (
        <article key={post.slug} className="group">
          <Link href={"/blog/" + post.slug} className="block">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="mb-1.5 text-[15px] font-normal leading-snug text-nothing-primary transition-colors duration-200 ease-nothing group-hover:text-link">
                  {post.title}
                </h3>
                {post.description && <p className="text-[14px] leading-relaxed text-nothing-secondary">{post.description}</p>}
              </div>
              <time className="flex-shrink-0 whitespace-nowrap pt-[3px] font-mono text-[11px] uppercase tracking-[0.06em] text-nothing-disabled">
                {formatDate(post.date)}
              </time>
            </div>
            {post.tags && post.tags.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="border border-nothing-borderHi bg-nothing-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-nothing-secondary">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </Link>
        </article>
      ))}
    </div>
  );
}

export default function BlogPage() {
  const all = getAllPosts();
  const blogSchema = buildBlogSchema(all);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }} />

      <header className="mb-16">
        <h1 className="font-display mb-3 text-[2rem] font-medium leading-tight tracking-[-0.02em] text-nothing-display">
          {BLOG_COPY.heading}
        </h1>
        <p className="max-w-xl text-[14px] font-light leading-relaxed text-nothing-secondary">
          {BLOG_COPY.visibleDescription}
        </p>
      </header>

      {all.length > 0 ? (
        <section>
          <PostList posts={all} />
        </section>
      ) : (
        <p className="text-[14px] text-nothing-secondary">{BLOG_COPY.emptyWriting}</p>
      )}
    </div>
  );
}
