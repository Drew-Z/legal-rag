# Public Safe Legal Dataset

This dataset is designed for a legal RAG demo. It avoids private or sensitive contracts.

## Sources

- Public law excerpts and safety summaries from official public legal texts.
- Public model-contract style summaries.
- Self-authored, fictional sample contracts for risk review demos.

## Metadata Requirements

Each JSONL row is one source document and includes:

- `title`
- `docType`: `law`, `model-contract`, or `sample-contract`
- `sourceLabel`
- `sourceUrl`
- `clauses`

Each `clauses` entry includes:

- `clauseId`: article or clause number when available, such as `第五百零九条`
- `page`: source page or synthetic page marker for demo positioning
- `position`: paragraph or clause position, such as `数据安全`
- `text`: safe excerpt or self-authored clause text

The seed service converts `clauses` into importable text while preserving article numbers and `位置：...` markers so chunk metadata can preserve source, type, clause, page, and paragraph-position information.

## Import

Use the API endpoint:

```http
POST /api/datasets/seed
```

or the validation script:

```powershell
npm.cmd --workspace apps/api run validate
```
