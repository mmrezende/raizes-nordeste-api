import { Global, Module } from '@nestjs/common';
import { AUDIT_LOGGER } from '@application/ports/audit-logger.interface';
import { ID_GENERATOR } from '@application/ports/id-generator.interface';
import { PASSWORD_HASHER } from '@application/ports/password-hasher.interface';
import { PrismaAuditLogger } from '@infrastructure/audit/prisma-audit.logger';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { BcryptPasswordHasher } from '@infrastructure/security/bcrypt-password.hasher';
import { UuidV7Generator } from '@infrastructure/security/uuid-v7.generator';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: ID_GENERATOR,
      useClass: UuidV7Generator,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
    {
      provide: AUDIT_LOGGER,
      useClass: PrismaAuditLogger,
    },
  ],
  exports: [PrismaService, ID_GENERATOR, PASSWORD_HASHER, AUDIT_LOGGER],
})
export class InfrastructureModule {}
