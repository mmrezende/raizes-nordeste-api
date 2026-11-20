import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestAppContext } from './helpers/test-app.helper';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Auth, Usuários e RBAC (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('POST /auth/register', () => {
    it('deve cadastrar cliente com perfil CLIENTE, UUIDv7, consentimento LGPD e sem expor senhaHash', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: 'Maria Silva',
          email: 'maria@exemplo.com',
          senha: 'Senha@123',
          consentimentoFidelidade: true,
        })
        .expect(201);

      expect(res.body.id).toMatch(UUID_V7_REGEX);
      expect(res.body).toMatchObject({
        nome: 'Maria Silva',
        email: 'maria@exemplo.com',
        perfil: 'CLIENTE',
        unidadeId: null,
      });
      expect(res.body.senhaHash).toBeUndefined();

      const contaFidelidade = await ctx.prisma.contaFidelidade.findUnique({
        where: { usuarioId: res.body.id as string },
      });
      expect(contaFidelidade).not.toBeNull();
      expect(contaFidelidade?.consentimentoAtivo).toBe(true);
      expect(contaFidelidade?.consentimentoEm).not.toBeNull();
    });

    it('deve retornar 422 quando e-mail ou senha forem inválidos', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: '',
          email: 'email-invalido',
          senha: '123',
        })
        .expect(422);

      expect(res.body).toMatchObject({
        error: 'ERRO_VALIDACAO',
        path: '/auth/register',
      });
      expect(Array.isArray(res.body.details)).toBe(true);
      expect((res.body.details as unknown[]).length).toBeGreaterThan(0);
    });

    it('deve retornar 409 ao tentar cadastrar e-mail duplicado', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: 'Maria Silva',
          email: 'maria@exemplo.com',
          senha: 'Senha@123',
          consentimentoFidelidade: false,
        })
        .expect(201);

      const res = await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: 'Outra Maria',
          email: 'maria@exemplo.com',
          senha: 'Senha@456',
          consentimentoFidelidade: false,
        })
        .expect(409);

      expect(res.body.error).toBe('EMAIL_JA_CADASTRADO');
    });
  });

  describe('POST /auth/login', () => {
    it('deve autenticar usuário válido e retornar token JWT', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: 'João Recife',
          email: 'joao@exemplo.com',
          senha: 'Senha@123',
          consentimentoFidelidade: true,
        })
        .expect(201);

      const res = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'joao@exemplo.com',
          senha: 'Senha@123',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: expect.any(Number),
        user: {
          nome: 'João Recife',
          email: 'joao@exemplo.com',
          perfil: 'CLIENTE',
          unidadeId: null,
        },
      });
      expect(res.body.expiresIn).toBeGreaterThan(0);
      expect(res.body.user.senhaHash).toBeUndefined();
    });

    it('deve retornar 401 para credenciais inválidas', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'naoexiste@exemplo.com',
          senha: 'Senha@123',
        })
        .expect(401);

      expect(res.body.error).toBe('CREDENCIAIS_INVALIDAS');
    });
  });

  describe('GET /usuarios/me', () => {
    it('deve retornar 401 sem token JWT', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/usuarios/me').expect(401);

      expect(res.body.error).toBe('NAO_AUTENTICADO');
    });

    it('deve retornar dados do usuário autenticado sem senhaHash', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: 'Ana Olinda',
          email: 'ana@exemplo.com',
          senha: 'Senha@123',
          consentimentoFidelidade: true,
        })
        .expect(201);

      const loginRes = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ana@exemplo.com', senha: 'Senha@123' })
        .expect(200);

      const meRes = await request(ctx.app.getHttpServer())
        .get('/usuarios/me')
        .set('Authorization', `Bearer ${loginRes.body.accessToken as string}`)
        .expect(200);

      expect(meRes.body).toMatchObject({
        nome: 'Ana Olinda',
        email: 'ana@exemplo.com',
        perfil: 'CLIENTE',
        unidadeId: null,
      });
      expect(meRes.body.senhaHash).toBeUndefined();
    });
  });

  describe('POST /usuarios (RBAC)', () => {
    it('deve retornar 403 quando CLIENTE tentar cadastrar funcionário', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({
          nome: 'Cliente Comum',
          email: 'cliente@exemplo.com',
          senha: 'Senha@123',
          consentimentoFidelidade: false,
        })
        .expect(201);

      const loginRes = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'cliente@exemplo.com', senha: 'Senha@123' })
        .expect(200);

      const res = await request(ctx.app.getHttpServer())
        .post('/usuarios')
        .set('Authorization', `Bearer ${loginRes.body.accessToken as string}`)
        .send({
          nome: 'Funcionário Teste',
          email: 'func@exemplo.com',
          senha: 'Senha@123',
          perfil: 'ATENDENTE',
        })
        .expect(403);

      expect(res.body.error).toBe('ACESSO_NEGADO');
    });

    it('deve permitir ADMIN cadastrar ATENDENTE vinculado a uma unidade existente', async () => {
      const unidade = await ctx.prisma.unidade.create({
        data: {
          codigo: 'REC-01',
          nome: 'Raízes Boa Viagem',
          endereco: 'Av. Boa Viagem, 1000',
        },
      });

      const senhaHash = await bcrypt.hash('Admin@123', 10);
      await ctx.prisma.usuario.create({
        data: {
          nome: 'Admin Rede',
          email: 'admin@raizes.com',
          senhaHash,
          perfil: 'ADMIN',
        },
      });

      const adminLogin = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@raizes.com', senha: 'Admin@123' })
        .expect(200);

      const res = await request(ctx.app.getHttpServer())
        .post('/usuarios')
        .set('Authorization', `Bearer ${adminLogin.body.accessToken as string}`)
        .send({
          nome: 'Carlos Balcão',
          email: 'carlos@raizes.com',
          senha: 'Senha@123',
          perfil: 'ATENDENTE',
          unidadeId: unidade.id,
        })
        .expect(201);

      expect(res.body.id).toMatch(UUID_V7_REGEX);
      expect(res.body).toMatchObject({
        nome: 'Carlos Balcão',
        email: 'carlos@raizes.com',
        perfil: 'ATENDENTE',
        unidadeId: unidade.id,
      });
      expect(res.body.senhaHash).toBeUndefined();
    });

    it('deve retornar 422 quando ADMIN tentar cadastrar funcionário de loja sem unidadeId', async () => {
      const senhaHash = await bcrypt.hash('Admin@123', 10);
      await ctx.prisma.usuario.create({
        data: {
          nome: 'Admin Rede',
          email: 'admin@raizes.com',
          senhaHash,
          perfil: 'ADMIN',
        },
      });

      const adminLogin = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@raizes.com', senha: 'Admin@123' })
        .expect(200);

      const res = await request(ctx.app.getHttpServer())
        .post('/usuarios')
        .set('Authorization', `Bearer ${adminLogin.body.accessToken as string}`)
        .send({
          nome: 'Cozinha Sem Loja',
          email: 'cozinha@raizes.com',
          senha: 'Senha@123',
          perfil: 'COZINHA',
        })
        .expect(422);

      expect(res.body.error).toBe('ERRO_VALIDACAO');
    });
  });
});
