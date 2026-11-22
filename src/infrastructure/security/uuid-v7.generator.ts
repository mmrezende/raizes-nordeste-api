import { Injectable } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import type { IdGenerator } from '@application/ports/id-generator.interface';

export function gerarUuidV7(): string {
  return uuidv7();
}

@Injectable()
export class UuidV7Generator implements IdGenerator {
  generate(): string {
    return gerarUuidV7();
  }
}
