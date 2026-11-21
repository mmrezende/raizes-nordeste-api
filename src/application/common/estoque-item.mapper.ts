import { centavosParaReais } from '@domain/utils/money.util';

export interface EstoqueComProduto {
  quantidadeDisponivel: number;
  disponivelVenda: boolean;
  produto: {
    id: string;
    nome: string;
    categoria: string;
    precoCentavos: number;
  };
}

export interface EstoqueItemBase {
  produtoId: string;
  nome: string;
  categoria: string;
  precoCentavos: number;
  preco: number;
  quantidadeDisponivel: number;
  disponivelVenda: boolean;
}

export function mapearItemEstoque(item: EstoqueComProduto): EstoqueItemBase {
  return {
    produtoId: item.produto.id,
    nome: item.produto.nome,
    categoria: item.produto.categoria,
    precoCentavos: item.produto.precoCentavos,
    preco: centavosParaReais(item.produto.precoCentavos),
    quantidadeDisponivel: item.quantidadeDisponivel,
    disponivelVenda: item.disponivelVenda,
  };
}
