import type { DocumentChunk } from "@legal-rag/shared";
import { detectSection, estimateTokens } from "../documents/text.js";

interface SplitInput {
  documentId: string;
  projectId?: string;
  title: string;
  text: string;
}

const CHUNK_SIZE = 850;
const OVERLAP = 120;

export function splitIntoChunks(input: SplitInput): DocumentChunk[] {
  const paragraphs = input.text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const chunks: DocumentChunk[] = [];
  let current = "";
  let currentSection = input.title;

  for (const paragraph of paragraphs) {
    const paragraphSection = detectSection(paragraph, currentSection);
    const startsNewArticle = /^第[零〇一二三四五六七八九十百千两0-9]+条/.test(paragraph);
    const startsNewPosition = /^位置：/.test(paragraph);

    if ((startsNewArticle || startsNewPosition) && current) {
      pushChunk(chunks, input, current, currentSection);
      current = "";
    }

    currentSection = paragraphSection;

    if ((current + "\n\n" + paragraph).trim().length <= CHUNK_SIZE) {
      current = (current + "\n\n" + paragraph).trim();
      continue;
    }

    if (current) {
      pushChunk(chunks, input, current, currentSection);
    }

    if (paragraph.length <= CHUNK_SIZE) {
      current = paragraph;
      continue;
    }

    for (let start = 0; start < paragraph.length; start += CHUNK_SIZE - OVERLAP) {
      pushChunk(chunks, input, paragraph.slice(start, start + CHUNK_SIZE), currentSection);
    }
    current = "";
  }

  if (current) {
    pushChunk(chunks, input, current, currentSection);
  }

  return chunks;
}

function pushChunk(
  chunks: DocumentChunk[],
  input: SplitInput,
  content: string,
  section: string
): void {
  const chunkIndex = chunks.length;
  const page = Math.floor(chunkIndex / 4) + 1;
  chunks.push({
    id: `${input.documentId}_chunk_${chunkIndex + 1}`,
    documentId: input.documentId,
    title: input.title,
    content,
    chunkIndex,
    page,
    section,
    tokenEstimate: estimateTokens(content),
    metadata: {
      source: input.title,
      projectId: input.projectId ?? "project_default",
      page,
      section,
      chunkIndex,
      tokenEstimate: estimateTokens(content)
    }
  });
}
