# 法律智能机器人与合同审查 RAG 应用：启动提示词与构建文档

## 一、新会话启动提示词

下面这段可以直接复制到新的 Codex 会话里使用。

```text
我想从零实现一个“法律智能机器人与合同审查 RAG 应用”MVP 项目，目的是用于 AI 应用全栈 / RAG / Agent 工程师方向的简历项目和面试演示。

请你作为资深 AI 应用全栈工程师，帮我完整搭建这个项目。要求先检查当前工作区和现有技术环境，再给出最小可行实现方案，然后直接开始创建项目代码、文档和验证流程。

项目定位：
这是一个面向法律问答和合同风险审查的 RAG 应用。用户可以上传合同、法律文档或 TXT 文本，系统解析文档后进行清洗、chunk 切分、Embedding 向量化和入库。用户可以基于知识库提问，系统返回答案和引用来源。用户也可以发起合同审查，系统输出风险条款、风险等级、问题说明、修改建议、引用来源和是否建议人工复核。

核心目标：
1. 做出一个能演示的 RAG 项目闭环。
2. 能体现文档解析、chunk 切分、Embedding、向量检索、引用溯源、结构化输出和低幻觉设计。
3. 项目代码要清晰，README 要能说明架构和启动方式。
4. 最终要能写进简历，并能支撑面试中关于 RAG、向量库、合同审查、引用溯源、AI 工程化的问题。

推荐技术栈：
- 前端：Vue 3 + TypeScript + Vite，或根据工作区现有习惯选择 React。
- 后端：Node.js + Express + TypeScript。
- 数据库：PostgreSQL + pgvector。如果本地暂时不方便跑 pgvector，可以先实现可替换的内存向量库或 SQLite/mock adapter，但代码结构要保留向量库抽象。
- 队列：BullMQ 可选。MVP 可以先同步处理，后续再扩展为异步任务。
- 文档解析：TXT 必须支持，PDF / DOCX 可先做基础支持或预留 adapter。
- AI 模型：通过统一 model provider adapter 调用 Chat 和 Embedding。不要在代码里写死密钥，使用 .env。
- 输出格式：RAG 问答返回 answer + citations；合同审查返回结构化 JSON 和可读 Markdown。

MVP 必须实现：
1. 文档上传或导入文本。
2. 文档解析和文本清洗。
3. chunk 切分，保留 source、page、section、chunkIndex 等元数据。
4. Embedding 生成和向量入库。
5. 用户提问，执行向量检索，生成答案。
6. 返回引用来源 citations。
7. 合同审查接口，输出风险条款、风险等级、原因、修改建议、引用来源、是否建议人工复核。
8. 简单前端页面：知识库上传/入库页、问答页、合同审查页。
9. README：写清项目背景、架构、启动方式、接口、RAG 流程、面试亮点。
10. 至少提供一份 sample contract 文本，方便演示。

建议目录结构：
legal-rag/
  apps/
    web/
    api/
  packages/
    shared/
  docs/
    architecture.md
    interview-notes.md
  samples/
    sample-contract.txt
  docker-compose.yml
  README.md

后端建议模块：
- documents：文档上传、解析、清洗。
- chunks：chunk 切分和元数据。
- embeddings：Embedding provider 抽象。
- vector-store：向量库抽象，先支持 memory adapter，后续支持 pgvector。
- rag：检索、上下文拼接、问答生成。
- review：合同风险审查。
- citations：引用来源格式化。
- config：环境变量和模型配置。

数据结构建议：
Document:
- id
- title
- sourceType
- originalName
- createdAt

Chunk:
- id
- documentId
- content
- chunkIndex
- page
- section
- tokenEstimate
- metadata
- embedding

RagAnswer:
- answer
- citations[]
- retrievedChunks[]

ContractRisk:
- clause
- riskLevel
- issue
- suggestion
- citation
- requiresHumanReview

接口建议：
- POST /api/documents/import-text
- GET /api/documents
- GET /api/documents/:id/chunks
- POST /api/rag/query
- POST /api/contracts/review
- GET /api/health

前端页面建议：
1. 知识库页面：
   - 输入标题和文本，导入文档。
   - 展示文档列表和 chunk 数量。
   - 支持查看 chunk 和元数据。

2. 问答页面：
   - 输入问题。
   - 返回答案。
   - 展示引用来源和命中的 chunk。

3. 合同审查页面：
   - 选择文档或粘贴合同文本。
   - 输出风险列表。
   - 每条风险展示风险等级、原因、修改建议、引用来源、是否建议人工复核。

开发要求：
- 先做最小闭环，不要一开始做复杂权限、多租户、支付、协同编辑。
- 代码结构要为后续 pgvector、BullMQ、PDF/DOCX 解析扩展留好 adapter。
- 所有密钥从 .env 读取，不要提交真实密钥。
- 每完成一个阶段运行可行的验证命令。
- 最后生成 README、架构图说明、简历项目描述和面试讲解稿。

验收标准：
1. 本地能启动 API 和 Web。
2. 能导入 sample contract。
3. 能看到 chunk 列表。
4. 能基于 sample contract 提问并返回答案。
5. 答案包含引用来源。
6. 能生成合同审查风险报告。
7. README 说明完整。
8. docs/interview-notes.md 包含项目 1 分钟介绍、RAG 流程、技术亮点和高频追问回答。

请你先检查当前目录结构、Node/Python/数据库可用情况，然后给出实施计划，并开始实现。
```

## 二、项目构建说明

### 1. 项目名称

```text
legal-rag
```

中文名：

```text
法律智能机器人与合同审查 RAG 应用
```

### 2. 项目目标

这个项目不是做完整法律 SaaS，而是做一个面试可演示的 RAG MVP。

目标是证明你具备：

- 文档解析能力；
- RAG 入库和查询流程；
- chunk 切分和元数据保留；
- Embedding 和向量检索；
- 引用溯源；
- 合同审查结构化输出；
- AI 低幻觉设计；
- 前后端全栈实现能力；
- 项目文档和面试表达能力。

### 3. MVP 范围

必须做：

```text
文档导入
文本清洗
chunk 切分
Embedding
向量检索
RAG 问答
引用来源
合同审查
结构化风险报告
简单前端页面
README
面试说明文档
```

暂时不做：

```text
多租户
复杂权限
支付
在线协作
完整后台管理系统
复杂工作流
大规模数据优化
```

### 4. 推荐技术栈

优先版本：

```text
前端：Vue 3 + TypeScript + Vite
后端：Express + TypeScript
数据库：PostgreSQL + pgvector
向量库：先 memory adapter，后 pgvector adapter
AI：Chat Model + Embedding Model adapter
样式：简单清爽即可
部署：Docker Compose 可选
```

如果想最快完成 MVP，可以先这样做：

```text
Express API
Memory Vector Store
本地 JSON / SQLite 存储
简单 Vue 页面
TXT 文档导入
```

后续再替换为：

```text
PostgreSQL + pgvector
PDF / DOCX parser
BullMQ 异步任务
Docker Compose
```

### 5. 推荐目录结构

```text
legal-rag/
  apps/
    api/
      src/
        config/
        documents/
        chunks/
        embeddings/
        vector-store/
        rag/
        review/
        citations/
        server.ts
      package.json
      tsconfig.json
      .env.example
    web/
      src/
        pages/
        components/
        api/
        App.vue
        main.ts
      package.json
      tsconfig.json
      vite.config.ts
  packages/
    shared/
      src/
        types.ts
  docs/
    architecture.md
    interview-notes.md
  samples/
    sample-contract.txt
  README.md
  docker-compose.yml
  package.json
```

### 6. 后端模块设计

#### documents

职责：

```text
接收文档
解析文本
清洗文本
生成 Document 记录
```

MVP 先支持：

```text
TXT
直接粘贴文本
```

后续扩展：

```text
PDF
DOCX
OCR
HTML
```

#### chunks

职责：

```text
按标题、段落、长度切分文本
保留 source、page、section、chunkIndex
估算 token
```

MVP 切分策略：

```text
按段落优先
超长段落按长度切
chunk size 约 600-1000 中文字符
overlap 约 80-150 中文字符
```

#### embeddings

职责：

```text
封装 Embedding 模型调用
提供 embedText / embedBatch
支持 mock embedding 方便本地无 key 调试
```

接口：

```ts
interface EmbeddingProvider {
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

#### vector-store

职责：

```text
写入 chunk + embedding
按问题向量检索 topK
支持 metadata filter
```

接口：

```ts
interface VectorStore {
  upsertChunks(chunks: EmbeddedChunk[]): Promise<void>;
  similaritySearch(queryEmbedding: number[], topK: number): Promise<ScoredChunk[]>;
}
```

MVP：

```text
MemoryVectorStore
```

进阶：

```text
PgVectorStore
```

#### rag

职责：

```text
接收用户问题
生成 query embedding
检索相关 chunk
拼接上下文
调用 chat model
返回 answer + citations
```

#### review

职责：

```text
合同审查
识别风险条款
生成结构化风险报告
```

输出结构：

```ts
interface ContractRisk {
  clause: string;
  riskLevel: "low" | "medium" | "high";
  issue: string;
  suggestion: string;
  citation: Citation;
  requiresHumanReview: boolean;
}
```

### 7. API 设计

#### 健康检查

```http
GET /api/health
```

返回：

```json
{
  "ok": true
}
```

#### 导入文本

```http
POST /api/documents/import-text
```

请求：

```json
{
  "title": "示例合同",
  "text": "合同正文..."
}
```

返回：

```json
{
  "documentId": "doc_001",
  "chunkCount": 12
}
```

#### 文档列表

```http
GET /api/documents
```

#### 文档 chunk

```http
GET /api/documents/:id/chunks
```

#### RAG 问答

```http
POST /api/rag/query
```

请求：

```json
{
  "question": "合同中的违约责任是否合理？",
  "topK": 5
}
```

返回：

```json
{
  "answer": "根据合同第 5 条，违约责任约定较重...",
  "citations": [
    {
      "documentId": "doc_001",
      "title": "示例合同",
      "chunkIndex": 4,
      "section": "违约责任",
      "quote": "任一方违约需支付合同总金额 100% 的违约金..."
    }
  ]
}
```

#### 合同审查

```http
POST /api/contracts/review
```

请求：

```json
{
  "documentId": "doc_001"
}
```

返回：

```json
{
  "risks": [
    {
      "clause": "第 5 条 违约责任",
      "riskLevel": "high",
      "issue": "违约金比例过高，缺少责任上限。",
      "suggestion": "建议将违约金上限调整为合同总金额的 20%-30%，并区分一般违约和重大违约。",
      "citation": {
        "documentId": "doc_001",
        "title": "示例合同",
        "chunkIndex": 4,
        "section": "违约责任",
        "quote": "任一方违约需支付合同总金额 100% 的违约金..."
      },
      "requiresHumanReview": true
    }
  ]
}
```

### 8. 前端页面设计

#### 知识库页面

功能：

```text
输入文档标题
粘贴合同文本
点击导入
展示文档列表
展示 chunk 数量
查看 chunk 内容和元数据
```

#### 问答页面

功能：

```text
输入问题
点击提问
展示答案
展示引用来源
展示命中的 chunk
```

#### 合同审查页面

功能：

```text
选择文档
点击开始审查
展示风险列表
风险等级颜色区分
展示问题说明、修改建议、引用来源、人工复核标记
```

### 9. Prompt 设计

#### RAG 问答 Prompt

```text
你是一个法律文档问答助手。请只基于给定的上下文回答问题。

要求：
1. 不要编造上下文中不存在的信息。
2. 如果上下文不足，请明确说明“根据当前资料无法确认”。
3. 回答要简洁、准确。
4. 涉及关键结论时，要引用对应片段。

用户问题：
{question}

上下文：
{context}
```

#### 合同审查 Prompt

```text
你是一个合同风险审查助手。请基于给定合同片段识别潜在风险。

请输出 JSON 数组，每个元素包含：
- clause：风险条款名称或编号
- riskLevel：low / medium / high
- issue：问题说明
- suggestion：修改建议
- quote：依据的原文片段
- requiresHumanReview：是否建议人工复核，布尔值

审查重点：
1. 违约责任是否过重或缺少上限
2. 付款条件是否不清晰
3. 交付标准是否模糊
4. 解除条款是否不对等
5. 保密、知识产权、争议解决是否缺失或不明确
6. 是否存在明显对一方不利的条款

合同内容：
{contractText}
```

### 10. 示例合同文本

可以在 `samples/sample-contract.txt` 中放入：

```text
技术服务合同

甲方：某某科技有限公司
乙方：某某软件工作室

第一条 服务内容
乙方为甲方提供企业内部知识库系统开发服务，包括需求沟通、系统设计、前端开发、后端接口开发和部署支持。

第二条 合同金额与付款
合同总金额为人民币 100000 元。甲方应在项目完成后一次性支付全部费用。

第三条 交付标准
乙方应在 30 日内完成系统开发并交付甲方使用。具体功能以双方沟通为准。

第四条 保密义务
双方应对合作过程中获知的商业信息承担保密义务。

第五条 违约责任
任一方违约，应向守约方支付合同总金额 100% 的违约金，并赔偿因此造成的全部损失。

第六条 知识产权
项目成果归甲方所有，乙方不得再次使用。

第七条 争议解决
双方如发生争议，应友好协商解决；协商不成的，提交甲方所在地人民法院处理。
```

这个示例里可以审查出：

```text
付款节点不合理
交付标准模糊
违约责任过重
知识产权条款过于绝对
争议解决地点偏向甲方
```

### 11. 开发顺序

#### 第 1 阶段：项目骨架

```text
创建 monorepo
创建 apps/api
创建 apps/web
创建 packages/shared
配置 TypeScript
配置 README
```

验收：

```text
API /api/health 可访问
Web 页面可打开
```

#### 第 2 阶段：文档导入和 chunk

```text
实现 import-text
实现 cleanText
实现 splitIntoChunks
保存 document 和 chunks
```

验收：

```text
导入 sample contract 后能看到 chunk 列表
```

#### 第 3 阶段：Embedding 和向量检索

```text
实现 EmbeddingProvider
先实现 MockEmbeddingProvider
实现 MemoryVectorStore
实现 similaritySearch
```

验收：

```text
输入问题后能检索出相关 chunk
```

#### 第 4 阶段：RAG 问答

```text
实现 /api/rag/query
拼接上下文
调用 ChatProvider
返回 answer + citations
```

验收：

```text
能问“违约责任是否合理”，并返回引用来源
```

#### 第 5 阶段：合同审查

```text
实现 /api/contracts/review
根据合同 chunk 生成风险报告
输出结构化 risks
```

验收：

```text
能识别违约责任、付款条件、交付标准等风险
```

#### 第 6 阶段：前端页面

```text
知识库页面
问答页面
合同审查页面
引用来源展示
风险等级展示
```

验收：

```text
用户可以通过前端完成导入、提问和审查
```

#### 第 7 阶段：文档和面试材料

```text
README
docs/architecture.md
docs/interview-notes.md
简历项目描述
项目 1 分钟介绍
高频追问回答
```

验收：

```text
项目能启动
能演示
能写进简历
能讲清楚
```

### 12. README 必须包含

```text
项目背景
功能列表
技术栈
架构说明
RAG 流程
合同审查流程
启动方式
环境变量
接口说明
示例数据
面试亮点
后续优化方向
```

### 13. 面试材料必须包含

`docs/interview-notes.md` 建议包含：

```text
1. 项目 1 分钟介绍
2. 项目 3 分钟介绍
3. RAG 完整流程
4. chunk 切分策略
5. 向量检索和关键词检索区别
6. 为什么需要引用溯源
7. 为什么需要 Rerank
8. 如何降低幻觉
9. 如何做成本优化
10. 后续如何扩展为生产系统
```

### 14. 简历描述建议

```text
法律智能机器人与合同审查 RAG 应用
角色：AI 应用开发 / RAG 流程设计
技术栈：Vue 3、TypeScript、Express、PostgreSQL / pgvector、Embedding、RAG、Prompt Engineering

项目描述：
面向法律问答和合同风险审查的 AI 应用，支持法律文档和合同文件解析、条款切分、向量化入库、语义检索、引用溯源和结构化风险输出，重点解决法律场景中回答不可追溯和模型幻觉问题。

主要职责：
- 设计文档入库流程，对合同文本进行解析、清洗、条款级切分，并保留来源文件、页码、标题和条款编号等元数据。
- 设计 RAG 查询流程，包括 Embedding、向量检索、关键词检索、结果去重、上下文拼接和答案生成。
- 针对合同审查场景设计结构化输出，包括风险条款、风险等级、问题说明、修改建议、引用来源和是否建议人工复核。
- 通过引用溯源机制降低法律类回答的幻觉风险，使关键结论能够追溯到原始文档片段。
- 预留向量库、文档解析器和模型 provider adapter，便于后续扩展 pgvector、PDF/DOCX 解析和多模型路由。
```

### 15. 最终验收清单

项目完成时必须满足：

```text
API 能启动
Web 能启动
能导入 sample contract
能查看 chunks
能提问并返回答案
答案包含 citations
能生成合同审查风险报告
风险报告结构化
README 完整
docs/interview-notes.md 完整
简历描述可用
```

