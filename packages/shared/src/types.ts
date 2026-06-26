export type RiskLevel = "low" | "medium" | "high";

export interface LegalDocument {
  id: string;
  title: string;
  sourceType: "text" | "txt" | "sample" | "dataset" | "upload";
  originalName?: string;
  createdAt: string;
  chunkCount: number;
  contentHash?: string;
  docType?: "law" | "model-contract" | "sample-contract" | "uploaded";
  sourceUrl?: string;
  sourceLabel?: string;
}

export interface ChunkMetadata {
  source: string;
  sourceLabel?: string;
  sourceUrl?: string;
  docType?: LegalDocument["docType"];
  article?: string;
  position?: string;
  page: number;
  section: string;
  chunkIndex: number;
  tokenEstimate: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  title: string;
  content: string;
  chunkIndex: number;
  page: number;
  section: string;
  tokenEstimate: number;
  metadata: ChunkMetadata;
}

export interface Citation {
  documentId: string;
  title: string;
  chunkIndex: number;
  section: string;
  quote: string;
}

export interface ScoredChunk extends DocumentChunk {
  score: number;
  vectorScore?: number;
  keywordScore?: number;
  rerankScore?: number;
}

export interface RagAnswer {
  answer: string;
  citations: Citation[];
  retrievedChunks: ScoredChunk[];
  rewrittenQuestion: string;
  diagnostics?: {
    vectorCandidates: number;
    keywordCandidates: number;
    filteredCandidates: number;
    rerankedCandidates: number;
    minSimilarityScore: number;
    answerSource: "model" | "fallback" | "refusal";
  };
}

export interface ContractRisk {
  clause: string;
  riskLevel: RiskLevel;
  issue: string;
  suggestion: string;
  citation: Citation;
  requiresHumanReview: boolean;
}

export interface ContractReviewResult {
  risks: ContractRisk[];
  markdown: string;
}
