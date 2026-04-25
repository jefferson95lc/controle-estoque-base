import { useState, useMemo, useEffect } from 'react';
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
  const { products, costCenters, matrizId, getStock, getMinStock, activeCenterId } = useApp();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Record<string, OrderItem>>({});

  // Scope: 'consolidado' or filial id. Default to active center if it's a filial, else consolidado.
  const [scope, setScope] = useState<string>(
    activeCenterId && activeCenterId !== matrizId ? activeCenterId : 'consolidado'
  );

  // Sync scope when the global active filial changes (header selector)
  useEffect(() => {
    const next = activeCenterId && activeCenterId !== matrizId ? activeCenterId : 'consolidado';
    setScope(next);
    setSelected({});
  }, [activeCenterId, matrizId]);

  const scopeId: string | null = scope === 'consolidado' ? null : scope;
  const scopeLabel = scope === 'consolidado'
    ? (matrizId ? 'Matriz (Consolidado)' : 'Consolidado')
    : (costCenters.find(c => c.id === scope)?.name || '—');

  const productsWithStock = useMemo(
    () => products.map(p => ({
      ...p,
      currentStock: getStock(p.id, scopeId),
      effectiveMin: getMinStock(p.id, scopeId),
    })),
    [products, getStock, getMinStock, scopeId]
  );

  const toggleProduct = (id: string) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        const product = productsWithStock.find(p => p.id === id);
        const suggestedQty = product ? Math.max(0, product.effectiveMin - product.currentStock) : 0;
        next[id] = { productId: id, quantity: suggestedQty > 0 ? suggestedQty : 1, obs: '' };
      }
      return next;
    });
  };

  const updateItem = (id: string, field: 'quantity' | 'obs', value: string | number) => {
    setSelected(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const selectLowStock = () => {
    const lowStock = productsWithStock.filter(p => p.currentStock <= p.effectiveMin);
    const next: Record<string, OrderItem> = {};
    lowStock.forEach(p => {
      next[p.id] = { productId: p.id, quantity: Math.max(1, p.effectiveMin - p.currentStock), obs: '' };
    });
    setSelected(next);
  };

  const exportToExcel = () => {
    const items = Object.entries(selected);
    if (items.length === 0) {
      toast({ title: 'Atenção', description: 'Selecione ao menos um produto.', variant: 'destructive' });
      return;
    }

    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [
      ['Tipo de Material', 'Quantidade Esperada', 'Fornecedor 1', 'Fornecedor 2', 'Fornecedor 3', 'Melhor Preço', 'Melhor Fornecedor', 'Observações'],
    ];

    items.forEach(([id, item], idx) => {
      const product = products.find(p => p.id === id);
      wsData.push([
        product?.name || '—',
        item.quantity,
        '', // Fornecedor 1
        '', // Fornecedor 2
        '', // Fornecedor 3
        '', // Melhor Preço (will be formula)
        '', // Melhor Fornecedor (will be formula)
        item.obs,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Add formulas for each data row
    items.forEach((_entry, idx) => {
      const row = idx + 2; // Excel row (1-indexed, +1 for header)
      const c = `C${row}`, d = `D${row}`, e = `E${row}`;

      // Melhor Preço: MIN dos fornecedores preenchidos (ignora zeros/vazios)
      ws[`F${row}`] = {
        t: 'n',
        f: `IF(COUNTIF(${c}:${e},">0")=0,"",MIN(IF(${c}>0,${c},9999999),IF(${d}>0,${d},9999999),IF(${e}>0,${e},9999999)))`,
      };

      // Melhor Fornecedor: nome da coluna com menor preço
      ws[`G${row}`] = {
        t: 's',
        f: `IF(F${row}="","",IF(F${row}=${c},"Fornecedor 1",IF(F${row}=${d},"Fornecedor 2",IF(F${row}=${e},"Fornecedor 3",""))))`,
      };
    });

    // Column widths
    ws['!cols'] = [
      { wch: 35 }, // Tipo de Material
      { wch: 20 }, // Qtd Esperada
      { wch: 18 }, // Fornecedor 1
      { wch: 18 }, // Fornecedor 2
      { wch: 18 }, // Fornecedor 3
      { wch: 16 }, // Melhor Preço
      { wch: 20 }, // Melhor Fornecedor
      { wch: 25 }, // Observações
    ];

    // Set ref to include new column
    const lastRow = items.length + 1;
    ws['!ref'] = `A1:H${lastRow}`;

    XLSX.utils.book_append_sheet(wb, ws, 'Ordem de Compra');

    const dateStr = format(new Date(), 'dd-MM-yyyy');
    const scopeSlug = scopeLabel.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
    XLSX.writeFile(wb, `Ordem_de_Compra_${scopeSlug}_${dateStr}.xlsx`);

    toast({ title: 'Exportado!', description: `Arquivo gerado com fórmulas de cotação para ${scopeLabel}.` });
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
                const isLow = p.currentStock <= p.effectiveMin;
                return (
                  <tr key={p.id} className={`border-b last:border-0 transition-colors ${isSelected ? 'bg-primary/5' : isLow ? 'bg-destructive/5' : 'hover:bg-muted/30'}`}>
                    <td className="p-3 text-center">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleProduct(p.id)} />
                    </td>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{p.sku}</td>
                    <td className={`p-3 text-center font-semibold ${isLow ? 'text-destructive' : ''}`}>{p.currentStock} {p.unit}</td>
                    <td className="p-3 text-center text-muted-foreground">{p.effectiveMin}</td>
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
