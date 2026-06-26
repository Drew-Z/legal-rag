import pg from "pg";

export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export function createPool(databaseUrl: string): pg.Pool {
  const sslMode = getSslMode(databaseUrl);

  return new pg.Pool({
    connectionString: stripSslMode(databaseUrl),
    ssl: shouldUseSsl(databaseUrl, sslMode) ? { rejectUnauthorized: false } : undefined
  });
}

function getSslMode(databaseUrl: string): string | undefined {
  try {
    return new URL(databaseUrl).searchParams.get("sslmode") ?? undefined;
  } catch {
    return undefined;
  }
}

function stripSslMode(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

function shouldUseSsl(databaseUrl: string, sslMode: string | undefined): boolean {
  if (sslMode === "require" || sslMode === "no-verify") {
    return true;
  }

  try {
    const hostname = new URL(databaseUrl).hostname;
    return hostname.endsWith(".supabase.com");
  } catch {
    return false;
  }
}
