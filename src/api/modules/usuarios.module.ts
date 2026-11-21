import { Module } from '@nestjs/common';
import { UsuariosController } from '@api/controllers/usuarios/usuarios.controller';
import { UsuariosService } from '@application/use-cases/usuarios/usuarios.service';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
