import { chromium } from "playwright";
import { existsSync } from "node:fs";

const baseUrl = process.env.WEB_E2E_BASE_URL ?? "http://127.0.0.1:5173";
const healthUrl = process.env.WEB_E2E_HEALTH_URL ?? new URL("/api/health", baseUrl).toString();
const apiBaseUrl = process.env.WEB_E2E_API_BASE_URL ?? deriveApiBaseUrl(healthUrl);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? findLocalChromium();
const projectId = process.env.WEB_E2E_PROJECT_ID ?? "project_default";
const qaQuestion =
  process.env.WEB_E2E_QA_QUESTION ?? "技术服务合同里，验收标准不明确会带来什么风险？";

const health = await fetch(healthUrl);
if (!health.ok) {
  throw new Error(`Health check failed: ${health.status}`);
}

const body = await health.json();
if (body.ok !== true) {
  throw new Error(`Health check returned unexpected body: ${JSON.stringify(body)}`);
}

await runApiQaSmoke();

const browser = await chromium.launch({
  headless: true,
  executablePath
});
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const loginForm = page.locator(".login-panel");
  if (await loginForm.isVisible().catch(() => false)) {
    const email = process.env.WEB_E2E_EMAIL;
    const password = process.env.WEB_E2E_PASSWORD;
    if (!email || !password) {
      throw new Error("WEB_E2E_EMAIL and WEB_E2E_PASSWORD are required when auth is enabled");
    }

    await page.locator('input[autocomplete="username"]').fill(email);
    await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.getByRole("button", { name: "登录" }).click();
    await page.locator(".login-panel").waitFor({ state: "detached" });
  }

  await page.getByRole("heading", { name: "法律智能机器人与合同审查 RAG 应用" }).waitFor();
  await page.getByText(/openai-compatible|mock/).first().waitFor();
  console.log(`E2E smoke passed for ${baseUrl}`);
} finally {
  await browser.close();
}

async function runApiQaSmoke() {
  const cookieJar = new Map();
  const apiFetch = async (path, options = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(cookieJar.size > 0 ? { Cookie: [...cookieJar.values()].join("; ") } : {}),
        ...options.headers
      }
    });
    storeCookies(response, cookieJar);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`${path} failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return payload;
  };

  const authStatus = await apiFetch("/api/auth/status");
  if (authStatus.enabled && !authStatus.authenticated) {
    const email = process.env.WEB_E2E_EMAIL;
    const password = process.env.WEB_E2E_PASSWORD;
    if (!email || !password) {
      throw new Error("WEB_E2E_EMAIL and WEB_E2E_PASSWORD are required when auth is enabled");
    }

    const loginStatus = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    if (!loginStatus.authenticated) {
      throw new Error("API login did not return authenticated=true");
    }
  }

  const seed = await apiFetch("/api/ingestion-jobs/seed", {
    method: "POST",
    body: JSON.stringify({ projectId })
  });
  const seedJob = await waitForJob(apiFetch, seed.job?.id, "public dataset seed");
  if (seedJob.status !== "succeeded") {
    throw new Error(`public dataset seed did not succeed: ${JSON.stringify(seedJob)}`);
  }

  const answer = await apiFetch("/api/rag/query", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      question: qaQuestion,
      topK: 5
    })
  });

  if (
    typeof answer.answer !== "string" ||
    answer.answer.trim().length === 0 ||
    !Array.isArray(answer.retrievedChunks) ||
    answer.retrievedChunks.length === 0 ||
    !Array.isArray(answer.citations) ||
    !answer.diagnostics
  ) {
    throw new Error(`RAG query returned invalid payload: ${JSON.stringify(answer)}`);
  }

  console.log(
    `API QA smoke passed for ${apiBaseUrl}: ${answer.citations.length} citations, ${answer.retrievedChunks.length} retrieved chunks`
  );
}

async function waitForJob(apiFetch, jobId, label) {
  if (!jobId) {
    throw new Error(`${label} did not return a job id`);
  }

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const { job } = await apiFetch(`/api/ingestion-jobs/${encodeURIComponent(jobId)}`);
    if (job?.status === "succeeded") {
      return job;
    }
    if (job?.status === "failed") {
      throw new Error(`${label} failed: ${job.error ?? "unknown error"}`);
    }
    await sleep(1000);
  }

  throw new Error(`${label} timed out after 90 seconds`);
}

function storeCookies(response, cookieJar) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);

  for (const value of values) {
    const pair = value.split(";")[0];
    const name = pair.split("=")[0];
    if (name) {
      cookieJar.set(name, pair);
    }
  }
}

function deriveApiBaseUrl(url) {
  const parsed = new URL(url);
  parsed.pathname = parsed.pathname.replace(/\/api\/health\/?$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findLocalChromium() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  ];

  return candidates.find((candidate) => existsSync(candidate));
}
