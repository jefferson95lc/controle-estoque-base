import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderPage from './OrderPage';

const app = vi.hoisted(() => ({
  products: [
    { id: 'p1', name: 'Luva PP', sku: 'SKU1', unit: 'cx' },
    { id: 'p2', name: 'Máscara', sku: 'SKU2', unit: 'un' },
  ],
  movements: [] as Array<{ type: string; date: string; quantity: number; productId: string; costCenterId: string }>,
  filiais: [{ id: 'f1', name: 'Bezerra' }, { id: 'f2', name: 'Sobral' }],
  activeCenterId: 'f1' as string | null,
  matrizId: 'm', costCenters: [{ id: 'f1', name: 'Bezerra' }, { id: 'f2', name: 'Sobral' }],
  getStock: (_productId: string, centerId: string | null) => centerId === 'f1' ? 20 : 5,
  loading: false,
}));
vi.mock('@/store/AppContext', () => ({ useApp: () => app }));

describe('Pedido isolado dos lançamentos de estoque', () => {
  beforeEach(() => {
    app.activeCenterId = 'f1';
    const today = new Date().toISOString();
    app.movements = [
      { type: 'saida', date: today, quantity: 60, productId: 'p1', costCenterId: 'f1' },
      { type: 'saida', date: today, quantity: 900, productId: 'p1', costCenterId: 'f2' },
      { type: 'transferencia', date: today, quantity: 700, productId: 'p1', costCenterId: 'f1' },
      { type: 'entrada', date: today, quantity: 500, productId: 'p1', costCenterId: 'f1' },
      { type: 'saida', date: '2000-01-01', quantity: 800, productId: 'p1', costCenterId: 'f1' },
    ];
  });
  it('conta apenas saídas no período e na filial escolhida', () => {
    render(<OrderPage />);
    const row = screen.getByText('Luva PP').closest('tr');
    expect(row).not.toBeNull();
    if (!row) return;
    expect(within(row).getAllByRole('cell')[2]).toHaveTextContent('60');
    expect(screen.getByLabelText('Quantidade de Luva PP')).toHaveValue(36);
  });
  it('pedido final inclui somente itens validados e usa a quantidade editada', () => {
    render(<OrderPage />);
    expect(screen.getByRole('button', { name: 'Gerar pedido final' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Quantidade de Luva PP'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Validar Luva PP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gerar pedido final' }));
    const final = screen.getByRole('heading', { name: 'Pedido final' }).closest('section');
    expect(final).not.toBeNull();
    if (!final) return;
    expect(within(final).getByText('12')).toBeInTheDocument();
    expect(within(final).queryByText('Máscara')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Quantidade de Luva PP'), { target: { value: '13' } });
    expect(screen.queryByRole('heading', { name: 'Pedido final' })).not.toBeInTheDocument();
  });
  it('descarta validações e edições quando muda a filial', () => {
    const { rerender } = render(<OrderPage />);
    fireEvent.change(screen.getByLabelText('Quantidade de Luva PP'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Validar Luva PP' }));
    app.activeCenterId = 'f2';
    rerender(<OrderPage />);
    expect(screen.getByRole('checkbox', { name: 'Validar Luva PP' })).not.toBeChecked();
    expect(screen.getByLabelText('Quantidade de Luva PP')).toHaveValue(835);
  });
});