import { Module } from '@nestjs/common';
import { UsuariosService } from '../../application/use-cases/usuarios/usuarios.service';
import { UsuariosController } from '../controllers/usuarios/usuarios.controller';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
