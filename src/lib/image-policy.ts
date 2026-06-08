import {
  getPostShareImageUrl,
  POST_SHARE_IMAGE_HEIGHT,
  POST_SHARE_IMAGE_WIDTH,
} from "./postShare";
import type { PostMeta } from "./posts";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "./site";

export type ImageAssetBucket =
  | "indexable-image-assets"
  | "supporting-social-brand-assets"
  | "private-decorative-generated-assets";

export type ImageAssetRouteFamily =
  | "home-static-social-image"
  | "blog-generated-opengraph-image";

export type CanonicalImageAsset = {
  canonicalPageUrl: string;
  imageUrl: string;
  width: number;
  height: number;
  alt: string;
  bucket: ImageAssetBucket;
  routeFamily: ImageAssetRouteFamily;
  searchPolicy: "attach-to-canonical-page" | "metadata-only";
  schemaPolicy: "primary-image-of-page" | "none";
};

export const HOME_STATIC_SOCIAL_IMAGE: CanonicalImageAsset = {
  canonicalPageUrl: SITE_URL,
  imageUrl: `${SITE_URL}/images/paralabs-social-share-dark.png`,
  width: 1731,
  height: 909,
  alt: `${SITE_NAME} - ${SITE_TAGLINE}`,
  bucket: "supporting-social-brand-assets",
  routeFamily: "home-static-social-image",
  searchPolicy: "metadata-only",
  schemaPolicy: "none",
};

export function getHomeCanonicalImageAsset(): CanonicalImageAsset {
  return HOME_STATIC_SOCIAL_IMAGE;
}

export function getBlogPostCanonicalImageAsset(
  post: Pick<PostMeta, "slug" | "title">,
): CanonicalImageAsset {
  return {
    canonicalPageUrl: `${SITE_URL}/blog/${post.slug}`,
    imageUrl: getPostShareImageUrl(post.slug),
    width: POST_SHARE_IMAGE_WIDTH,
    height: POST_SHARE_IMAGE_HEIGHT,
    alt: `Para Labs research image for ${post.title}`,
    bucket: "supporting-social-brand-assets",
    routeFamily: "blog-generated-opengraph-image",
    searchPolicy: "attach-to-canonical-page",
    schemaPolicy: "primary-image-of-page",
  };
}

export function getSitemapImageUrls(asset: CanonicalImageAsset): string[] {
  return asset.searchPolicy === "attach-to-canonical-page" ? [asset.imageUrl] : [];
}

export function getCanonicalImageAssets(
  posts: Array<Pick<PostMeta, "slug" | "title">>,
): CanonicalImageAsset[] {
  return [
    getHomeCanonicalImageAsset(),
    ...posts.map((post) => getBlogPostCanonicalImageAsset(post)),
  ];
}
