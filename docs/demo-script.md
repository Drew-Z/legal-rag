# Online Demo Script

这份脚本用于面试、作品集讲解或录屏演示。不要在公开材料中展示登录密码、模型 key、数据库连接串或 Render/Supabase 后台环境变量。

## 演示前检查

1. 打开 API health：

```text
https://legal-rag-api-9bki.onrender.com/api/health
```

预期返回：

```json
{
  "ok": true,
  "modelProvider": "openai-compatible",
  "vectorStore": "pgvector",
  "embeddingModel": "Qwen3-Embedding-0.6B"
}
```

2. 打开 Web：

```text
https://legal-rag-web.onrender.com
```

3. 如果 Render 免费实例冷启动，先等待 API health 返回成功，再开始演示。

也可以用前端 smoke 脚本检查线上登录和 health。账号密码通过环境变量提供，不要写入仓库：

```powershell
$env:WEB_E2E_BASE_URL="https://legal-rag-web.onrender.com"
$env:WEB_E2E_HEALTH_URL="https://legal-rag-api-9bki.onrender.com/api/health"
$env:WEB_E2E_EMAIL="<demo-email>"
$env:WEB_E2E_PASSWORD="<demo-password>"
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE="C:/Program Files/Google/Chrome/Application/chrome.exe"
npm.cmd --workspace apps/web run test:e2e:smoke
```

## 90 秒演示

1. 登录工作台。
2. 进入知识库页，说明项目支持项目空间、文档上传、公开安全数据集初始化和文档判重。
3. 点击初始化公开数据集，说明数据会写入 Supabase pgvector，而不是只存在浏览器或内存里。
4. 切到智能问答，提问：

```text
技术服务合同里，验收标准不明确会带来什么风险？
```

5. 展示回答、引用片段和 diagnostics，强调回答不是裸模型生成，而是基于 retrieved chunks。
6. 切到合同审查，使用示例合同或粘贴合同文本，展示风险条款、风险等级、修改建议和引用。
7. 打开质量面板，展示当前模型、向量库、知识库规模、RAG 评测和合同审查评测。

## 3 分钟讲解

可以按这条主线讲：

```text
这个项目不是简单套一个聊天接口，而是完整实现了 RAG 工程闭环：文档入库、清洗、chunk、embedding、pgvector 持久化、hybrid recall、阈值过滤、rerank、引用溯源、资料不足拒答和评测报告。
```

然后补充三个工程点：

- 本地默认 mock provider，保证无 key 可运行；线上切换到真实模型和 Supabase pgvector。
- 所有回答都带 citations，法律场景需要可追溯依据，而不是只给结论。
- CI 和本地脚本覆盖 typecheck、unit test、validate、RAG eval、contract review eval、build 和 Docker Compose config。

## 常见追问

**为什么需要 pgvector？**

文档、chunk 和 embedding 需要持久化，才能在重新部署后保留知识库。pgvector 让 PostgreSQL 同时承担业务数据和向量检索，适合中小规模 RAG 项目的第一版生产架构。

**为什么不是直接把全文塞给模型？**

全文塞给模型成本高、上下文有限，而且不可控。RAG 会先检索相关 chunk，再让模型只基于这些片段回答，并返回 citations。

**如何控制幻觉？**

系统做了相似度阈值过滤、资料不足拒答、引用溯源和评测集。合同审查结果也带 `requiresHumanReview`，避免把 AI 输出包装成最终法律意见。

**线上为什么使用 Supabase Session Pooler？**

Supabase direct connection 可能走 IPv6，在部分托管环境不可达。Session Pooler 更适合这类外部部署；API 连接层也处理了 Supabase pooler 的 SSL 兼容问题。

**下一步会怎么扩展？**

优先做多用户权限、异步入库队列、OCR/表格解析、专门 rerank 模型、评测趋势页和审计日志。

## 演示故障处理

API health 慢：

- Render 免费实例可能冷启动，等待 30-60 秒。

登录失败：

- 检查 API 环境变量 `AUTH_ENABLED`、`AUTH_EMAIL`、`AUTH_PASSWORD`。
- 检查 `WEB_ORIGIN` 是否等于前端地址。
- 检查 `AUTH_COOKIE_SECURE=true` 和 `AUTH_COOKIE_SAME_SITE=None`。

问答失败：

- 先看 `/api/health` 是否返回 `vectorStore=pgvector`。
- 再看 Render API logs 是否有模型 key、embedding 维度或 Supabase 连接错误。
