import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
const history = vi.hoisted(() => ({ save: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/orderHistory', () => ({ saveOrderHistory: history.save, listOrderHistory: history.list, HISTORY_PAGE_SIZE: 50 }));

describe('Pedido isolado dos lançamentos de estoque', () => {
  beforeEach(() => {
    history.save.mockReset().mockImplementation(async record => ({ ...record, created_at: '2026-11-23T14:31:00Z' }));
    history.list.mockReset().mockResolvedValue([]);
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
  it('conta apenas saídas no período e na filial escolhida', async () => {
    render(<OrderPage />);
    const row = screen.getByText('Luva PP').closest('tr');
    expect(row).not.toBeNull();
    if (!row) return;
    expect(within(row).getAllByRole('cell')[2]).toHaveTextContent('60');
    expect(screen.getByLabelText('Quantidade de Luva PP')).toHaveValue(28);
    await screen.findByText('Nenhum pedido registrado.');
  });
  it('pedido final inclui somente itens validados e usa a quantidade editada', async () => {
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
    await waitFor(() => expect(history.save).toHaveBeenCalledTimes(1));
    expect(history.save.mock.calls[0][0]).toMatchObject({ created_by: 'u1', center_ids: ['f1'], order: { scope: 'Bezerra', weeks: 4, items: [{ productId: 'p1', name: 'Luva PP', quantity: 12 }] } });
    fireEvent.change(screen.getByLabelText('Quantidade de Luva PP'), { target: { value: '13' } });
    expect(screen.queryByRole('heading', { name: 'Pedido final' })).not.toBeInTheDocument();
  });
  it('consulta posterior recupera o pedido e a data sem recalcular quantidades', async () => {
    history.list.mockResolvedValue([{ id: 'o1', created_at: '2026-11-23T14:31:00Z', created_by: 'u1', center_ids: ['f1'], order: { scope: 'Bezerra', start: '16/11/2026', end: '20/11/2026', weeks: 4, items: [{ productId: 'p2', name: 'Máscara histórica', sku: 'SKU2', unit: 'un', quantity: 420 }] } }]);
    render(<OrderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Consultar pedido o1' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/23\/11\/2026/)).toBeInTheDocument();
    expect(within(dialog).getByText('Máscara histórica')).toBeInTheDocument();
    expect(within(dialog).getByText('420')).toBeInTheDocument();
    expect(history.list).toHaveBeenCalledWith(['f1'], false, 0);
  });
  it('falha de salvamento é visível e permite repetir o mesmo pedido sem duplicar seu ID', async () => {
    history.save.mockRejectedValueOnce(new Error('Falha de conexão'));
    render(<OrderPage />);
    fireEvent.change(screen.getByLabelText('Quantidade de Luva PP'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Validar Luva PP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gerar pedido final' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar salvar novamente' }));
    await waitFor(() => expect(history.save).toHaveBeenCalledTimes(2));
    expect(history.save.mock.calls[0][0].id).toBe(history.save.mock.calls[1][0].id);
  });
  it('descarta validações e edições quando muda a filial', async () => {
    const { rerender } = render(<OrderPage />);
    fireEvent.change(screen.getByLabelText('Quantidade de Luva PP'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Validar Luva PP' }));
    app.activeCenterId = 'f2';
    rerender(<OrderPage />);
    expect(screen.getByRole('checkbox', { name: 'Validar Luva PP' })).not.toBeChecked();
    expect(screen.getByLabelText('Quantidade de Luva PP')).toHaveValue(715);
    await screen.findByText('Nenhum pedido registrado.');
  });
});