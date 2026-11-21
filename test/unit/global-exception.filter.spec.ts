import { type ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import { GlobalExceptionFilter } from '@api/common/filters/global-exception.filter';
import { ConflictDomainError } from '@domain/errors/domain.error';

function createMockHost(requestId?: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });

  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        originalUrl: '/pedidos',
        url: '/pedidos',
        requestId,
      }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deve formatar DomainError com status, código e details', () => {
    const { host, status, json } = createMockHost('req-123');
    const error = new ConflictDomainError(
      'Estoque insuficiente.',
      [{ field: 'itens[0].quantidade', issue: 'Disponível: 1' }],
      'ESTOQUE_INSUFICIENTE',
    );

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: 'ESTOQUE_INSUFICIENTE',
      message: 'Estoque insuficiente.',
      details: [{ field: 'itens[0].quantidade', issue: 'Disponível: 1' }],
      timestamp: expect.any(String),
      path: '/pedidos',
      requestId: 'req-123',
    });
  });

  it('deve mapear HttpException do NestJS para o padrão de erro', () => {
    const { host, status, json } = createMockHost('req-456');

    filter.catch(new NotFoundException('Pedido não encontrado'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: 'RECURSO_NAO_ENCONTRADO',
      message: 'Pedido não encontrado',
      details: [],
      timestamp: expect.any(String),
      path: '/pedidos',
      requestId: 'req-456',
    });
  });

  it('deve retornar 500 para erro inesperado sem vazar detalhes internos', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = createMockHost('req-789');

    filter.catch(new Error('SQLITE_CONSTRAINT internal leak'), host);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: 'ERRO_INTERNO',
      message: 'Erro interno inesperado no servidor.',
      details: [],
      timestamp: expect.any(String),
      path: '/pedidos',
      requestId: 'req-789',
    });
  });
});
