import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_JWT_EXPIRES_IN_SECONDS = 3600;
let cachedAppVersion: string | null = null;

export function getAppVersion(): string {
  if (cachedAppVersion !== null) {
    return cachedAppVersion;
  }

  const fromEnv = process.env.npm_package_version;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    cachedAppVersion = fromEnv.trim();
    return cachedAppVersion;
  }

  try {
    const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: unknown };
    if (typeof parsed.version === 'string' && parsed.version.trim().length > 0) {
      cachedAppVersion = parsed.version.trim();
      return cachedAppVersion;
    }
  } catch {
    // Fallback caso package.json não esteja acessível no cwd
  }

  cachedAppVersion = '0.0.0';
  return cachedAppVersion;
}

export interface EnvConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  swaggerPath: string;
}

export function getEnvConfig(): EnvConfig {
  const parsedPort = Number(process.env.PORT ?? 3000);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

  const parsedJwtExpiresInSeconds = Number(
    process.env.JWT_EXPIRES_IN_SECONDS ?? DEFAULT_JWT_EXPIRES_IN_SECONDS,
  );
  const jwtExpiresInSeconds =
    Number.isInteger(parsedJwtExpiresInSeconds) && parsedJwtExpiresInSeconds > 0
      ? parsedJwtExpiresInSeconds
      : DEFAULT_JWT_EXPIRES_IN_SECONDS;

  const rawSwaggerPath = (process.env.SWAGGER_PATH ?? 'docs').trim().replace(/^\/+|\/+$/g, '');

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port,
    databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
    jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    jwtExpiresInSeconds,
    swaggerPath: rawSwaggerPath || 'docs',
  };
}
