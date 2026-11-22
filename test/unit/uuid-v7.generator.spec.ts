import { UuidV7Generator } from '@infrastructure/security/uuid-v7.generator';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('UuidV7Generator', () => {
  const generator = new UuidV7Generator();

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deve gerar UUIDv7 válido conforme RFC 9562 e único por chamada', () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i += 1) {
      const id = generator.generate();
      expect(id).toMatch(UUID_V7_REGEX);
      ids.add(id);
    }

    expect(ids.size).toBe(100);
  });

  it('deve manter ordenação cronológica entre milissegundos distintos', () => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-02-15T14:00:00.000Z'));
    const anterior = generator.generate();

    jest.setSystemTime(new Date('2026-02-15T14:00:01.000Z'));
    const posterior = generator.generate();

    expect(anterior < posterior).toBe(true);
  });
});
