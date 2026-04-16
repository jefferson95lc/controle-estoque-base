import { useState, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { format, isAfter, isBefore, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ReportsPage() {
  const { movements, products } = useApp();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const d = parseISO(m.date);
      if (startDate && isBefore(d, startOfDay(parseISO(startDate)))) return false;
      if (endDate && isAfter(d, endOfDay(parseISO(endDate)))) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements, startDate, endDate]);

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || '—';

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Relatórios</h1>

      <div className="flex gap-4 items-end">
        <div><Label>Data Início</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><Label>Data Fim</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Data</th>
                <th className="text-left p-3 font-medium">Produto</th>
                <th className="text-center p-3 font-medium">Tipo</th>
                <th className="text-center p-3 font-medium">Qtd</th>
                <th className="text-left p-3 font-medium">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map(m => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-muted-foreground">{format(parseISO(m.date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</td>
                  <td className="p-3 font-medium">{getProductName(m.productId)}</td>
                  <td className="p-3 text-center">
                    <Badge variant={m.type === 'entrada' ? 'default' : 'destructive'}>
                      {m.type === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                    </Badge>
                  </td>
                  <td className="p-3 text-center font-semibold">{m.quantity}</td>
                  <td className="p-3 text-muted-foreground">{m.reason}</td>
                </tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhuma movimentação encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
