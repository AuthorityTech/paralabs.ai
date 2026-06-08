const BRAND_SUFFIX = " - Para Labs";
const DESCRIPTION_EXTENSION =
  " Para Labs analyzes the AI brand visibility signal, machine-readable evidence, and CMO implications.";

function compact(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function truncateAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const sliced = value.slice(0, Math.max(0, maxLength - 3)).trimEnd();
  const wordBoundary = sliced.lastIndexOf(" ");
  const base = wordBoundary > 32 ? sliced.slice(0, wordBoundary) : sliced;
  return `${base.replace(/[.,:;!?-]+$/, "")}...`;
}

function serializedHtmlLength(value: string): number {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").length;
}

function truncateForHtmlAttribute(value: string, maxLength: number): string {
  let result = compact(value);
  while (serializedHtmlLength(result) > maxLength && result.length > 4) {
    result = truncateAtWord(result.replace(/\.\.\.$/, ""), result.length - 1);
  }
  return result;
}

export function buildBoundedMetaTitle(title: string): string {
  const cleanTitle = compact(title) || "Para Labs Research";
  const titleLimit = 60 - serializedHtmlLength(BRAND_SUFFIX);
  return `${truncateForHtmlAttribute(cleanTitle, titleLimit)}${BRAND_SUFFIX}`;
}

export function buildBoundedMetaDescription(description: string): string {
  const cleanDescription =
    compact(description) ||
    "Independent research on AI brand visibility, answer surfaces, citations, and machine-mediated discovery.";
  const expanded =
    cleanDescription.length >= 120
      ? cleanDescription
      : `${cleanDescription}${DESCRIPTION_EXTENSION}`;
  return truncateForHtmlAttribute(expanded, 160);
}
