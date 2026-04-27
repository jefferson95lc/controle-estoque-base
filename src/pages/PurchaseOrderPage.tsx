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
  const { products, costCenters, matrizId, getStock, getMinStock, activeCenterId, movements } = useApp();
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

  // Last purchase price per product, considering the selected scope (filial).
  // - When scope is a specific filial: uses the most recent 'entrada' in THAT filial.
  // - When scope is 'consolidado': uses the most recent 'entrada' across all filiais.
  // Fallback: if no entry exists for the selected filial, uses the global last cost.
  const lastCostByProduct = useMemo(() => {
    // Filter entradas with valid cost. Iterate in reverse (most recently inserted first)
    // and use a stable date desc sort so that, for ties on the same day, the last
    // inserted record wins — fixes "Último valor" not refreshing when two entries
    // share the same date.
    const entradas = movements
      .map((m, idx) => ({ m, idx }))
      .filter(({ m }) => m.type === 'entrada' && m.unitCost != null && m.unitCost > 0)
      .sort((a, b) => {
        const diff = new Date(b.m.date).getTime() - new Date(a.m.date).getTime();
        if (diff !== 0) return diff;
        return b.idx - a.idx; // newer insertion wins on tie
      });

    const globalMap: Record<string, number> = {};
    for (const { m } of entradas) {
      if (globalMap[m.productId] == null) globalMap[m.productId] = m.unitCost as number;
    }

    if (!scopeId) return globalMap;

    const scopedMap: Record<string, number> = {};
    for (const { m } of entradas) {
      if (m.costCenterId !== scopeId) continue;
      if (scopedMap[m.productId] == null) scopedMap[m.productId] = m.unitCost as number;
    }
    // Fallback to global when the filial has no recorded entry
    return { ...globalMap, ...scopedMap };
  }, [movements, scopeId]);

  const productsWithStock = useMemo(
    () => products.map(p => ({
      ...p,
      currentStock: getStock(p.id, scopeId),
      effectiveMin: getMinStock(p.id, scopeId),
      lastCost: lastCostByProduct[p.id],
    })),
    [products, getStock, getMinStock, scopeId, lastCostByProduct]
  );

  const formatBRL = (v?: number) =>
    v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
      ['Tipo de Material', 'Quantidade Esperada', 'Último Valor (R$)', 'Fornecedor 1', 'Fornecedor 2', 'Fornecedor 3', 'Melhor Preço', 'Melhor Fornecedor', 'Observações'],
    ];

    items.forEach(([id, item], idx) => {
      const product = products.find(p => p.id === id);
      const lastCost = lastCostByProduct[id];
      wsData.push([
        product?.name || '—',
        item.quantity,
        lastCost != null ? lastCost : '',
        lastCost != null ? lastCost : '', // Fornecedor 1 pré-preenchido com último valor
        '', // Fornecedor 2
        '', // Fornecedor 3
        '', // Melhor Preço (formula)
        '', // Melhor Fornecedor (formula)
        item.obs,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Add formulas for each data row (now Fornecedores estão em D, E, F)
    items.forEach((_entry, idx) => {
      const row = idx + 2;
      const d = `D${row}`, e = `E${row}`, f = `F${row}`;

      // Melhor Preço (G): MIN dos fornecedores preenchidos
      ws[`G${row}`] = {
        t: 'n',
        f: `IF(COUNTIF(${d}:${f},">0")=0,"",MIN(IF(${d}>0,${d},9999999),IF(${e}>0,${e},9999999),IF(${f}>0,${f},9999999)))`,
      };

      // Melhor Fornecedor (H)
      ws[`H${row}`] = {
        t: 's',
        f: `IF(G${row}="","",IF(G${row}=${d},"Fornecedor 1",IF(G${row}=${e},"Fornecedor 2",IF(G${row}=${f},"Fornecedor 3",""))))`,
      };
    });

    ws['!cols'] = [
      { wch: 35 }, // Tipo de Material
      { wch: 20 }, // Qtd Esperada
      { wch: 16 }, // Último Valor
      { wch: 18 }, // Fornecedor 1
      { wch: 18 }, // Fornecedor 2
      { wch: 18 }, // Fornecedor 3
      { wch: 16 }, // Melhor Preço
      { wch: 20 }, // Melhor Fornecedor
      { wch: 25 }, // Observações
    ];

    const lastRow = items.length + 1;
    ws['!ref'] = `A1:I${lastRow}`;

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
                <th className="text-right p-3 font-medium">Último valor</th>
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
                    <td className="p-3 text-right text-muted-foreground">{formatBRL(p.lastCost)}</td>
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
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
