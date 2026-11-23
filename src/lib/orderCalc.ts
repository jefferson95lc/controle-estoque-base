export interface OrderCalcInput {
  consumption: number; // total de saídas no período
  periodDays: number;  // dias do período (inclusivo)
  weeks: number;       // semanas que o pedido deve cobrir
  stock: number;       // estoque atual disponível
}

/** Conta semanas de sete dias; uma semana parcial conta como uma semana selecionada. */
export function selectedPeriodWeeks(periodDays: number): number {
  return periodDays > 0 ? Math.ceil(periodDays / 7) : 0;
}

export function weeklyAverage(consumption: number, periodDays: number): number {
  const periodWeeks = selectedPeriodWeeks(periodDays);
  if (periodWeeks === 0) return 0;
  return consumption / periodWeeks;
}

/** Necessidade de compra = (média semanal × semanas) − estoque, nunca negativa. */
export function suggestedOrderQty({ consumption, periodDays, weeks, stock }: OrderCalcInput): number {
  const need = Math.ceil(weeklyAverage(consumption, periodDays) * Math.max(0, weeks));
  return Math.max(0, need - Math.max(0, stock));
}
