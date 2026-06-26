import { chromium } from "playwright";
import { existsSync } from "node:fs";

const baseUrl = process.env.WEB_E2E_BASE_URL ?? "http://127.0.0.1:5173";
const healthUrl = process.env.WEB_E2E_HEALTH_URL ?? new URL("/api/health", baseUrl).toString();
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? findLocalChromium();

const health = await fetch(healthUrl);
if (!health.ok) {
  throw new Error(`Health check failed: ${health.status}`);
}

const body = await health.json();
if (body.ok !== true) {
  throw new Error(`Health check returned unexpected body: ${JSON.stringify(body)}`);
}

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

function findLocalChromium() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  ];

  return candidates.find((candidate) => existsSync(candidate));
}
