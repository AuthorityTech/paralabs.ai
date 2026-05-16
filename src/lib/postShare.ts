import { SITE_URL } from "@/lib/site";

export const POST_SHARE_IMAGE_WIDTH = 1200;
export const POST_SHARE_IMAGE_HEIGHT = 630;

export function getPostShareImageUrl(slug: string) {
  return `${SITE_URL}/blog/${slug}/opengraph-image`;
}

export function formatPostDisplayDate(date: string) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatPostShareDate(date: string) {
  return formatPostDisplayDate(date).toUpperCase();
}

export function formatPostShareMainTags(tags?: string[]) {
  const formatted = (tags ?? [])
    .slice(0, 4)
    .map((tag) => tag.replace(/[-_]+/g, " ").toUpperCase());

  return formatted.length > 0 ? formatted.join(" · ") : "RESEARCH";
}
