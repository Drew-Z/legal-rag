import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createApp } from "../app.js";

test("auth routes protect API routes when auth is enabled", async () => {
  const app = await createApp({
    port: 0,
    webOrigin: "http://127.0.0.1:5173",
    modelProvider: "mock",
    vectorStore: "memory",
    auth: {
      enabled: true,
      email: "demo@example.test",
      name: "Demo User",
      password: "correct-password",
      sessionSecret: "session-secret-for-tests",
      cookieName: "legal_rag_session",
      secureCookie: false,
      cookieSameSite: "Lax",
      sessionTtlHours: 1
    },
    embedding: {
      model: "mock",
      dimensions: 96
    }
  });
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const blocked = await fetch(`${baseUrl}/api/projects`);
    assert.equal(blocked.status, 401);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: "demo@example.test",
        password: "correct-password"
      })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie");
    if (!cookie) {
      throw new Error("expected login response to set a session cookie");
    }
    assert.ok(cookie.includes("legal_rag_session="));

    const projects = await fetch(`${baseUrl}/api/projects`, {
      headers: {
        Cookie: cookie
      }
    });
    assert.equal(projects.status, 200);
    assert.deepEqual(await projects.json(), {
      projects: [
        {
          id: "project_default",
          name: "默认项目",
          description: "演示与本地导入文档",
          createdAt: "2026-06-26T00:00:00.000Z",
          isDefault: true
        }
      ]
    });

    const createProject = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie
      },
      body: JSON.stringify({
        name: "审计项目"
      })
    });
    assert.equal(createProject.status, 201);
    const created = (await createProject.json()) as { project: { id: string } };

    const auditLogs = await fetch(`${baseUrl}/api/audit-logs?projectId=${created.project.id}`, {
      headers: {
        Cookie: cookie
      }
    });
    assert.equal(auditLogs.status, 200);
    const auditBody = (await auditLogs.json()) as {
      logs: Array<{ action: string; projectId: string; userEmail: string; summary: string }>;
    };
    assert.equal(auditBody.logs.length, 1);
    assert.equal(auditBody.logs[0]?.action, "project.create");
    assert.equal(auditBody.logs[0]?.projectId, created.project.id);
    assert.equal(auditBody.logs[0]?.userEmail, "demo@example.test");
    assert.match(auditBody.logs[0]?.summary ?? "", /创建项目空间/);

    const createJob = await fetch(`${baseUrl}/api/ingestion-jobs/import-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie
      },
      body: JSON.stringify({
        projectId: created.project.id,
        title: "异步入库合同",
        text: "第一条 交付标准以双方沟通为准。第二条 项目完成后一次性支付。"
      })
    });
    assert.equal(createJob.status, 202);
    const createdJob = (await createJob.json()) as { job: { id: string; status: string } };
    assert.equal(createdJob.job.status, "queued");

    const completedJob = await waitForJob(baseUrl, cookie, createdJob.job.id);
    assert.equal(completedJob.status, "succeeded");
    assert.equal(completedJob.result?.document?.title, "异步入库合同");
    assert.ok(completedJob.result?.chunkCount);

    const jobs = await fetch(`${baseUrl}/api/ingestion-jobs?projectId=${created.project.id}`, {
      headers: {
        Cookie: cookie
      }
    });
    assert.equal(jobs.status, 200);
    const jobsBody = (await jobs.json()) as { jobs: Array<{ id: string }> };
    assert.equal(jobsBody.jobs[0]?.id, createdJob.job.id);
  } finally {
    server.close();
  }
});

async function waitForJob(baseUrl: string, cookie: string, jobId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/ingestion-jobs/${jobId}`, {
      headers: {
        Cookie: cookie
      }
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      job: {
        status: string;
        result?: {
          chunkCount?: number;
          document?: {
            title: string;
          };
        };
      };
    };
    if (body.job.status === "succeeded" || body.job.status === "failed") {
      return body.job;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("expected ingestion job to finish");
}
