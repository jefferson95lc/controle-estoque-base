import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderHistory } from './OrderHistory';

const mocks = vi.hoisted(() => ({ isMaster: false, list: vi.fn(), remove: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ isMaster: mocks.isMaster }) }));
vi.mock('@/lib/orderHistory', () => ({ HISTORY_PAGE_SIZE: 50, listOrderHistory: mocks.list, deleteOrderHistory: mocks.remove }));
const saved = { id: 'o1', created_at: '2026-11-24T12:00:00Z', created_by: 'u1', center_ids: ['f1'], order: { scope: 'Bezerra', start: '16/11/2026', end: '20/11/2026', weeks: 4, items: [{ productId: 'p1', name: 'PELÍCULA DE RX (UN)', sku: 'SKU213', unit: 'UN', quantity: 420 }] } };
beforeEach(() => {
  mocks.isMaster = false;
  mocks.list.mockReset().mockResolvedValue([saved]);
  mocks.remove.mockReset().mockResolvedValue(undefined);
});
describe('exclusão de pedidos exclusiva para Master', () => {
  it('Comum pode consultar mas não tem acesso à exclusão', async () => {
    render(<OrderHistory centerIds={['f1']} consolidated={false} revision={0} />);
    await screen.findByRole('button', { name: 'Consultar pedido o1' });
    expect(screen.queryByRole('button', { name: 'Excluir pedido o1' })).not.toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('Master só exclui após confirmar e o pedido desaparece da consulta', async () => {
    mocks.isMaster = true;
    render(<OrderHistory centerIds={['f1']} consolidated={false} revision={0} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir pedido o1' }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir pedido o1' }));
    mocks.list.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    await screen.findByText('Nenhum pedido registrado.');
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('o1');
  });
  it('erro mantém o pedido e a confirmação abertos', async () => {
    mocks.isMaster = true;
    mocks.remove.mockRejectedValue(new Error('Permissão não ativada'));
    render(<OrderHistory centerIds={['f1']} consolidated={false} revision={0} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir pedido o1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Permissão não ativada'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consultar pedido o1', hidden: true })).toBeInTheDocument();
  });
});