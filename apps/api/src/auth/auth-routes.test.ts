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
  } finally {
    server.close();
  }
});
