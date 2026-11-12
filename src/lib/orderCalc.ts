export interface OrderCalcInput {
  consumption: number; // total de saídas no período
  periodDays: number;  // dias do período (inclusivo)
  weeks: number;       // semanas que o pedido deve cobrir
  stock: number;       // estoque atual disponível
}

export function weeklyAverage(consumption: number, periodDays: number): number {
  if (periodDays <= 0) return 0;
  return consumption / (periodDays / 7);
}

/** Necessidade de compra = (média semanal × semanas) − estoque, nunca negativa. */
export function suggestedOrderQty({ consumption, periodDays, weeks, stock }: OrderCalcInput): number {
  const need = Math.ceil(weeklyAverage(consumption, periodDays) * Math.max(0, weeks));
  return Math.max(0, need - Math.max(0, stock));
}
