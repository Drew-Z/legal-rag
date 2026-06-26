# Legal RAG

法律智能机器人与合同审查 RAG 应用，一个用于简历和面试演示的全栈 RAG 项目。

## 功能

- 导入合同或法律文本，支持粘贴文本、TXT、PDF、DOCX
- 一键初始化公开安全法律数据集，保留来源标签和来源 URL
- SHA-256 文档判重，避免重复入库
- 文本清洗和条款级 chunk 切分
- Mock embedding 和内存向量检索
- 查询增强：追问重写、hybrid recall、相似度阈值过滤、轻量 rerank
- RAG 问答，返回 answer + citations
- 合同风险审查，返回结构化 JSON 和 Markdown
- Vue 前端三页工作台：知识库、智能问答、合同审查、上传进度、问答历史、来源高亮、报告导出
- 问答诊断会展示回答来源：真实模型、本地回退或资料不足拒答
- 质量面板展示运行时模型、pgvector 状态、知识库规模、评测通过率和 readiness checks
- RAG 评测集，覆盖 citation 命中和资料不足拒答
- 示例合同和面试讲解材料

## 技术栈

- Web：Vue 3 + TypeScript + Vite
- API：Node.js + Express + TypeScript
- Shared：workspace package 共享类型
- Vector store：Memory adapter
- Model：Mock embedding provider，预留真实模型 provider
- Future：PostgreSQL + pgvector、BullMQ、真实 embedding/chat model、模型 rerank

## 启动

```powershell
npm.cmd install
npm.cmd run dev
```

启动后：

- Web: `http://127.0.0.1:5173`
- API: `http://localhost:4000/api/health`

如果只启动单边：

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
```

## 环境变量

复制 `apps/api/.env.example` 后按需修改。

```text
PORT=4000
WEB_ORIGIN=http://localhost:5173
MODEL_PROVIDER=mock
VECTOR_STORE=memory

LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=gemini-3.5-flash-thinking
EMBEDDING_BASE_URL=
EMBEDDING_API_KEY=
EMBEDDING_MODEL=Qwen3-Embedding-0.6B
EMBEDDING_DIM=1024

DATABASE_URL=
```

默认使用 mock provider，不需要真实密钥。

接入真实模型和 Supabase pgvector 时：

```text
MODEL_PROVIDER=openai-compatible
VECTOR_STORE=pgvector
LLM_BASE_URL=https://你的模型网关/v1
LLM_API_KEY=你的模型网关密钥
LLM_MODEL=gemini-3.5-flash-thinking
EMBEDDING_BASE_URL=
EMBEDDING_API_KEY=
EMBEDDING_MODEL=Qwen3-Embedding-0.6B
EMBEDDING_DIM=1024
DATABASE_URL=postgresql://postgres:你的密码@你的host:5432/postgres?sslmode=require
```

`MODEL_PROVIDER=openai-compatible` 时，生成模型走 `LLM_*`，embedding 默认复用同一组 `LLM_*`；如果你给 `EMBEDDING_BASE_URL` 和 `EMBEDDING_API_KEY`，embedding 就会单独走那一组凭据。

如果当前 token 没有 chat model 权限，系统会继续使用真实 embedding + pgvector 检索，并回退到本地可解释答案模板。

## API

### 健康检查

```http
GET /api/health
```

### 质量报告

```http
GET /api/quality/report
```

返回运行时配置、知识库规模、RAG 评测摘要和 readiness checks，可用于前端质量面板和项目演示。

### 导入文本

```http
POST /api/documents/import-text
Content-Type: application/json

{
  "title": "示例合同",
  "text": "合同正文..."
}
```

### 上传文件

```http
POST /api/documents/upload
Content-Type: multipart/form-data

file=<TXT/PDF/DOCX>
title=上传文档标题
```

### 初始化公开安全数据集

```http
POST /api/datasets/seed
```

### 文档列表

```http
GET /api/documents
```

### 文档 chunks

```http
GET /api/documents/:id/chunks
```

### RAG 问答

```http
POST /api/rag/query
Content-Type: application/json

{
  "question": "违约责任是否合理？",
  "topK": 5
}
```

### 合同审查

```http
POST /api/contracts/review
Content-Type: application/json

{
  "documentId": "doc_xxx"
}
```

也可以传入：

```json
{
  "text": "合同正文..."
}
```

## RAG 流程

1. 导入文本。
2. 计算 SHA-256 content hash，重复文档直接返回已有记录。
3. 清洗换行和空白。
4. 按条款和段落切分 chunk，保留 source、page、section、chunkIndex。
5. 生成 embedding。
6. 写入 memory vector store。
7. 提问时先进行轻量问题重写，处理“它/这个/上述”等追问。
8. 同时执行向量召回和关键词召回，合并 top 20 候选。
9. 按相似度阈值和关键词命中过滤低相关片段。
10. 用轻量 rerank 把命中问题关键词、法律术语和条款号的 chunk 排到前面。
11. 对领域外或资料不足的问题返回拒答。
12. 基于检索结果生成回答。
13. 返回 citations 和 diagnostics，支持引用溯源、候选统计和回答来源调试。

## 借鉴的 RAG 工程实践

`resources/` 里保存了一篇 Java + LangChain4j 的 RAG 全流程教程。当前项目没有迁移 Java 技术栈，但借鉴了其中更通用的工程思路：

- 入库阶段增加文件 hash 判重。
- 查询阶段增加问题重写。
- 检索后增加相似度阈值过滤。
- 在向量召回后增加轻量 rerank。
- 保持向量库 adapter 边界，后续可替换 pgvector、Chroma 或 Milvus。
- 增加可运行评测脚本，检查 citation 命中和拒答行为。

## 合同审查流程

MVP 使用可解释规则识别高频合同风险：

- 付款节点不合理
- 交付标准模糊
- 违约责任过重
- 知识产权条款过于绝对
- 争议解决地点偏向一方

返回字段包括 clause、riskLevel、issue、suggestion、citation 和 requiresHumanReview。

## 示例数据

示例合同在 `samples/sample-contract.txt`。前端也提供“填入示例合同”按钮。

公开安全数据集在 `datasets/public-safe/legal-public-dataset.jsonl`，包含公开法律片段、合同示范文本安全摘要和自编脱敏样本。可在前端点击“初始化公开数据集”，也可调用 `POST /api/datasets/seed`。

## 验证与评测

```powershell
npm.cmd run typecheck
npm.cmd --workspace apps/api run validate
npm.cmd --workspace apps/api run evaluate
npm.cmd --workspace apps/api run db:migrate
npm.cmd --workspace apps/api run validate:pgvector
npm.cmd run build
```

`validate` 覆盖健康检查、文本导入、重复导入、数据集初始化、TXT 上传、问答和合同审查。`evaluate` 会读取 `eval/rag-eval-set.json`，检查可回答问题的引用命中，以及越界问题是否拒答。
`validate:pgvector` 会使用 `.env` 中的外部 PostgreSQL 和真实 embedding 模型，验证数据集入库、pgvector 检索和引用返回。

## 架构说明

详见 `docs/architecture.md`。

## 面试亮点

- 完整 RAG 闭环：导入、chunk、embedding、检索、回答、引用。
- 低幻觉设计：只基于 retrieved chunks 回答，关键结论返回 citations。
- 查询质量增强：问题重写、hybrid search、阈值过滤和 rerank。
- 工程抽象清晰：embedding provider、vector store、review service 可替换。
- 无 key 可演示：mock embedding 保证本地可运行。
- 可扩展方向明确：pgvector、BullMQ、真实模型、模型 rerank。

## 后续优化

- 接入真实 embedding 和 chat model。
- 增加 PostgreSQL + pgvector 持久化。
- 支持 OCR 和更复杂版式解析。
- 引入专门 rerank 模型。
- 扩展评测集，验证 citation 命中率、审查召回率和拒答准确率。
