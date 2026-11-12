import { describe, it, expect } from 'vitest';
import { suggestedOrderQty, weeklyAverage } from './orderCalc';

describe('cálculo do pedido', () => {
  it('média semanal usa o período filtrado', () => {
    expect(weeklyAverage(28, 14)).toBe(14);
  });
  it('desconta o estoque atual da necessidade', () => {
    expect(suggestedOrderQty({ consumption: 28, periodDays: 14, weeks: 4, stock: 20 })).toBe(36);
  });
  it('não sugere compra quando o estoque cobre o período', () => {
    expect(suggestedOrderQty({ consumption: 28, periodDays: 14, weeks: 2, stock: 50 })).toBe(0);
  });
});
