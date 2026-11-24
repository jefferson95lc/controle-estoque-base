import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listOrderHistory, saveOrderHistory, type OrderHistoryInsert } from './orderHistory';

const db = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), select: vi.fn(), single: vi.fn(), eq: vi.fn(), order: vi.fn(), containedBy: vi.fn(), contains: vi.fn(), range: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: db.from } }));
const record: OrderHistoryInsert = { id: 'o1', created_by: 'u1', center_ids: ['f1'], order: { scope: 'Bezerra', start: '16/11/2026', end: '20/11/2026', weeks: 4, items: [{ productId: 'p1', name: 'PELÍCULA DE RX (UN)', sku: 'SKU213', unit: 'UN', quantity: 420 }] } };

beforeEach(() => {
  vi.clearAllMocks();
  for (const name of ['from', 'insert', 'select', 'eq', 'order', 'containedBy', 'contains'] as const) db[name].mockReturnValue(db);
  db.single.mockResolvedValue({ data: { ...record, created_at: '2026-11-23T14:31:00Z' }, error: null });
  db.range.mockResolvedValue({ data: [], error: null });
});

describe('persistência isolada do histórico de pedidos', () => {
  it('salva o conteúdo e retorna a data registrada pelo banco sem escrever no estoque', async () => {
    const saved = await saveOrderHistory(record);
    expect(saved.created_at).toBe('2026-11-23T14:31:00Z');
    expect(saved.order.items[0].quantity).toBe(420);
    expect(db.insert).toHaveBeenCalledWith(record);
    expect(db.from.mock.calls).toEqual([['order_history']]);
  });
  it('repetição após resposta perdida recupera o ID original', async () => {
    db.single.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate' } });
    expect((await saveOrderHistory(record)).id).toBe('o1');
    expect(db.eq).toHaveBeenCalledWith('id', 'o1');
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
  it('consulta a filial escolhida e pagina sem truncar o histórico', async () => {
    await listOrderHistory(['f1'], false, 50);
    expect(db.contains).toHaveBeenCalledWith('center_ids', ['f1']);
    expect(db.range).toHaveBeenCalledWith(50, 99);
  });
  it('consolidado solicita apenas centros do escopo disponível', async () => {
    await listOrderHistory(['f1', 'f2'], true);
    expect(db.containedBy).toHaveBeenCalledWith('center_ids', ['f1', 'f2']);
  });
  it('não informa sucesso quando a tabela ainda não foi ativada', async () => {
    db.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST205', message: 'missing' } });
    await expect(saveOrderHistory(record)).rejects.toThrow('ainda não foi ativado');
  });
});