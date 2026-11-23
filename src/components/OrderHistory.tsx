import { useEffect, useState } from 'react';
import { Download, Eye, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HISTORY_PAGE_SIZE, listOrderHistory, type SavedOrder } from '@/lib/orderHistory';
import { createOrderPdf, createOrderWorkbook } from '@/lib/orderExport';

export function OrderHistory({ centerIds, consolidated, revision }: { centerIds: string[]; consolidated: boolean; revision: number }) {
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [selected, setSelected] = useState<SavedOrder | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [offset, setOffset] = useState(0);
  const scopeKey = JSON.stringify([...centerIds].sort());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listOrderHistory(JSON.parse(scopeKey), consolidated, offset).then(rows => {
      if (cancelled) return;
      setOrders(previous => offset === 0 ? rows : [...previous, ...rows]);
      setHasMore(rows.length === HISTORY_PAGE_SIZE);
    }).catch(e => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível carregar o histórico.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scopeKey, consolidated, revision, refresh, offset]);

  const filename = selected ? `pedido-${format(parseISO(selected.created_at), 'yyyyMMdd')}-${selected.id.slice(0, 8)}` : 'pedido';
  return <section className="space-y-4 border-t pt-6">
    <div className="flex items-center justify-between gap-3"><h2 className="font-heading text-xl font-bold">Histórico de pedidos</h2><Button variant="ghost" size="icon" title="Atualizar histórico" aria-label="Atualizar histórico" disabled={loading} onClick={() => { setOffset(0); setRefresh(v => v + 1); }}><RefreshCw size={16} /></Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data de geração</TableHead><TableHead>Centro de custo</TableHead><TableHead>Período</TableHead><TableHead>Semanas</TableHead><TableHead>Itens</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
      <TableBody>{orders.map(saved => <TableRow key={saved.id}><TableCell className="whitespace-nowrap">{format(parseISO(saved.created_at), 'dd/MM/yyyy')}</TableCell><TableCell>{saved.order.scope}</TableCell><TableCell className="whitespace-nowrap">{saved.order.start} a {saved.order.end}</TableCell><TableCell>{saved.order.weeks}</TableCell><TableCell>{saved.order.items.length}</TableCell><TableCell><Button variant="ghost" size="icon" title="Consultar pedido" aria-label={`Consultar pedido ${saved.id}`} onClick={() => setSelected(saved)}><Eye size={16} /></Button></TableCell></TableRow>)}
      {orders.length === 0 && !error && <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">{loading ? 'Carregando...' : 'Nenhum pedido registrado.'}</TableCell></TableRow>}</TableBody>
    </Table></div>
    {hasMore && <Button variant="outline" disabled={loading} onClick={() => setOffset(orders.length)}>{loading ? 'Carregando...' : 'Carregar mais'}</Button>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Pedido registrado</DialogTitle></DialogHeader>
      {selected && <><p className="text-sm text-muted-foreground">{format(parseISO(selected.created_at), 'dd/MM/yyyy')} · {selected.order.scope} · {selected.order.start} a {selected.order.end} · {selected.order.weeks} semana(s)</p>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => XLSX.writeFile(createOrderWorkbook(selected.order), `${filename}.xls`, { bookType: 'biff8' })}><Download size={16} />Exportar XLS</Button><Button variant="outline" onClick={() => createOrderPdf(selected.order).save(`${filename}.pdf`)}><Download size={16} />Exportar PDF</Button></div>
        <Table><TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Unidade</TableHead><TableHead className="text-right">Quantidade</TableHead></TableRow></TableHeader><TableBody>{selected.order.items.map(item => <TableRow key={item.productId}><TableCell>{item.name}<span className="block text-xs text-muted-foreground">{item.sku}</span></TableCell><TableCell>{item.unit}</TableCell><TableCell className="text-right">{item.quantity}</TableCell></TableRow>)}</TableBody></Table>
      </>}
    </DialogContent></Dialog>
  </section>;
}