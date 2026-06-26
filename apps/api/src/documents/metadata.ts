import type { ChunkMetadata, LegalDocument } from "@legal-rag/shared";

export interface ImportDocumentInput {
  title: string;
  text: string;
  sourceType?: LegalDocument["sourceType"];
  docType?: LegalDocument["docType"];
  sourceUrl?: string;
  sourceLabel?: string;
  originalName?: string;
}

export function enrichChunkMetadata(
  metadata: ChunkMetadata,
  input: ImportDocumentInput
): ChunkMetadata {
  const position = extractPosition(metadata.section) ?? inferPosition(metadata, input);

  return {
    ...metadata,
    sourceLabel: input.sourceLabel,
    sourceUrl: input.sourceUrl,
    docType: input.docType,
    article: extractArticle(metadata.section),
    position
  };
}

function extractArticle(section: string): string | undefined {
  return section.match(/第[零〇一二三四五六七八九十百千万两0-9]+条/)?.[0];
}

function extractPosition(section: string): string | undefined {
  const match = section.match(/^位置[:：]\s*(.+)$/);
  return match?.[1]?.trim();
}

function inferPosition(metadata: ChunkMetadata, input: ImportDocumentInput): string | undefined {
  if (metadata.article) {
    return undefined;
  }

  if (input.docType === "model-contract" || input.docType === "sample-contract") {
    return metadata.section;
  }

  return undefined;
}
