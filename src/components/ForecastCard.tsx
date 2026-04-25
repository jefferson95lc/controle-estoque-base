import { useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Download } from 'lucide-react';

const HORIZON_DAYS = 30;
const HISTORY_DAYS = 90;

export default function ForecastCard() {
  const { products, movements, getStock, activeCenterId, matrizId, filiais, costCenters } = useApp();

  const isConsolidated = !activeCenterId || activeCenterId === matrizId;
  const scopeLabel = isConsolidated ? 'Consolidado' : (costCenters.find(c => c.id === activeCenterId)?.name || 'Filial');

  const rows = useMemo(() => {
    const now = Date.now();
    const cutoff = now - HISTORY_DAYS * 24 * 60 * 60 * 1000;

    // Saídas reais por filial (transferências não contam como consumo)
    const filialIds = new Set(filiais.map(f => f.id));

    const consumoPorProduto = new Map<string, number>();
    for (const m of movements) {
      if (m.type !== 'saida') continue;
      if (new Date(m.date).getTime() < cutoff) continue;
      if (!filialIds.has(m.costCenterId)) continue;
      if (!isConsolidated && m.costCenterId !== activeCenterId) continue;
      consumoPorProduto.set(m.productId, (consumoPorProduto.get(m.productId) || 0) + m.quantity);
    }

    return products
      .map(p => {
        const consumo90 = consumoPorProduto.get(p.id) || 0;
        const mediaDiaria = consumo90 / HISTORY_DAYS;
        const previsao = Math.ceil(mediaDiaria * HORIZON_DAYS);
        const estoqueAtual = getStock(p.id, activeCenterId);
        const sugestaoCompra = Math.max(0, previsao - estoqueAtual);
        const diasCobertura = mediaDiaria > 0 ? Math.floor(estoqueAtual / mediaDiaria) : Infinity;
        return { p, consumo90, previsao, estoqueAtual, sugestaoCompra, diasCobertura, mediaDiaria };
      })
      .filter(r => r.consumo90 > 0)
      .sort((a, b) => b.sugestaoCompra - a.sugestaoCompra);
  }, [products, movements, filiais, activeCenterId, isConsolidated, getStock]);

  const handleExport = () => {
    const data = rows.map(r => ({
      'Produto': r.p.name,
      'SKU': r.p.sku,
      'Unidade': r.p.unit,
      'Consumo 90d': r.consumo90,
      'Média/dia': Number(r.mediaDiaria.toFixed(4)),
      [`Previsão ${HORIZON_DAYS}d`]: r.previsao,
      'Estoque atual': r.estoqueAtual,
      'Cobertura (dias)': r.diasCobertura === Infinity ? '∞' : r.diasCobertura,
      'Sugestão compra': r.sugestaoCompra,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Previsão');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `previsao-consumo-${scopeLabel.toLowerCase().replace(/\s+/g, '-')}-${stamp}.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              Previsão de Consumo (próximos {HORIZON_DAYS} dias)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Baseado nas saídas dos últimos {HISTORY_DAYS} dias · {isConsolidated ? 'Consolidado (todas as filiais)' : scopeLabel}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
            <Download size={14} className="mr-2" /> Exportar Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem histórico de saídas nos últimos {HISTORY_DAYS} dias para gerar previsão.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Consumo 90d</TableHead>
                  <TableHead className="text-right">Média/dia</TableHead>
                  <TableHead className="text-right">Previsão {HORIZON_DAYS}d</TableHead>
                  <TableHead className="text-right">Estoque atual</TableHead>
                  <TableHead className="text-right">Cobertura</TableHead>
                  <TableHead className="text-right">Sugestão compra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => {
                  const cobertura = r.diasCobertura === Infinity ? '—' : `${r.diasCobertura}d`;
                  const critico = r.diasCobertura < HORIZON_DAYS;
                  return (
                    <TableRow key={r.p.id}>
                      <TableCell className="font-medium">{r.p.name}</TableCell>
                      <TableCell className="text-right">{r.consumo90} {r.p.unit}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.mediaDiaria.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">{r.previsao} {r.p.unit}</TableCell>
                      <TableCell className="text-right">{r.estoqueAtual}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={critico ? 'destructive' : 'secondary'}>{cobertura}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.sugestaoCompra > 0 ? (
                          <Badge>{r.sugestaoCompra} {r.p.unit}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
