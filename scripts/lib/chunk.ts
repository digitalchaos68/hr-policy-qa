interface Chunk {
  sectionPath: string;
  text: string;
}

const MAX_CHARS = 2800; // roughly 600-700 tokens
const OVERLAP_CHARS = 400;

export function chunkMarkdown(markdown: string, docTitle: string): Chunk[] {
  const sections = markdown.split(/\n(?=## )/g).filter((s) => s.trim());
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const headingMatch = section.match(/^##\s+(.+)/);
    const heading = headingMatch ? headingMatch[1].trim() : docTitle;
    const sectionPath = `${docTitle} > ${heading}`;
    const body = section.trim();

    if (body.length <= MAX_CHARS) {
      chunks.push({ sectionPath, text: body });
      continue;
    }

    // Split long sections into overlapping windows
    let start = 0;
    while (start < body.length) {
      const end = Math.min(start + MAX_CHARS, body.length);
      chunks.push({ sectionPath, text: body.slice(start, end) });
      if (end === body.length) break;
      start = end - OVERLAP_CHARS;
    }
  }

  return chunks;
}

export function chunkPlainText(text: string, sectionPath: string): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + MAX_CHARS, text.length);
    chunks.push({ sectionPath, text: text.slice(start, end) });
    if (end === text.length) break;
    start = end - OVERLAP_CHARS;
  }
  return chunks;
}