/**
 * Normalizes markdown before HTML conversion to avoid formatting edge cases:
 * - Trims document and normalizes line endings
 * - Trims leading/trailing whitespace on blockquote lines (prevents " " in output)
 * - Collapses 3+ consecutive newlines to 2 (avoids excess vertical space)
 * - Trims trailing whitespace on any line (avoids stray spaces in paragraphs)
 */
export function normalizeMarkdown(content: string): string {
  if (!content || typeof content !== "string") return "";

  let out = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  out = out
    .split("\n")
    .map((line) => {
      const trimmed = line.trimEnd();
      if (trimmed.startsWith(">")) {
        const afterArrow = trimmed.slice(1).trimStart();
        return ">" + afterArrow.replace(/["\u201C\u201D]/g, "").trimStart();
      }
      return trimmed;
    })
    .join("\n");

  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

// Strip from blockquote inner content: literal quotes and HTML entities (styling is enough)
function stripQuotesFromBlockquoteInner(inner: string): string {
  return inner
    .replace(/["\u201C\u201D]/g, "")
    .replace(/&quot;/gi, "")
    .replace(/&ldquo;/gi, "")
    .replace(/&rdquo;/gi, "")
    .replace(/&#8220;/g, "")
    .replace(/&#8221;/g, "")
    .replace(/&#34;/g, "")
    .replace(/&#x22;/gi, "");
}

/**
 * Post-processes prose HTML to fix common edge cases:
 * - Trims leading/trailing whitespace inside <p> (fixes injected " " from markdown)
 * - Trims whitespace between blockquote and first/last child
 * - Strips all quotation marks inside blockquotes — literal and HTML entities (styling is sufficient)
 */
export function normalizeProseHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  let out = html
    .replace(/<p>\s+/g, "<p>")
    .replace(/\s+<\/p>/g, "</p>")
    .replace(/(<blockquote[^>]*>)\s+/g, "$1")
    .replace(/\s+(<\/blockquote>)/g, "$1");

  out = out.replace(
    /(<blockquote[^>]*>)([\s\S]*?)(\s*<\/blockquote>)/g,
    (_, open, inner, close) => open + stripQuotesFromBlockquoteInner(inner) + close
  );

  return out;
}