import { describe, it, expect } from 'vitest';
import { selectedPeriodWeeks, suggestedOrderQty, weeklyAverage } from './orderCalc';

describe('cálculo do pedido', () => {
  it('16/11 a 20/11 conta como uma semana selecionada', () => {
    expect(selectedPeriodWeeks(5)).toBe(1);
  });
  it('230 saídas em cinco dias têm média semanal de 230', () => {
    expect(weeklyAverage(230, 5)).toBe(230);
  });
  it('película de RX: quatro semanas a 230 menos estoque de 500 sugere 420', () => {
    expect(suggestedOrderQty({ consumption: 230, periodDays: 5, weeks: 4, stock: 500 })).toBe(420);
  });
  it('divide o consumo pelas semanas selecionadas quando o período aumenta', () => {
    expect(selectedPeriodWeeks(12)).toBe(2);
    expect(weeklyAverage(460, 12)).toBe(230);
    expect(suggestedOrderQty({ consumption: 460, periodDays: 12, weeks: 3, stock: 500 })).toBe(190);
  });
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
