import type { RagAnswer } from "@legal-rag/shared";

export type View = "knowledge" | "qa" | "review" | "quality";
export type AnswerSource = NonNullable<RagAnswer["diagnostics"]>["answerSource"];

export interface QaHistoryItem {
  id: string;
  question: string;
  answer: RagAnswer;
  createdAt: string;
}

