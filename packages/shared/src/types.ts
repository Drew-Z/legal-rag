export type RiskLevel = "low" | "medium" | "high";

export interface ProjectSpace {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  isDefault?: boolean;
  ownerEmail?: string;
}

export interface AuthUser {
  email: string;
  name: string;
}

export type ProjectRole = "owner" | "editor" | "viewer";

export interface ProjectMember {
  projectId: string;
  userEmail: string;
  role: ProjectRole;
  createdAt: string;
}

export interface AuthStatus {
  enabled: boolean;
  authenticated: boolean;
  user?: AuthUser;
}

export type AuditAction =
  | "project.create"
  | "document.import"
  | "document.upload"
  | "dataset.seed"
  | "rag.query"
  | "contract.review";

export interface AuditLogEntry {
  id: string;
  projectId?: string;
  userEmail: string;
  action: AuditAction;
  targetType?: "project" | "document" | "dataset" | "question" | "contract";
  targetId?: string;
  summary: string;
  createdAt: string;
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

export type IngestionJobKind = "import-text" | "upload" | "seed-dataset";
export type IngestionJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface IngestionJobResult {
  documentId?: string;
  chunkCount?: number;
  document?: LegalDocument;
  duplicate?: boolean;
  parser?: "txt" | "pdf" | "docx";
  warnings?: string[];
  imported?: number;
  duplicates?: number;
  documents?: LegalDocument[];
}

export interface IngestionJob {
  id: string;
  projectId: string;
  kind: IngestionJobKind;
  title: string;
  status: IngestionJobStatus;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: IngestionJobResult;
  error?: string;
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
  analysisSource?: "rule" | "model-assisted";
}

export interface ContractReviewResult {
  risks: ContractRisk[];
  markdown: string;
  reviewSource?: "rules" | "model-assisted" | "fallback";
  schemaValid?: boolean;
  modelError?: string;
}

export interface ReviewEvaluationResult {
  id: string;
  title: string;
  passed: boolean;
  expectedRisks: string[];
  matchedRisks: string[];
  missingRisks: string[];
  actualRisks: string[];
  markdown: string;
}

export interface ReviewEvaluationReport {
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  expectedRiskCount: number;
  matchedRiskCount: number;
  recall: number;
  results: ReviewEvaluationResult[];
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
    citationAccuracy: number;
    answerableAccuracy: number;
    refusalAccuracy: number;
  };
  reviewEval: {
    total: number;
    passed: number;
    failed: number;
    expectedRiskCount: number;
    matchedRiskCount: number;
    recall: number;
  };
  checks: QualityCheck[];
}

export interface QualityTrendPoint {
  id: string;
  generatedAt: string;
  modelProvider: QualityReport["runtime"]["modelProvider"];
  vectorStore: QualityReport["runtime"]["vectorStore"];
  embeddingModel: string;
  chatModel?: string;
  documentCount: number;
  chunkCount: number;
  ragPassed: number;
  ragTotal: number;
  citationAccuracy: number;
  refusalAccuracy: number;
  reviewPassed: number;
  reviewTotal: number;
  reviewRecall: number;
}

export interface QualityTrendReport {
  points: QualityTrendPoint[];
}

export interface EvaluationResult {
  id: string;
  passed: boolean;
  kind: "answerable" | "refusal";
  expectedTopic: string;
  citationHit: boolean;
  refused: boolean;
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
  citationAccuracy: number;
  answerableAccuracy: number;
  refusalAccuracy: number;
  results: EvaluationResult[];
}
