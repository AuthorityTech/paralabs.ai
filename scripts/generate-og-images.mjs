#!/usr/bin/env node
/**
 * generate-og-images.mjs
 * Generates canonical post images for paralabs.ai posts.
 * One image system only: public/images/{slug}.png
 */

import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "content/posts");
const IMAGES_DIR = path.join(ROOT, "public/images");
const BACKGROUND_PATH = path.join(IMAGES_DIR, "blog-og-background.png");
const SITE_URL = "https://paralabs.ai";
const WIDTH = 1200;
const HEIGHT = 630;
const FONTS = {
  lora: "https://cdn.jsdelivr.net/npm/@fontsource/lora@5/files/lora-latin-400-normal.woff",
};
async function fetchFont(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
function titleFontSize(title) {
  if (title.length > 80) return 44;
  if (title.length > 60) return 50;
  if (title.length > 40) return 56;
  return 62;
}
async function renderTextLayer(title, fontLora) {
  const fontSize = titleFontSize(title);
  const svg = await satori({
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 100px",
        fontFamily: "Lora",
        backgroundColor: "transparent",
      },
      children: [
        {
          type: "p",
          props: {
            style: {
              fontSize,
              fontWeight: 400,
              color: "#ffffff",
              textAlign: "center",
              lineHeight: 1.32,
              letterSpacing: "-0.9px",
              margin: 0,
              maxWidth: 680,
              textShadow: "0 2px 8px rgba(0,0,0,0.5), 0 -1px 1px rgba(255,255,255,0.15)",
            },
            children: title,
          },
        },
        {
          type: "span",
          props: {
            style: {
              position: "absolute",
              bottom: 48,
              fontSize: 12,
              fontWeight: 400,
              color: "rgba(255,255,255,0.85)",
              letterSpacing: "1px",
            },
            children: "paralabs.ai",
          },
        },
      ],
    },
  }, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: "Lora", data: fontLora, weight: 400, style: "normal" }],
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } });
  return resvg.render().asPng();
}
async function getBackgroundBuffer() {
  if (!fs.existsSync(BACKGROUND_PATH)) throw new Error(`Missing background: ${BACKGROUND_PATH}`);
  return sharp(fs.readFileSync(BACKGROUND_PATH)).resize(WIDTH, HEIGHT, { fit: "cover", position: "center" }).png().toBuffer();
}
async function renderImage(title, backgroundBuffer, fontLora) {
  const textPng = await renderTextLayer(title, fontLora);
  return sharp(backgroundBuffer).composite([{ input: textPng, top: 0, left: 0 }]).png().toBuffer();
}
if (!fs.existsSync(POSTS_DIR)) {
  console.log("No posts directory — nothing to do.");
  process.exit(0);
}
fs.mkdirSync(IMAGES_DIR, { recursive: true });
const [backgroundBuffer, fontLora] = await Promise.all([getBackgroundBuffer(), fetchFont(FONTS.lora)]);
const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
let generated = 0;
let patched = 0;
for (const filename of files) {
  const filepath = path.join(POSTS_DIR, filename);
  const raw = fs.readFileSync(filepath, "utf8");
  const { data, content } = matter(raw);
  const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");
  const imageFile = path.join(IMAGES_DIR, `${slug}.png`);
  const imageSiteUrl = `${SITE_URL}/images/${slug}.png`;
  if (!fs.existsSync(imageFile)) {
    const png = await renderImage(data.title || slug, backgroundBuffer, fontLora);
    fs.writeFileSync(imageFile, png);
    generated += 1;
  }
  if (data.featured_image !== imageSiteUrl) {
    const newData = { ...data, featured_image: imageSiteUrl };
    fs.writeFileSync(filepath, matter.stringify(content, newData));
    patched += 1;
  }
}
console.log(`Generated ${generated} image(s); patched ${patched} post(s).`);