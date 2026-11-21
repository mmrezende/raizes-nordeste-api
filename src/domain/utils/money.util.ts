export function centavosParaReais(centavos: number): number {
  return Number((centavos / 100).toFixed(2));
}
