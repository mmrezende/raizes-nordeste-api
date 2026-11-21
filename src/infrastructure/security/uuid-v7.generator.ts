import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { IdGenerator } from '@application/ports/id-generator.interface';

@Injectable()
export class UuidV7Generator implements IdGenerator {
  generate(): string {
    const bytes = Buffer.alloc(16);
    bytes.writeUIntBE(Date.now(), 0, 6);
    randomBytes(10).copy(bytes, 6);

    // RFC 9562: versão 7 (0111) e variante RFC (10)
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
}
