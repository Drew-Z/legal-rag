# Render Supabase Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Legal RAG as a polished online demo with Render hosting for Web/API and the existing Supabase PostgreSQL + pgvector database.

**Architecture:** Keep Supabase as the only managed Postgres/pgvector service and avoid adding Aiven. Render serves the Vue static app and runs the Express API Docker image; the browser calls the API through `VITE_API_BASE_URL`, while the API accepts credentials from the exact `WEB_ORIGIN`.

**Tech Stack:** Vue 3, Vite, Express, Docker, Render Static Site, Render Web Service, Supabase PostgreSQL, pgvector, OpenAI-compatible chat and embedding providers.

---

## File Structure

- Modify `apps/web/src/api/client.ts`: add hosted API base URL support without changing local `/api` behavior.
- Modify `apps/api/src/config/env.ts`: parse hosted cookie SameSite configuration.
- Modify `apps/api/src/auth/session.ts`: issue cookies using configured SameSite mode.
- Modify `apps/api/src/config/env.test.ts`: cover valid and invalid `AUTH_COOKIE_SAME_SITE`.
- Modify `apps/api/src/auth/session.test.ts`: cover `SameSite=None; Secure` cookies.
- Modify `apps/api/.env.example`: document API auth cookie settings.
- Modify `.env.docker.example`: keep Docker defaults local-safe.
- Create `apps/web/.env.example`: document `VITE_API_BASE_URL`.
- Create `docs/deploy-render-supabase.md`: deployment runbook.
- Modify `README.md`: link the Render + Supabase guide and mention web env configuration.

### Task 1: Hosted Web API Base URL

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Create: `apps/web/.env.example`

- [ ] **Step 1: Add Vite API base URL helper**

Add:

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

function apiPath(path: string): string {
  return `${API_BASE_URL}${path}`;
}
```

- [ ] **Step 2: Use cross-origin credentials only when hosted**

Change `fetch(path, ...)` to `fetch(apiPath(path), ...)` and set:

```ts
credentials: API_BASE_URL ? "include" : "same-origin"
```

- [ ] **Step 3: Route uploads through the same helper**

Change:

```ts
xhr.open("POST", apiPath(path));
xhr.withCredentials = true;
```

- [ ] **Step 4: Document Web environment**

Create `apps/web/.env.example` with:

```text
VITE_API_BASE_URL=
```

### Task 2: Hosted Login Cookie Configuration

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/auth/session.ts`
- Modify: `apps/api/src/config/env.test.ts`
- Modify: `apps/api/src/auth/session.test.ts`

- [ ] **Step 1: Add config type**

Add:

```ts
cookieSameSite: "Lax" | "Strict" | "None";
```

- [ ] **Step 2: Parse `AUTH_COOKIE_SAME_SITE`**

Default to `Lax`; accept only `Lax`, `Strict`, or `None`; throw:

```text
AUTH_COOKIE_SAME_SITE must be one of Lax, Strict, or None
```

- [ ] **Step 3: Use configured SameSite in session cookies**

Use `this.config.cookieSameSite` for both `createCookie()` and `clearCookie()`.

- [ ] **Step 4: Add unit coverage**

Assert that `AUTH_COOKIE_SAME_SITE=None` is parsed, invalid values throw, and hosted cookies include `SameSite=None` and `Secure`.

### Task 3: Render + Supabase Deployment Runbook

**Files:**
- Create: `docs/deploy-render-supabase.md`
- Modify: `README.md`

- [ ] **Step 1: State the database decision**

Document that Supabase already provides PostgreSQL + pgvector, so Aiven is unnecessary for the current online demo.

- [ ] **Step 2: Document Supabase requirements**

Include `create extension if not exists vector with schema extensions;`, `sslmode=require`, `VECTOR_STORE=pgvector`, and `EMBEDDING_DIM=1024`.

- [ ] **Step 3: Document Render API settings**

Use `apps/api/Dockerfile`, set `WEB_ORIGIN`, model env vars, Supabase `DATABASE_URL`, and login env vars including:

```text
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=None
```

- [ ] **Step 4: Document Render Web settings**

Use build command:

```powershell
npm ci && npm run build:shared && npm --workspace apps/web run build
```

Publish:

```text
apps/web/dist
```

Set:

```text
VITE_API_BASE_URL=https://<你的-api>.onrender.com
```

### Task 4: Verification And Commit

**Files:**
- Inspect: all modified files
- Commit: all verified changes

- [ ] **Step 1: Run typecheck and unit tests**

```powershell
npm.cmd run typecheck
npm.cmd --workspace apps/api run test:unit
```

- [ ] **Step 2: Run app validation and evaluations**

```powershell
npm.cmd --workspace apps/api run validate
npm.cmd --workspace apps/api run evaluate
npm.cmd --workspace apps/api run evaluate:review
npm.cmd run build
```

- [ ] **Step 3: Run deployment config checks**

```powershell
docker compose -f docker-compose.prod.yml config
npm.cmd --workspace apps/api run validate:pgvector
```

- [ ] **Step 4: Check for formatting and accidental secrets**

```powershell
git diff --check
rg -n "API_KEY|DATABASE_URL|Bearer|password|secret|sk-|AIza|eyJ|AUTH_PASSWORD|AUTH_SESSION_SECRET|LLM_API_KEY|EMBEDDING_API_KEY" .github apps packages README.md docs eval docker-compose.prod.yml .env.docker.example -S
```

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "Add Render Supabase deployment guide"
```

