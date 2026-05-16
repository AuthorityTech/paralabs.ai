import fs from "fs";
import path from "path";
import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "content/posts");

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  lastModified?: string;
  description: string;
  tags?: string[];
  featured_image?: string;
  section?: string; // "essay" | "founderos" (defaults to "founderos")
}

export interface Post extends PostMeta {
  content: string;
}

function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function getAllPosts(): PostMeta[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();
  return files.map((filename) => {
    const filepath = path.join(POSTS_DIR, filename);
    const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");
    const raw = fs.readFileSync(filepath, "utf8");
    const { data } = matter(raw);
    const stat = fs.statSync(filepath);
    const lastModified =
      toIsoDate(data.lastModified) ??
      toIsoDate(data.lastmod) ??
      toIsoDate(data.updated) ??
      stat.mtime.toISOString();
    return {
      slug,
      title: data.title ?? slug,
      date: data.date ?? "",
      lastModified,
      description: data.description ?? "",
      tags: data.tags ?? [],
      featured_image: data.featured_image,
      section: data.section ?? "founderos",
    };
  });
}

export function getPost(slug: string): Post | null {
  if (!fs.existsSync(POSTS_DIR)) return null;
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
  const filename = files.find(
    (f) => f.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "") === slug
  );
  if (!filename) return null;
  const filepath = path.join(POSTS_DIR, filename);
  const raw = fs.readFileSync(filepath, "utf8");
  const { data, content } = matter(raw);
  const stat = fs.statSync(filepath);
  const lastModified =
    toIsoDate(data.lastModified) ??
    toIsoDate(data.lastmod) ??
    toIsoDate(data.updated) ??
    stat.mtime.toISOString();
  return {
    slug,
    title: data.title ?? slug,
    date: data.date ?? "",
    lastModified,
    description: data.description ?? "",
    tags: data.tags ?? [],
    featured_image: data.featured_image,
    section: data.section ?? "founderos",
    content,
  };
}