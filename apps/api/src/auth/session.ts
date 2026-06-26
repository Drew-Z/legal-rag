import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { AuthUser } from "@legal-rag/shared";
import type { AppConfig } from "../config/env.js";

type AuthConfig = NonNullable<AppConfig["auth"]>;

interface SessionPayload extends AuthUser {
  expiresAt: number;
}

export class AuthService {
  private readonly config: AuthConfig;

  constructor(config?: AppConfig["auth"]) {
    this.config =
      config ?? {
        enabled: false,
        email: "demo@legal-rag.local",
        name: "演示用户",
        cookieName: "legal_rag_session",
        secureCookie: false,
        sessionTtlHours: 8
      };
  }

  get enabled() {
    return this.config.enabled;
  }

  get publicUser(): AuthUser {
    return {
      email: this.config.email,
      name: this.config.name
    };
  }

  authenticate(email: string, password: string): AuthUser | undefined {
    if (!this.enabled || email !== this.config.email || !this.config.password) {
      return undefined;
    }

    return timingSafeTextEqual(password, this.config.password) ? this.publicUser : undefined;
  }

  getUserFromRequest(request: Request): AuthUser | undefined {
    if (!this.enabled) {
      return this.publicUser;
    }

    const token = parseCookies(request.headers.cookie ?? "")[this.config.cookieName];
    if (!token || !this.config.sessionSecret) {
      return undefined;
    }

    const [payloadPart, signature] = token.split(".");
    if (!payloadPart || !signature) {
      return undefined;
    }

    const expectedSignature = sign(payloadPart, this.config.sessionSecret);
    if (!timingSafeTextEqual(signature, expectedSignature)) {
      return undefined;
    }

    try {
      const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as SessionPayload;
      if (payload.email !== this.config.email || payload.expiresAt <= Date.now()) {
        return undefined;
      }

      return {
        email: payload.email,
        name: payload.name
      };
    } catch {
      return undefined;
    }
  }

  createCookie(user: AuthUser): string {
    if (!this.config.sessionSecret) {
      throw new Error("AUTH_SESSION_SECRET is required to create a session");
    }

    const maxAgeSeconds = Math.round(this.config.sessionTtlHours * 60 * 60);
    const payload: SessionPayload = {
      ...user,
      expiresAt: Date.now() + maxAgeSeconds * 1000
    };
    const payloadPart = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const token = `${payloadPart}.${sign(payloadPart, this.config.sessionSecret)}`;

    return serializeCookie(this.config.cookieName, token, {
      httpOnly: true,
      maxAgeSeconds,
      path: "/",
      sameSite: "Lax",
      secure: this.config.secureCookie
    });
  }

  clearCookie(): string {
    return serializeCookie(this.config.cookieName, "", {
      httpOnly: true,
      maxAgeSeconds: 0,
      path: "/",
      sameSite: "Lax",
      secure: this.config.secureCookie
    });
  }
}

export function requireAuth(auth: AuthService) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!auth.enabled || auth.getUserFromRequest(request)) {
      next();
      return;
    }

    response.status(401).json({ error: "authentication required" });
  };
}

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey || rawValue.length === 0) {
      continue;
    }
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
  }
  return cookies;
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly: boolean;
    maxAgeSeconds: number;
    path: string;
    sameSite: "Lax" | "Strict" | "None";
    secure: boolean;
  }
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${options.maxAgeSeconds}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`
  ];

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function timingSafeTextEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
