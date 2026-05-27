/** GEO helpers — FAQ extraction + speakable for AI engine extractability */

export interface FaqItem {
  question: string;
  answer: string;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function extractFaqFromHtml(html: string): FaqItem[] {
  const faqHeaderRegex = /<h2[^>]*>([^<]*(?:FAQ|Frequently Asked)[^<]*)<\/h2>/i;
  const faqMatch = faqHeaderRegex.exec(html);
  if (!faqMatch) return [];

  const startIdx = faqMatch.index + faqMatch[0].length;
  const nextH2 = html.indexOf("<h2", startIdx);
  const faqSection = nextH2 === -1 ? html.slice(startIdx) : html.slice(startIdx, nextH2);

  const items: FaqItem[] = [];
  const qaPairRegex = /<h3[^>]*>\s*(.*?)\s*<\/h3>\s*([\s\S]*?)(?=<h3|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = qaPairRegex.exec(faqSection)) !== null) {
    const question = stripHtml(match[1]).trim();
    const answerBlock = match[2];

    const paragraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pMatch: RegExpExecArray | null;

    while ((pMatch = pRegex.exec(answerBlock)) !== null) {
      const text = stripHtml(pMatch[1]).trim();
      if (text) paragraphs.push(text);
    }

    const answer = paragraphs.join(" ");
    if (question && answer) items.push({ question, answer });
  }

  return items;
}
