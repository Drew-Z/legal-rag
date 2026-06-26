export type RiskLevel = "low" | "medium" | "high";

export interface ProjectSpace {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  isDefault?: boolean;
}

export interface AuthUser {
  email: string;
  name: string;
}

export interface AuthStatus {
  enabled: boolean;
  authenticated: boolean;
  user?: AuthUser;
}

export interface LegalDocument {
  id: string;
  projectId: string;
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
  projectId: string;
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

export type QualityStatus = "pass" | "warn" | "fail";

export interface QualityCheck {
  id: string;
  label: string;
  status: QualityStatus;
  detail: string;
}

export interface QualityReport {
  generatedAt: string;
  runtime: {
    modelProvider: "mock" | "openai-compatible";
    vectorStore: "memory" | "pgvector";
    embeddingModel: string;
    chatModel?: string;
    documentCount: number;
    chunkCount: number;
  };
  eval: {
    total: number;
    passed: number;
    failed: number;
    answerableCases: number;
    refusalCases: number;
  };
  checks: QualityCheck[];
}

export interface EvaluationResult {
  id: string;
  passed: boolean;
  reason: string;
  citationText: string;
  answer: string;
}

export interface EvaluationReport {
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  answerableCases: number;
  refusalCases: number;
  results: EvaluationResult[];
}
