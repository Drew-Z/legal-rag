# Interview Notes

## 1 分钟介绍

这是一个已经部署上线的法律问答和合同风险审查 RAG 项目。前端部署在 Render Static Site，API 部署在 Render Web Service，真实文档和 1024 维 embedding 持久化到 Supabase PostgreSQL + pgvector。用户可以导入合同文本或上传 TXT/PDF/DOCX，也可以初始化公开安全法律数据；系统会清洗文档、按条款切分 chunk、生成 embedding 并写入向量库。用户提问时，系统通过向量和关键词混合召回、重排和阈值过滤返回有引用来源的回答；合同审查模块会输出结构化风险，包括风险条款、等级、问题说明、修改建议、引用和是否建议人工复核。

## 3 分钟介绍

项目重点不是做完整 SaaS，而是证明 AI 应用工程化能力。后端采用 Express + TypeScript，抽象了 documents、parsers、datasets、chunks、embeddings、vector-store、rag、review 和 citations 模块。本地默认使用 mock embedding 和 memory vector store，保证没有 API key 和数据库时也能演示完整闭环；线上则使用 OpenAI-compatible 生成模型、Qwen3-Embedding-0.6B 和 Supabase pgvector，证明同一套 provider/vector store 边界可以平滑切换到真实持久化链路。

前端采用 Vue 3 + Vite，实现知识库导入、上传进度、智能问答、问答历史、来源高亮、合同审查和报告导出。回答和审查结果都带 citations，核心目标是降低法律场景中的幻觉风险，让关键结论能追溯到原文片段。

## RAG 完整流程

1. 文档导入：接收标题和文本、上传文件，或初始化公开安全数据集。
2. 文档判重：对清洗后的文本计算 SHA-256，重复导入直接返回已有文档。
3. 文本解析：TXT 直接读取，DOCX 使用 Mammoth 提取 raw text，PDF 使用 pdf-parse 提取文本。
4. 文本清洗：统一换行、空格和空段落。
5. Chunk 切分：优先按段落和条款切分，保留 source、page、section、chunkIndex、sourceUrl、docType 等元数据。
6. Embedding：通过 provider adapter 生成向量。
7. 向量入库：本地默认写入 memory vector store，线上写入 Supabase PostgreSQL + pgvector。
8. 查询增强：对“它/这个/上述”等短追问做轻量问题重写。
9. 混合召回：向量检索和关键词检索各召回 top 20，再合并候选。
10. Rerank：结合向量分、关键词分、section 命中、条款号和法律术语做轻量重排。
11. 答案生成：只基于 retrieved chunks 输出回答，资料不足时拒答。
12. 引用溯源：返回 citations，包含文档、条款、chunk index 和 quote。

## Chunk 切分策略

MVP 优先按空行分段，识别“第 X 条”作为 section。chunk size 约 850 个中文字符，长段落按固定窗口切分并保留 overlap。这样能兼顾语义完整性和检索粒度。

## 向量检索和关键词检索区别

关键词检索适合精确词匹配，例如“违约金”。向量检索能处理语义相近的问题，例如用户问“责任是否过重”，也能命中“支付合同总金额 100% 的违约金”。生产系统常用 hybrid search，把 BM25 和 vector search 结合，再加 rerank。

## 为什么需要引用溯源

法律场景不能只给结论。引用来源能让用户看到结论依据，方便人工复核，也能暴露“资料不足”的情况，降低模型编造风险。

## 为什么需要 Rerank

向量召回更关注语义相似，但 topK 中可能混入弱相关 chunk。Rerank 可以用更强模型或交叉编码器重新排序，提高最终上下文质量，减少无关片段污染答案。

当前项目借鉴了 RAG 全流程教程里的做法，在向量召回后先做相似度阈值过滤，再用轻量 rerank 对命中问题关键词、条款标题和法律术语的片段加权。生产环境可以替换为专门的 reranker 模型。

## 如何降低幻觉

- Prompt 要求只基于上下文回答。
- 当上下文不足时明确说明无法确认。
- 返回 citations，让结论可追溯。
- 对越界问题不返回 citations。
- 用评测集检查 citation 命中和拒答行为。
- 控制 topK 和上下文长度，避免噪声过多。
- 对合同审查使用结构化 schema 和人工复核标记。

## 如何做成本优化

- 文档入库时缓存 chunk embedding。
- 对重复文档做 hash 去重。
- 查询阶段先用低成本向量召回，再对少量候选 rerank。
- 对长文档做分层摘要和 section-level routing。
- 对审查结果缓存，合同未变更时不重复生成。

## 后续如何扩展为生产系统

- 将当前单用户登录升级为多用户、角色权限、项目空间授权和审计日志。
- 增加 OCR 和表格/版式解析。
- 使用 BullMQ 处理异步入库。
- 引入专门 rerank 模型，并记录 rerank 前后召回指标。
- 记录 prompt、模型版本、token 成本和评测趋势。

## 高频追问回答

**为什么 MVP 用 mock embedding？**
为了保证项目本地无 key 可运行，同时通过 provider adapter 保留替换真实模型的边界。线上 demo 已经切到真实 embedding 和 Supabase pgvector。

**如何证明回答不是编造的？**
每个 answer 都返回 citations，包含命中的 section、chunkIndex 和 quote。前端直接展示引用。

**为什么要做文档 hash 判重？**
RAG 入库成本主要来自解析、切分、embedding 和向量写入。hash 判重可以避免同一合同重复入库，也避免知识库里出现多份相同 chunk 影响检索质量。

**问题重写解决什么？**
多轮问答里用户常问“它有什么风险”“这个条款合理吗”。直接 embedding 这种短句很难命中正确条款，所以先把短追问补成带合同审查语义的检索问题。

**合同审查为什么用规则？**
MVP 阶段规则更稳定、可解释，适合演示结构化输出。生产环境可以把规则作为召回和校验层，再结合 LLM 做更细的审查说明。

**pgvector 如何接入？**
保留 `VectorStore` 的 upsert 和 similaritySearch 语义，新增 PgVectorStore，把 embedding 写入 vector 字段，用 cosine distance 查询 topK。

**为什么线上不用 Aiven？**
因为 Supabase 已经提供托管 PostgreSQL + pgvector，继续使用 Supabase 可以减少迁移成本、配置复杂度和演示故障点。Aiven 可以作为同类替代方案，但当前 demo 不需要同时维护两个数据库平台。

**为什么 Render 上用 Supabase Session Pooler？**
Supabase direct connection 可能解析到 IPv6 地址，而部分托管运行环境到 IPv6 不可达。Session Pooler 提供更兼容的连接入口；项目代码也对 Supabase/pooler SSL 做了兼容处理。

## 简历描述

法律智能机器人与合同审查 RAG 应用：基于 Vue 3、TypeScript、Express、Supabase PostgreSQL + pgvector 和 OpenAI-compatible 模型实现法律文档问答与合同风险审查；支持 Render 线上部署、单用户登录、公开安全数据集初始化、TXT/PDF/DOCX 上传、条款级 chunk、真实 embedding、混合召回、轻量 rerank、引用溯源、拒答评测和结构化风险报告；通过 provider adapter 和 vector store 抽象保留 mock 本地演示、pgvector 持久化和后续异步入库扩展能力。
