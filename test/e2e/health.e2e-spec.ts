import request from 'supertest';
import { getAppVersion } from '@infrastructure/config/env.config';
import { createTestApp, type TestAppContext } from './helpers/test-app.helper';

describe('Health, Swagger e Contrato de Erro (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /health deve retornar status ok, banco up e header x-request-id', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/health').expect(200);

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body).toEqual({
      status: 'ok',
      database: 'up',
      timestamp: expect.any(String),
      version: getAppVersion(),
    });
  });

  it('GET /docs-json deve expor especificação OpenAPI com /health', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/docs-json').expect(200);
    const body = res.body as { openapi?: string; paths?: Record<string, unknown> };

    expect(body.openapi).toBeDefined();
    expect(body.paths).toHaveProperty('/health');
  });

  it('GET /rota-inexistente deve retornar 404 no formato padrão de erro', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/rota-inexistente').expect(404);

    expect(res.body).toEqual({
      error: 'RECURSO_NAO_ENCONTRADO',
      message: expect.any(String),
      details: [],
      timestamp: expect.any(String),
      path: '/rota-inexistente',
      requestId: expect.any(String),
    });
  });
});
