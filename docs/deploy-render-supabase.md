# Render + Supabase 线上 Demo 部署

本文档用于把 Legal RAG 部署成可公开访问的线上演示：

- Web 前端：Render Static Site
- API：Render Web Service
- PostgreSQL + pgvector：继续使用现有 Supabase

如果 Supabase 的 PostgreSQL + pgvector 已经创建并验证通过，就不需要再额外使用 Aiven。Aiven 和 Supabase 在这里承担的是同一类职责：托管 PostgreSQL。当前项目只需要一个真实 pgvector 数据库，继续用 Supabase 会减少迁移成本和故障面。

## 1. Supabase 准备

在 Supabase SQL Editor 中确认 `vector` extension 已启用：

```sql
create extension if not exists vector with schema extensions;
```

连接串使用 Supabase 提供的 PostgreSQL connection string，并确保带上 SSL：

```text
postgresql://postgres:<password>@<host>:5432/postgres?sslmode=require
```

线上真实 embedding 使用：

```text
EMBEDDING_MODEL=Qwen3-Embedding-0.6B
EMBEDDING_DIM=1024
```

不要把本地 mock provider 产生的 96 维数据写入同一套 Supabase 表。切换 embedding 维度时，使用新的数据库或清空旧 chunks 后重新入库。

## 2. Render API Web Service

在 Render 创建 Web Service：

- Runtime: Docker
- Dockerfile Path: `apps/api/Dockerfile`
- Health Check Path: `/api/health`

环境变量：

```text
WEB_ORIGIN=https://<你的-web>.onrender.com
MODEL_PROVIDER=openai-compatible
VECTOR_STORE=pgvector
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres?sslmode=require

LLM_BASE_URL=https://<你的生成模型网关>/v1
LLM_API_KEY=<你的生成模型密钥>
LLM_MODEL=gemini-3.5-flash-thinking

EMBEDDING_BASE_URL=https://<你的embedding网关>/v1
EMBEDDING_API_KEY=<你的embedding模型密钥>
EMBEDDING_MODEL=Qwen3-Embedding-0.6B
EMBEDDING_DIM=1024

AUTH_ENABLED=true
AUTH_EMAIL=<你的登录邮箱>
AUTH_NAME=Demo Owner
AUTH_PASSWORD=<强密码>
AUTH_SESSION_SECRET=<至少32位随机字符串>
AUTH_SESSION_TTL_HOURS=8
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=None
```

`AUTH_COOKIE_SAME_SITE=None` 和 `AUTH_COOKIE_SECURE=true` 是 Render 双子域名登录的关键配置。Render Static Site 和 API Web Service 通常是不同子域名，浏览器跨站携带 cookie 时需要这个组合。

## 3. Render Static Site

在 Render 创建 Static Site：

- Build Command:

```powershell
npm ci && npm run build:shared && npm --workspace apps/web run build
```

- Publish Directory:

```text
apps/web/dist
```

环境变量：

```text
VITE_API_BASE_URL=https://<你的-api>.onrender.com
```

本地开发可以保持 `VITE_API_BASE_URL` 为空，继续通过 Vite proxy 访问本地 API。

## 4. 部署后检查

先检查 API：

```text
https://<你的-api>.onrender.com/api/health
https://<你的-api>.onrender.com/api/auth/status
```

再打开 Web：

```text
https://<你的-web>.onrender.com
```

演示链路：

1. 使用 `AUTH_EMAIL` 和 `AUTH_PASSWORD` 登录。
2. 创建或选择项目空间。
3. 点击初始化公开数据集。
4. 在智能问答页提问，确认返回 citations。
5. 在合同审查页提交合同，确认返回风险列表。
6. 打开质量面板，确认 pgvector、评测和 readiness checks 状态。

## 5. 常见问题

登录后又回到登录页：

- 确认 API 设置 `AUTH_COOKIE_SECURE=true`。
- 确认 API 设置 `AUTH_COOKIE_SAME_SITE=None`。
- 确认 API 的 `WEB_ORIGIN` 精确等于 Web 地址，不要多斜杠。
- 确认 Web 的 `VITE_API_BASE_URL` 精确等于 API 地址。

CORS 报错：

- `WEB_ORIGIN` 只填一个精确来源，例如 `https://legal-rag-web.onrender.com`。
- 修改后重启 Render API 服务。

pgvector 维度不匹配：

- 确认 `EMBEDDING_DIM=1024`。
- 确认 Supabase 表中没有 mock provider 写入的 96 维旧数据。
- 如已经混入旧数据，清空文档/chunks 后重新初始化数据集。

首次访问较慢：

- Render 免费实例可能冷启动，第一次请求 API 需要等待一段时间。

## 6. 本地验证命令

提交前运行：

```powershell
npm.cmd run typecheck
npm.cmd --workspace apps/api run test:unit
npm.cmd --workspace apps/api run validate
npm.cmd --workspace apps/api run evaluate
npm.cmd --workspace apps/api run evaluate:review
npm.cmd run build
docker compose -f docker-compose.prod.yml config
npm.cmd --workspace apps/api run validate:pgvector
```

`validate:pgvector` 会读取本地 `.env` 中的 Supabase `DATABASE_URL` 和真实 embedding 配置，请确认 `.env` 不提交到仓库。

