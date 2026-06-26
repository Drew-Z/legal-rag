import type { Citation, DocumentChunk } from "@legal-rag/shared";

export function toCitation(chunk: DocumentChunk): Citation {
  return {
    documentId: chunk.documentId,
    title: chunk.title,
    chunkIndex: chunk.chunkIndex,
    section: chunk.section,
    quote: trimQuote(chunk.content)
  };
}

export function trimQuote(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 120)}...` : compact;
}
