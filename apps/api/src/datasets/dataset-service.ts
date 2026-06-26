import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LegalDocument } from "@legal-rag/shared";
import type { DocumentIngestionService, ImportDocumentResult } from "../documents/ingestion-service.js";

interface DatasetRow {
  title: string;
  docType: LegalDocument["docType"];
  sourceLabel: string;
  sourceUrl: string;
  text?: string;
  clauses?: DatasetClause[];
}

interface DatasetClause {
  clauseId?: string;
  page?: number;
  position?: string;
  text: string;
}

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = resolve(CURRENT_DIR, "..", "..", "..", "..", "datasets", "public-safe", "legal-public-dataset.jsonl");

export async function seedPublicSafeDataset(
  ingestion: DocumentIngestionService
): Promise<ImportDocumentResult[]> {
  const rows = await readDatasetRows();
  const results: ImportDocumentResult[] = [];

  for (const row of rows) {
    results.push(
      await ingestion.importDocument({
        title: row.title,
        text: toDatasetText(row),
        sourceType: "dataset",
        docType: row.docType,
        sourceLabel: row.sourceLabel,
        sourceUrl: row.sourceUrl,
        originalName: "legal-public-dataset.jsonl"
      })
    );
  }

  return results;
}

export async function readDatasetRows(): Promise<DatasetRow[]> {
  const content = await readFile(DATASET_PATH, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DatasetRow);
}

function toDatasetText(row: DatasetRow): string {
  if (row.clauses && row.clauses.length > 0) {
    return [`${row.title} 公开安全数据`, ...row.clauses.map(formatClause)].join("\n\n");
  }

  return row.text ?? "";
}

function formatClause(clause: DatasetClause): string {
  const text = clause.text.trim();
  if (clause.clauseId && !text.startsWith(clause.clauseId)) {
    return `${clause.clauseId}${clause.position ? ` ${clause.position}` : ""} ${text}`;
  }

  if (clause.position && !text.startsWith("位置：")) {
    return `位置：${clause.position}。${text}`;
  }

  return text;
}
