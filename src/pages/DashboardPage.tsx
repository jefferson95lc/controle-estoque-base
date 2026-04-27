import { useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Building2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import ForecastCard from '@/components/ForecastCard';

export default function DashboardPage() {
  const { products, movements, costCenters, getStock, getMinStock, activeCenterId, matrizId, filiais } = useApp();

  const isConsolidated = !activeCenterId || activeCenterId === matrizId;
  const scopeLabel = isConsolidated
    ? (matrizId ? 'Matriz (Consolidado)' : 'Consolidado')
    : (costCenters.find(c => c.id === activeCenterId)?.name || '—');

  const lowStock = products.filter(p => getStock(p.id, activeCenterId) <= getMinStock(p.id, activeCenterId));

  const allowedIds = useMemo(() => new Set(filiais.map(f => f.id).concat(matrizId ? [matrizId] : [])), [filiais, matrizId]);
  const scopedMovements = isConsolidated
    ? movements.filter(m => allowedIds.has(m.costCenterId) || (m.destinationCenterId && allowedIds.has(m.destinationCenterId)))
    : movements.filter(m => m.costCenterId === activeCenterId || m.destinationCenterId === activeCenterId);

  const recentMovements = [...scopedMovements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  const totalEntradas = scopedMovements.filter(m => m.type === 'entrada').length;
  const totalSaidas = scopedMovements.filter(m => m.type === 'saida').length;

  // Último custo por produto: prioriza entrada na filial ativa; fallback para global
  const lastCostByProduct = useMemo(() => {
    // Date desc + insertion-order tiebreaker (newer insert wins on same date)
    const sorted = movements
      .map((m, idx) => ({ m, idx }))
      .filter(({ m }) => m.type === 'entrada' && m.unitCost != null && m.unitCost > 0)
      .sort((a, b) => {
        const diff = new Date(b.m.date).getTime() - new Date(a.m.date).getTime();
        if (diff !== 0) return diff;
        return b.idx - a.idx;
      });
    const globalMap: Record<string, number> = {};
    const scopedMap: Record<string, number> = {};
    for (const { m } of sorted) {
      if (globalMap[m.productId] == null) globalMap[m.productId] = m.unitCost as number;
      if (!isConsolidated && m.costCenterId === activeCenterId && scopedMap[m.productId] == null) {
        scopedMap[m.productId] = m.unitCost as number;
      }
    }
    return { ...globalMap, ...scopedMap };
  }, [movements, activeCenterId, isConsolidated]);

  // Valor total em estoque no escopo atual = soma(estoque_atual_no_escopo × último_custo)
  const totalStockValue = useMemo(() => {
    return products.reduce((sum, p) => {
      const qty = getStock(p.id, activeCenterId);
      const cost = lastCostByProduct[p.id];
      if (qty <= 0 || cost == null) return sum;
      return sum + qty * cost;
    }, 0);
  }, [products, getStock, activeCenterId, lastCostByProduct]);

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const stats = [
    { label: 'Produtos', value: products.length, icon: Package, color: 'text-primary' },
    { label: 'Estoque Baixo', value: lowStock.length, icon: AlertTriangle, color: 'text-warning' },
    { label: 'Entradas', value: totalEntradas, icon: ArrowUpCircle, color: 'text-success' },
    { label: 'Saídas', value: totalSaidas, icon: ArrowDownCircle, color: 'text-muted-foreground' },
  ];

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || '—';
  const getCenterName = (id?: string) => id ? (costCenters.find(c => c.id === id)?.name || '—') : '—';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
          <Building2 size={14} /> {scopeLabel}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-heading font-bold mt-1">{s.value}</p>
                </div>
                <s.icon className={`${s.color} opacity-80`} size={28} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/30">
        <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <DollarSign className="text-success" size={32} />
            <div>
              <p className="text-sm text-muted-foreground">Valor estimado em estoque ({scopeLabel})</p>
              <p className="text-3xl font-heading font-bold text-success">{formatBRL(totalStockValue)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground max-w-xs text-right">
            Calculado com base no <strong>último valor unitário de entrada</strong> de cada produto.
          </p>
        </CardContent>
      </Card>

      {isConsolidated && filiais.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg">Estoque por Filial</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filiais.map(f => {
                const total = products.reduce((sum, p) => sum + getStock(p.id, f.id), 0);
                const low = products.filter(p => getStock(p.id, f.id) <= getMinStock(p.id, f.id)).length;
                return (
                  <div key={f.id} className="p-3 rounded-md border bg-secondary/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 size={14} className="text-muted-foreground" />
                      <span className="font-medium text-sm">{f.name}</span>
                    </div>
                    <p className="text-2xl font-heading font-bold">{total}</p>
                    <p className="text-xs text-muted-foreground">{low} item(ns) abaixo do mínimo</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg">Produtos com Estoque Baixo</CardTitle></CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto abaixo do estoque mínimo.</p>
            ) : (
              <div className="space-y-2">
                {lowStock.map(p => {
                  const qty = getStock(p.id, activeCenterId);
                  const min = getMinStock(p.id, activeCenterId);
                  return (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-destructive/10">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-sm text-destructive font-semibold">{qty}/{min} {p.unit}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-heading text-lg">Últimas Movimentações</CardTitle></CardHeader>
          <CardContent>
            {recentMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
            ) : (
              <div className="space-y-2">
                {recentMovements.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-secondary">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{getProductName(m.productId)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.type === 'transferencia'
                          ? `${getCenterName(m.costCenterId)} → ${getCenterName(m.destinationCenterId)}`
                          : getCenterName(m.costCenterId)}
                        {' · '}{format(new Date(m.date), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant={m.type === 'entrada' ? 'default' : m.type === 'saida' ? 'destructive' : 'secondary'}>
                      {m.type === 'entrada' ? '↑' : m.type === 'saida' ? '↓' : '⇄'} {m.quantity}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ForecastCard />
    </div>
  );
}
