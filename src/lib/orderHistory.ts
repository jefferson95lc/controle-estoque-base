import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { FinalOrder } from './orderExport';

export type SavedOrder = { id: string; created_at: string; created_by: string; center_ids: string[]; order: FinalOrder };
export type OrderHistoryInsert = Omit<SavedOrder, 'created_at'>;
type HistoryDatabase = { public: { Tables: { order_history: {
  Row: SavedOrder; Insert: OrderHistoryInsert; Update: never; Relationships: [];
} }; Views: {}; Functions: {}; Enums: {}; CompositeTypes: {} } };

// Use the existing authenticated connection without modifying generated database types.
const client = supabase as unknown as SupabaseClient<HistoryDatabase>;
export const HISTORY_PAGE_SIZE = 50;

function historyError(error: { code?: string; message: string }): Error {
  if (error.code === 'PGRST205' || error.code === '42P01') {
    return new Error('O histórico ainda não foi ativado no banco de produção. Execute o SQL de ativação fornecido.');
  }
  return new Error(`Não foi possível acessar o histórico: ${error.message}`);
}

export async function saveOrderHistory(record: OrderHistoryInsert): Promise<SavedOrder> {
  const { data, error } = await client.from('order_history').insert(record).select().single();
  // Retrying after a lost response must not create a second copy of the same order.
  if (error?.code === '23505') {
    const existing = await client.from('order_history').select().eq('id', record.id).single();
    if (existing.error) throw historyError(existing.error);
    return existing.data;
  }
  if (error) throw historyError(error);
  return data;
}

export async function listOrderHistory(centerIds: string[], consolidated: boolean, offset = 0): Promise<SavedOrder[]> {
  if (centerIds.length === 0) return [];
  let query = client.from('order_history').select().order('created_at', { ascending: false }).order('id', { ascending: false });
  query = consolidated ? query.containedBy('center_ids', centerIds) : query.contains('center_ids', centerIds);
  const { data, error } = await query.range(offset, offset + HISTORY_PAGE_SIZE - 1);
  if (error) throw historyError(error);
  return data;
}

/** Authorization is enforced by the database's Master-only DELETE policy. */
export async function deleteOrderHistory(id: string): Promise<void> {
  const { data, error } = await client.from('order_history').delete().eq('id', id).select('id').maybeSingle();
  if (error) throw historyError(error);
  if (!data) throw new Error('Pedido não excluído. Apenas Master pode excluir; confirme também se a permissão de exclusão foi ativada no banco de produção.');
}