const DEFAULT_JWT_EXPIRES_IN_MS = 3_600_000;

function parseDurationToMs(raw: string): number {
  const normalized = raw.trim().toLowerCase();
  const match = /^(\d+)(ms|s|m|h|d)?$/.exec(normalized);
  if (!match) {
    return DEFAULT_JWT_EXPIRES_IN_MS;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return DEFAULT_JWT_EXPIRES_IN_MS;
  }

  switch (match[2]) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1_000;
    case 'm':
      return amount * 60_000;
    case 'h':
      return amount * 3_600_000;
    case 'd':
      return amount * 86_400_000;
    default:
      return amount;
  }
}

export interface EnvConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtExpiresInMs: number;
  swaggerPath: string;
}

export function getEnvConfig(): EnvConfig {
  const parsedPort = Number(process.env.PORT ?? 3000);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
  const rawSwaggerPath = (process.env.SWAGGER_PATH ?? 'docs').trim().replace(/^\/+|\/+$/g, '');
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '1h';

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port,
    databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
    jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    jwtExpiresIn,
    jwtExpiresInMs: parseDurationToMs(jwtExpiresIn),
    swaggerPath: rawSwaggerPath || 'docs',
  };
}
