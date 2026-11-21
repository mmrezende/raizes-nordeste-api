export interface PaginacaoInput {
  page: number;
  limit: number;
}

export interface ResultadoPaginado<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function calcularOffset(paginacao: PaginacaoInput): number {
  return (paginacao.page - 1) * paginacao.limit;
}

export function montarResultadoPaginado<T>(
  data: T[],
  total: number,
  paginacao: PaginacaoInput,
): ResultadoPaginado<T> {
  const { page, limit } = paginacao;
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}
