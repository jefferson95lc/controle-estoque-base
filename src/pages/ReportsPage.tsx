import { useState, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, isAfter, isBefore, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ReportsPage() {
  const { movements, products, costCenters, matrizId } = useApp();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [centerFilter, setCenterFilter] = useState<string>('all'); // 'all' | 'consolidado' | center.id

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const d = parseISO(m.date);
      if (startDate && isBefore(d, startOfDay(parseISO(startDate)))) return false;
      if (endDate && isAfter(d, endOfDay(parseISO(endDate)))) return false;
      if (centerFilter !== 'all' && centerFilter !== 'consolidado') {
        if (m.costCenterId !== centerFilter && m.destinationCenterId !== centerFilter) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements, startDate, endDate, centerFilter]);

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || '—';
  const getCenterName = (id?: string) => id ? (costCenters.find(c => c.id === id)?.name || '—') : '—';

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Relatórios</h1>

      <div className="flex gap-4 items-end flex-wrap">
        <div><Label>Data Início</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><Label>Data Fim</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        <div className="min-w-[220px]">
          <Label>Centro de Custo</Label>
          <Select value={centerFilter} onValueChange={setCenterFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos {matrizId ? '(Consolidado)' : ''}</SelectItem>
              {costCenters.filter(c => c.type === 'filial').map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Data</th>
                <th className="text-left p-3 font-medium">Produto</th>
                <th className="text-center p-3 font-medium">Tipo</th>
                <th className="text-left p-3 font-medium">Centro de Custo</th>
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
                    <Badge variant={m.type === 'entrada' ? 'default' : m.type === 'saida' ? 'destructive' : 'secondary'}>
                      {m.type === 'entrada' ? '↑ Entrada' : m.type === 'saida' ? '↓ Saída' : '⇄ Transferência'}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {m.type === 'transferencia'
                      ? `${getCenterName(m.costCenterId)} → ${getCenterName(m.destinationCenterId)}`
                      : getCenterName(m.costCenterId)}
                  </td>
                  <td className="p-3 text-center font-semibold">{m.quantity}</td>
                  <td className="p-3 text-muted-foreground">{m.reason}</td>
                </tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma movimentação encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
