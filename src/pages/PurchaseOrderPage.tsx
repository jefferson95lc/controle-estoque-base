import { useState, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface OrderItem {
  productId: string;
  quantity: number;
  obs: string;
}

export default function PurchaseOrderPage() {
  const { products, costCenters, matrizId, getStock, activeCenterId } = useApp();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Record<string, OrderItem>>({});

  // Scope: 'consolidado' or filial id. Default to active center if it's a filial, else consolidado.
  const [scope, setScope] = useState<string>(
    activeCenterId && activeCenterId !== matrizId ? activeCenterId : 'consolidado'
  );

  const scopeId: string | null = scope === 'consolidado' ? null : scope;
  const scopeLabel = scope === 'consolidado'
    ? (matrizId ? 'Matriz (Consolidado)' : 'Consolidado')
    : (costCenters.find(c => c.id === scope)?.name || '—');

  const productsWithStock = useMemo(
    () => products.map(p => ({ ...p, currentStock: getStock(p.id, scopeId) })),
    [products, getStock, scopeId]
  );

  const toggleProduct = (id: string) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        const product = productsWithStock.find(p => p.id === id);
        const suggestedQty = product ? Math.max(0, product.minStock - product.currentStock) : 0;
        next[id] = { productId: id, quantity: suggestedQty > 0 ? suggestedQty : 1, obs: '' };
      }
      return next;
    });
  };

  const updateItem = (id: string, field: 'quantity' | 'obs', value: string | number) => {
    setSelected(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const selectLowStock = () => {
    const lowStock = productsWithStock.filter(p => p.currentStock <= p.minStock);
    const next: Record<string, OrderItem> = {};
    lowStock.forEach(p => {
      next[p.id] = { productId: p.id, quantity: Math.max(1, p.minStock - p.currentStock), obs: '' };
    });
    setSelected(next);
  };

  const exportToExcel = () => {
    const items = Object.entries(selected);
    if (items.length === 0) {
      toast({ title: 'Atenção', description: 'Selecione ao menos um produto.', variant: 'destructive' });
      return;
    }

    const rows = items.map(([id, item]) => {
      const product = products.find(p => p.id === id);
      return {
        'Tipo de Material': product?.name || '—',
        'Quantidade Esperada': item.quantity,
        'Fornecedor 1': '',
        'Fornecedor 2': '',
        'Fornecedor 3': '',
        'Melhor Preço': '',
        'Observações': item.obs,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 25 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ordem de Compra');

    const dateStr = format(new Date(), 'dd-MM-yyyy');
    const scopeSlug = scopeLabel.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
    XLSX.writeFile(wb, `Ordem_de_Compra_${scopeSlug}_${dateStr}.xlsx`);

    toast({ title: 'Exportado!', description: `Arquivo gerado para ${scopeLabel}.` });
  };

  const selectedCount = Object.keys(selected).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold">Ordem de Compras</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={selectLowStock}>
            <AlertTriangle size={16} className="mr-2" />
            Selecionar Estoque Baixo
          </Button>
          <Button onClick={exportToExcel} disabled={selectedCount === 0}>
            <FileSpreadsheet size={16} className="mr-2" />
            Gerar Ordem de Compra ({selectedCount})
          </Button>
        </div>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <div className="min-w-[260px]">
          <Label>Base de cálculo do estoque</Label>
          <Select value={scope} onValueChange={(v) => { setScope(v); setSelected({}); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="consolidado">{matrizId ? 'Matriz (Consolidado)' : 'Consolidado (todas)'}</SelectItem>
              {costCenters.filter(c => c.type === 'filial').map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground pb-2">
          Sugestões e estoque exibidos referem-se a: <strong>{scopeLabel}</strong>.
        </p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 w-10"></th>
                <th className="text-left p-3 font-medium">Produto</th>
                <th className="text-left p-3 font-medium">SKU</th>
                <th className="text-center p-3 font-medium">Estoque ({scopeLabel})</th>
                <th className="text-center p-3 font-medium">Mín.</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-center p-3 font-medium">Qtd. Esperada</th>
                <th className="text-left p-3 font-medium">Observações</th>
              </tr>
            </thead>
            <tbody>
              {productsWithStock.map(p => {
                const isSelected = !!selected[p.id];
                const isLow = p.currentStock <= p.minStock;
                return (
                  <tr key={p.id} className={`border-b last:border-0 transition-colors ${isSelected ? 'bg-primary/5' : isLow ? 'bg-destructive/5' : 'hover:bg-muted/30'}`}>
                    <td className="p-3 text-center">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleProduct(p.id)} />
                    </td>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{p.sku}</td>
                    <td className={`p-3 text-center font-semibold ${isLow ? 'text-destructive' : ''}`}>{p.currentStock} {p.unit}</td>
                    <td className="p-3 text-center text-muted-foreground">{p.minStock}</td>
                    <td className="p-3 text-center">
                      {isLow ? <Badge variant="destructive">Baixo</Badge> : <Badge variant="secondary">OK</Badge>}
                    </td>
                    <td className="p-3 text-center">
                      {isSelected ? (
                        <Input
                          type="number" min={1} className="w-20 mx-auto text-center h-8"
                          value={selected[p.id].quantity}
                          onChange={e => updateItem(p.id, 'quantity', Math.max(1, Number(e.target.value)))}
                        />
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">
                      {isSelected ? (
                        <Input
                          className="h-8" placeholder="Opcional"
                          value={selected[p.id].obs}
                          onChange={e => updateItem(p.id, 'obs', e.target.value)}
                        />
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
