import { Global, Module } from '@nestjs/common';
import { ID_GENERATOR } from '../../../application/ports/id-generator.interface';
import { UuidV7Generator } from '../../security/uuid-v7.generator';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: ID_GENERATOR,
      useClass: UuidV7Generator,
    },
  ],
  exports: [PrismaService, ID_GENERATOR],
})
export class PrismaModule {}
