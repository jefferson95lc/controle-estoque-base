import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { PurchaseItem, PurchaseStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PurchasesPage() {
  const { purchases, suppliers, products, addPurchase, updatePurchaseStatus } = useApp();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const addItem = () => setItems([...items, { productId: '', quantity: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: string | number) =>
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleSave = () => {
    if (!supplierId || items.length === 0 || items.some(i => !i.productId)) return;
    addPurchase({ supplierId, date: new Date().toISOString(), status: 'Pendente', items });
    setOpen(false);
    setSupplierId('');
    setItems([]);
  };

  const filtered = statusFilter === 'all' ? purchases : purchases.filter(p => p.status === statusFilter);

  const getTotal = (items: PurchaseItem[]) => items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const statusColor = (s: PurchaseStatus) =>
    s === 'Recebido' ? 'default' : s === 'Aprovado' ? 'secondary' : 'outline';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Compras</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSupplierId(''); setItems([]); } }}>
          <DialogTrigger asChild>
            <Button><Plus size={16} className="mr-2" />Novo Pedido</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle className="font-heading">Novo Pedido de Compra</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Fornecedor</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Itens</Label>
                  <Button variant="outline" size="sm" onClick={addItem}><Plus size={14} className="mr-1" />Adicionar</Button>
                </div>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_100px_80px_32px] gap-2 items-end">
                    <div>
                      <Select value={item.productId} onValueChange={v => updateItem(i, 'productId', v)}>
                        <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                        <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Input type="number" placeholder="Qtd" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} />
                    <Input type="number" placeholder="Valor unit." step="0.01" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))} />
                    <span className="text-sm font-medium text-center py-2">
                      R$ {(item.quantity * item.unitPrice).toFixed(2)}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 size={14} /></Button>
                  </div>
                ))}
                {items.length > 0 && (
                  <p className="text-right font-semibold">Total: R$ {getTotal(items).toFixed(2)}</p>
                )}
              </div>
              <Button className="w-full" onClick={handleSave}>Criar Pedido</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {['all', 'Pendente', 'Aprovado', 'Recebido'].map(s => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm"
            onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'Todos' : s}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Pedido</th>
                <th className="text-left p-3 font-medium">Fornecedor</th>
                <th className="text-left p-3 font-medium">Data</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const supplier = suppliers.find(s => s.id === p.supplierId);
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs">#{p.id.slice(0, 8)}</td>
                    <td className="p-3 font-medium">{supplier?.name || '—'}</td>
                    <td className="p-3 text-muted-foreground">{format(new Date(p.date), 'dd/MM/yyyy', { locale: ptBR })}</td>
                    <td className="p-3 text-right font-medium">R$ {getTotal(p.items).toFixed(2)}</td>
                    <td className="p-3 text-center"><Badge variant={statusColor(p.status)}>{p.status}</Badge></td>
                    <td className="p-3 text-right space-x-1">
                      {p.status === 'Pendente' && (
                        <Button variant="outline" size="sm" onClick={() => updatePurchaseStatus(p.id, 'Aprovado')}>Aprovar</Button>
                      )}
                      {p.status === 'Aprovado' && (
                        <Button size="sm" onClick={() => updatePurchaseStatus(p.id, 'Recebido')}>Receber</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum pedido encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
