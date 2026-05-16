import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/posts";
import {
  formatPostShareDate,
  formatPostShareMainTags,
  POST_SHARE_IMAGE_HEIGHT,
  POST_SHARE_IMAGE_WIDTH,
} from "@/lib/postShare";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = {
  width: POST_SHARE_IMAGE_WIDTH,
  height: POST_SHARE_IMAGE_HEIGHT,
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const shareDate = formatPostShareDate(post.date);
  const shareTags = formatPostShareMainTags(post.tags);

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: "#f4eee8",
          color: "#171717",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 18% 18%, rgba(223,94,24,0.13), transparent 28%), radial-gradient(circle at 80% 78%, rgba(223,94,24,0.08), transparent 34%)",
          }}
        />
        <div style={{ position: "absolute", left: 84, right: 84, top: 82, height: 1, background: "#d8d0c8" }} />
        <div style={{ position: "absolute", left: 84, right: 84, bottom: 102, height: 1, background: "#d8d0c8" }} />
        <div
          style={{
            position: "absolute",
            right: -96,
            top: -126,
            width: 504,
            height: 390,
            border: "1px solid #d8d0c8",
            borderRadius: 999,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -120,
            bottom: -176,
            width: 456,
            height: 366,
            border: "1px solid #e2d7cf",
            borderRadius: 999,
          }}
        />
        <div style={{ position: "absolute", left: 108, right: 108, bottom: 126, display: "flex", justifyContent: "space-between" }}>
          {Array.from({ length: 36 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                width: 1,
                height: idx === 17 ? 10 : 8,
                background: idx === 17 ? "#df5e18" : "#bbb3ac",
                opacity: idx === 17 ? 1 : 0.45,
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: 240,
            right: 240,
            top: 126,
            bottom: 126,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#8c8580",
              fontFamily: "Menlo, Consolas, monospace",
              fontSize: 12,
              letterSpacing: "3.2px",
              textTransform: "uppercase",
            }}
          >
            Para Labs Research
          </div>
          <div style={{ width: 40, height: 2, marginTop: 22, background: "#df5e18" }} />
          <div
            style={{
              marginTop: 24,
              fontFamily: "Georgia, serif",
              fontSize: 34,
              lineHeight: 1.15,
              letterSpacing: "-0.25px",
              fontWeight: 400,
            }}
          >
            {shareTags}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              color: "#8c8580",
              fontFamily: "Menlo, Consolas, monospace",
              fontSize: 13,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
            }}
          >
            {shareDate}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
