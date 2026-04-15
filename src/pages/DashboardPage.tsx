import { useApp } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, AlertTriangle, ShoppingCart, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const { products, purchases, movements } = useApp();

  const lowStock = products.filter(p => p.quantity <= p.minStock);
  const recentPurchases = [...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  const totalMovements = movements.length;

  const stats = [
    { label: 'Total de Produtos', value: products.length, icon: Package, color: 'text-primary' },
    { label: 'Estoque Baixo', value: lowStock.length, icon: AlertTriangle, color: 'text-warning' },
    { label: 'Compras', value: purchases.length, icon: ShoppingCart, color: 'text-success' },
    { label: 'Movimentações', value: totalMovements, icon: TrendingUp, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Dashboard</h1>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg">Produtos com Estoque Baixo</CardTitle></CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto abaixo do estoque mínimo.</p>
            ) : (
              <div className="space-y-2">
                {lowStock.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-destructive/10">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-sm text-destructive font-semibold">{p.quantity}/{p.minStock} {p.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-heading text-lg">Últimas Compras</CardTitle></CardHeader>
          <CardContent>
            {recentPurchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma compra registrada.</p>
            ) : (
              <div className="space-y-2">
                {recentPurchases.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-secondary">
                    <span className="text-sm">#{p.id.slice(0, 8)}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(p.date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                    <Badge variant={p.status === 'Recebido' ? 'default' : p.status === 'Aprovado' ? 'secondary' : 'outline'}>
                      {p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
