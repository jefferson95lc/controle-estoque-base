import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  const { products } = useApp();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Record<string, OrderItem>>({});

  const toggleProduct = (id: string) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        const product = products.find(p => p.id === id);
        const suggestedQty = product ? Math.max(0, product.minStock - product.quantity) : 0;
        next[id] = { productId: id, quantity: suggestedQty > 0 ? suggestedQty : 1, obs: '' };
      }
      return next;
    });
  };

  const updateItem = (id: string, field: 'quantity' | 'obs', value: string | number) => {
    setSelected(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const selectLowStock = () => {
    const lowStock = products.filter(p => p.quantity <= p.minStock);
    const next: Record<string, OrderItem> = {};
    lowStock.forEach(p => {
      next[p.id] = { productId: p.id, quantity: Math.max(1, p.minStock - p.quantity), obs: '' };
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

    // Column widths
    ws['!cols'] = [
      { wch: 30 }, // Tipo de Material
      { wch: 20 }, // Quantidade Esperada
      { wch: 18 }, // Fornecedor 1
      { wch: 18 }, // Fornecedor 2
      { wch: 18 }, // Fornecedor 3
      { wch: 16 }, // Melhor Preço
      { wch: 25 }, // Observações
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ordem de Compra');

    const dateStr = format(new Date(), 'dd-MM-yyyy');
    XLSX.writeFile(wb, `Ordem_de_Compra_${dateStr}.xlsx`);

    toast({ title: 'Exportado!', description: 'Arquivo Excel gerado com sucesso.' });
  };

  const selectedCount = Object.keys(selected).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Ordem de Compras</h1>
        <div className="flex gap-2">
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

      <p className="text-sm text-muted-foreground">
        Selecione os produtos, ajuste as quantidades e exporte a ordem de compra em Excel para cotação com fornecedores.
      </p>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 w-10"></th>
                <th className="text-left p-3 font-medium">Produto</th>
                <th className="text-left p-3 font-medium">SKU</th>
                <th className="text-center p-3 font-medium">Estoque Atual</th>
                <th className="text-center p-3 font-medium">Mín.</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-center p-3 font-medium">Qtd. Esperada</th>
                <th className="text-left p-3 font-medium">Observações</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const isSelected = !!selected[p.id];
                const isLow = p.quantity <= p.minStock;
                return (
                  <tr key={p.id} className={`border-b last:border-0 transition-colors ${isSelected ? 'bg-primary/5' : isLow ? 'bg-destructive/5' : 'hover:bg-muted/30'}`}>
                    <td className="p-3 text-center">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleProduct(p.id)} />
                    </td>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{p.sku}</td>
                    <td className={`p-3 text-center font-semibold ${isLow ? 'text-destructive' : ''}`}>{p.quantity} {p.unit}</td>
                    <td className="p-3 text-center text-muted-foreground">{p.minStock}</td>
                    <td className="p-3 text-center">
                      {isLow ? <Badge variant="destructive">Baixo</Badge> : <Badge variant="secondary">OK</Badge>}
                    </td>
                    <td className="p-3 text-center">
                      {isSelected ? (
                        <Input
                          type="number"
                          min={1}
                          className="w-20 mx-auto text-center h-8"
                          value={selected[p.id].quantity}
                          onChange={e => updateItem(p.id, 'quantity', Math.max(1, Number(e.target.value)))}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {isSelected ? (
                        <Input
                          className="h-8"
                          placeholder="Opcional"
                          value={selected[p.id].obs}
                          onChange={e => updateItem(p.id, 'obs', e.target.value)}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
