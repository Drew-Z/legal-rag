import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { AuthService, requireAuth } from "./session.js";

test("AuthService authenticates configured user and reads session cookie", () => {
  const auth = new AuthService({
    enabled: true,
    email: "demo@example.test",
    name: "Demo User",
    password: "correct-password",
    sessionSecret: "session-secret-for-tests",
    cookieName: "legal_rag_session",
    secureCookie: false,
    sessionTtlHours: 1
  });

  const user = auth.authenticate("demo@example.test", "correct-password");
  assert.deepEqual(user, {
    email: "demo@example.test",
    name: "Demo User"
  });

  const cookie = auth.createCookie(user);
  const request = {
    headers: {
      cookie
    }
  } as Request;

  assert.deepEqual(auth.getUserFromRequest(request), user);
});

test("AuthService rejects invalid credentials", () => {
  const auth = new AuthService({
    enabled: true,
    email: "demo@example.test",
    name: "Demo User",
    password: "correct-password",
    sessionSecret: "session-secret-for-tests",
    cookieName: "legal_rag_session",
    secureCookie: false,
    sessionTtlHours: 1
  });

  assert.equal(auth.authenticate("demo@example.test", "wrong-password"), undefined);
  assert.equal(auth.authenticate("other@example.test", "correct-password"), undefined);
});

test("requireAuth blocks protected routes when enabled without session", () => {
  const auth = new AuthService({
    enabled: true,
    email: "demo@example.test",
    name: "Demo User",
    password: "correct-password",
    sessionSecret: "session-secret-for-tests",
    cookieName: "legal_rag_session",
    secureCookie: false,
    sessionTtlHours: 1
  });
  const request = {
    headers: {}
  } as Request;
  const response = createMockResponse();
  let nextCalled = false;

  requireAuth(auth)(request, response as unknown as Response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: "authentication required" });
});

function createMockResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };
}
