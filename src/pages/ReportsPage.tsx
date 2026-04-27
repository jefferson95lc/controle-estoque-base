import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/store/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, isAfter, isBefore, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export default function ReportsPage() {
  const { movements, products, costCenters, matrizId } = useApp();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  // Load user emails for display
  useEffect(() => {
    async function loadUsers() {
      const { data } = await supabase.from('profiles').select('id, email');
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(p => { map[p.id] = p.email; });
        setUserMap(map);
      }
    }
    loadUsers();
  }, []);

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
  const getUserEmail = (userId?: string) => userId ? (userMap[userId] || '—') : '—';

  const formatBRL = (v?: number) =>
    v == null || isNaN(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const exportToExcel = () => {
    const data = filteredMovements.map(m => {
      const total = m.type === 'entrada' && m.unitCost != null ? m.unitCost * m.quantity : null;
      return {
        'Data': format(parseISO(m.date), 'dd/MM/yyyy', { locale: ptBR }),
        'Produto': getProductName(m.productId),
        'Tipo': m.type === 'entrada' ? 'Entrada' : m.type === 'saida' ? 'Saída' : 'Transferência',
        'Centro de Custo': m.type === 'transferencia'
          ? `${getCenterName(m.costCenterId)} → ${getCenterName(m.destinationCenterId)}`
          : getCenterName(m.costCenterId),
        'Quantidade': m.quantity,
        'Valor Unitário (R$)': m.type === 'entrada' && m.unitCost != null ? m.unitCost : '',
        'Valor Total (R$)': total != null ? total : '',
        'Motivo': m.reason,
        'Usuário': getUserEmail(m.userId),
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 25 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `relatorio_movimentacoes_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const totalEntradasValor = useMemo(
    () => filteredMovements.reduce((sum, m) => sum + (m.type === 'entrada' && m.unitCost != null ? m.unitCost * m.quantity : 0), 0),
    [filteredMovements]
  );

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
        <Button onClick={exportToExcel} disabled={filteredMovements.length === 0} className="self-end">
          <Download className="h-4 w-4 mr-2" /> Exportar Excel
        </Button>
      </div>

      <Card className="bg-success/5 border-success/30">
        <CardContent className="pt-4 pb-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Total investido em entradas (período/filtro)</p>
            <p className="text-2xl font-heading font-bold text-success">{formatBRL(totalEntradasValor)}</p>
          </div>
          <p className="text-xs text-muted-foreground">{filteredMovements.filter(m => m.type === 'entrada').length} entrada(s)</p>
        </CardContent>
      </Card>

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
                <th className="text-right p-3 font-medium">Valor Unit.</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-left p-3 font-medium">Motivo</th>
                <th className="text-left p-3 font-medium">Usuário</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map(m => {
                const total = m.type === 'entrada' && m.unitCost != null ? m.unitCost * m.quantity : null;
                return (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-muted-foreground">{format(parseISO(m.date), 'dd/MM/yyyy', { locale: ptBR })}</td>
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
                    <td className="p-3 text-right text-muted-foreground">{m.type === 'entrada' ? formatBRL(m.unitCost) : '—'}</td>
                    <td className="p-3 text-right font-medium">{total != null ? formatBRL(total) : '—'}</td>
                    <td className="p-3 text-muted-foreground">{m.reason}</td>
                    <td className="p-3 text-muted-foreground">{getUserEmail(m.userId)}</td>
                  </tr>
                );
              })}
              {filteredMovements.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhuma movimentação encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
