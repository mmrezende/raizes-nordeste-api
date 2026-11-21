import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Auditable } from '@api/common/decorators/auditable.decorator';
import { Public } from '@api/common/decorators/public.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import { ErrorResponseDto } from '@api/common/dtos/error-response.dto';
import { PromocoesService } from '@application/use-cases/promocoes/promocoes.service';
import { PerfilUsuario } from '@domain/enums/perfil-usuario.enum';
import { CriarPromocaoDto } from './dto/criar-promocao.dto';
import { ListarPromocoesQueryDto } from './dto/listar-promocoes-query.dto';
import { PromocaoResponseDto, PromocoesPaginadasResponseDto } from './dto/promocao-response.dto';

@ApiTags('Promoções')
@Controller('promocoes')
export class PromocoesController {
  constructor(private readonly promocoesService: PromocoesService) {}

  @Post()
  @ApiBearerAuth()
  @Roles([PerfilUsuario.ADMIN])
  @Auditable({ acao: 'PROMOCAO_CRIADA', entidade: 'promocoes' })
  @ApiOperation({ summary: 'Cadastra nova campanha ou cupom promocional (ADMIN)' })
  @ApiCreatedResponse({ type: PromocaoResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async criar(@Body() dto: CriarPromocaoDto): Promise<PromocaoResponseDto> {
    return this.promocoesService.criar(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lista promoções paginadas com filtros opcionais' })
  @ApiOkResponse({ type: PromocoesPaginadasResponseDto })
  async listar(@Query() query: ListarPromocoesQueryDto): Promise<PromocoesPaginadasResponseDto> {
    return this.promocoesService.listar(query);
  }
}
