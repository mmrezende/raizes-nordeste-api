export interface EnvConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  swaggerPath: string;
}

export function getEnvConfig(): EnvConfig {
  const parsedPort = Number(process.env.PORT ?? 3000);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
  const rawSwaggerPath = (process.env.SWAGGER_PATH ?? 'docs').trim().replace(/^\/+|\/+$/g, '');

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port,
    databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
    jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    swaggerPath: rawSwaggerPath || 'docs',
  };
}
