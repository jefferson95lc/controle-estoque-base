import { useMemo, useState } from 'react';
import { differenceInCalendarDays, endOfDay, format, isValid, parseISO, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { Building2, CalendarIcon, Check, Download, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProductCombobox } from '@/components/ProductCombobox';
import { suggestedOrderQty, weeklyAverage } from '@/lib/orderCalc';
import { createOrderPdf, createOrderWorkbook, FinalOrder } from '@/lib/orderExport';

function OrderDate({ label, date, onChange }: { label: string; date: Date | undefined; onChange: (date: Date | undefined) => void }) {
  return <div className="space-y-1"><Label>{label}</Label><Popover><PopoverTrigger asChild>
    <Button variant="outline" className="w-44 justify-start font-normal"><CalendarIcon size={16} />{date ? format(date, 'dd/MM/yyyy') : 'Selecionar data'}</Button>
  </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} onSelect={onChange} locale={ptBR} initialFocus className="pointer-events-auto p-3" /></PopoverContent></Popover></div>;
}

export default function OrderPage() {
  const { products, movements, filiais, activeCenterId, matrizId, costCenters, getStock, loading } = useApp();
  const [start, setStart] = useState<Date | undefined>(() => subDays(startOfDay(new Date()), 29));
  const [end, setEnd] = useState<Date | undefined>(() => startOfDay(new Date()));
  const [weeks, setWeeks] = useState('4');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [productToAdd, setProductToAdd] = useState('');
  const [finalOrder, setFinalOrder] = useState<FinalOrder | null>(null);
  const consolidated = !activeCenterId || activeCenterId === matrizId;
  const scope = consolidated ? 'Matriz (Consolidado)' : costCenters.find(c => c.id === activeCenterId)?.name || 'Filial';
  const periodDays = start && end ? differenceInCalendarDays(end, start) + 1 : 0;
  const valid = Boolean(start && end && periodDays > 0 && Number.isInteger(Number(weeks)) && Number(weeks) > 0);

  const rows = useMemo(() => {
    const totals = new Map<string, number>();
    const allowed = new Set(filiais.map(f => f.id));
    if (valid && start && end) for (const m of movements) {
      const date = parseISO(m.date);
      if (m.type !== 'saida' || !isValid(date) || date < startOfDay(start) || date > endOfDay(end)) continue;
      if (!allowed.has(m.costCenterId) || (!consolidated && m.costCenterId !== activeCenterId)) continue;
      totals.set(m.productId, (totals.get(m.productId) || 0) + m.quantity);
    }
    return products.map(p => {
      const consumption = totals.get(p.id) || 0;
      const stock = getStock(p.id, activeCenterId);
      const suggestion = valid ? suggestedOrderQty({ consumption, stock, periodDays, weeks: Number(weeks) }) : 0;
      const quantity = edits[p.id] === undefined ? suggestion : Number(edits[p.id]);
      return { p, consumption, stock, suggestion, quantity, average: weeklyAverage(consumption, periodDays) };
    }).filter(r => !removed.has(r.p.id) && (r.consumption > 0 || added.has(r.p.id)))
      .sort((a, b) => b.suggestion - a.suggestion || a.p.name.localeCompare(b.p.name));
  }, [products, movements, filiais, activeCenterId, consolidated, start, end, valid, periodDays, weeks, getStock, edits, added, removed]);

  const selectedRows = rows.filter(r => selected.has(r.p.id));
  const canGenerate = valid && selectedRows.length > 0 && selectedRows.every(r => Number.isInteger(r.quantity) && r.quantity > 0);
  const clearDraft = () => { setEdits({}); setSelected(new Set()); setAdded(new Set()); setRemoved(new Set()); setFinalOrder(null); };
  // Isolate drafts by branch: no quantities or validation may carry into another branch.
  const [draftCenter, setDraftCenter] = useState(activeCenterId);
  if (draftCenter !== activeCenterId) { setDraftCenter(activeCenterId); clearDraft(); }
  const invalidate = () => setFinalOrder(null);
  const generate = () => {
    if (!canGenerate || !start || !end) return;
    setFinalOrder({ scope, start: format(start, 'dd/MM/yyyy'), end: format(end, 'dd/MM/yyyy'), weeks: Number(weeks),
      items: selectedRows.map(r => ({ productId: r.p.id, name: r.p.name, sku: r.p.sku, unit: r.p.unit, quantity: r.quantity })) });
  };
  const filename = `pedido-${format(new Date(), 'yyyyMMdd')}`;

  return <div className="space-y-6">
    <div><h1 className="font-heading text-2xl font-bold">Pedido</h1><p className="text-sm text-muted-foreground flex items-center gap-2 mt-1"><Building2 size={14} />{scope}</p></div>
    <div className="flex flex-wrap gap-4 items-end">
      <OrderDate label="Data inicial" date={start} onChange={v => { setStart(v); clearDraft(); }} />
      <OrderDate label="Data final" date={end} onChange={v => { setEnd(v); clearDraft(); }} />
      <div className="space-y-1"><Label htmlFor="order-weeks">Quantidade de semanas</Label><Input id="order-weeks" type="number" min="1" step="1" className="w-44" value={weeks} onChange={e => { setWeeks(e.target.value); clearDraft(); }} /></div>
      <span className="text-sm text-muted-foreground pb-2">{periodDays > 0 ? `${periodDays} dias de referência` : 'Período inválido'}</span>
    </div>
    {!valid && <p role="alert" className="text-sm text-destructive">Informe um período válido e uma quantidade inteira de semanas maior que zero.</p>}
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-full sm:w-80 space-y-1"><Label>Produto</Label><ProductCombobox products={products.filter(p => !rows.some(r => r.p.id === p.id)).map(p => ({ id: p.id, label: `${p.name} · ${p.sku}` }))} value={productToAdd} onValueChange={setProductToAdd} /></div>
      <Button variant="outline" disabled={!productToAdd || loading} onClick={() => { setAdded(prev => new Set(prev).add(productToAdd)); setRemoved(prev => { const next = new Set(prev); next.delete(productToAdd); return next; }); setProductToAdd(''); invalidate(); }}><Plus size={16} /> Incluir produto</Button>
    </div>
    <div className="border rounded-md overflow-x-auto">
      <Table><TableHeader><TableRow>
        <TableHead className="w-12">Validar</TableHead><TableHead>Material</TableHead><TableHead className="text-right whitespace-nowrap">Consumo no período</TableHead><TableHead className="text-right whitespace-nowrap">Média semanal</TableHead><TableHead className="text-right whitespace-nowrap">Estoque atual</TableHead><TableHead className="text-right">Sugestão</TableHead><TableHead className="w-32">Quantidade</TableHead><TableHead className="w-12" />
      </TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.p.id}>
        <TableCell><Checkbox aria-label={`Validar ${r.p.name}`} checked={selected.has(r.p.id)} onCheckedChange={v => { setSelected(prev => { const next = new Set(prev); if (v === true) next.add(r.p.id); else next.delete(r.p.id); return next; }); invalidate(); }} /></TableCell>
        <TableCell className="font-medium min-w-48">{r.p.name}<span className="block text-xs text-muted-foreground">{r.p.sku} · {r.p.unit}</span></TableCell>
        <TableCell className="text-right">{r.consumption}</TableCell><TableCell className="text-right">{r.average.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</TableCell><TableCell className="text-right">{r.stock}</TableCell><TableCell className="text-right">{r.suggestion}</TableCell>
        <TableCell><Input aria-label={`Quantidade de ${r.p.name}`} type="number" min="0" step="1" className="w-24" value={edits[r.p.id] ?? r.suggestion} onChange={e => { setEdits(prev => ({ ...prev, [r.p.id]: e.target.value })); invalidate(); }} /></TableCell>
        <TableCell><Button variant="ghost" size="icon" title="Remover produto" aria-label={`Remover ${r.p.name}`} onClick={() => { setRemoved(prev => new Set(prev).add(r.p.id)); invalidate(); }}><Trash2 size={16} /></Button></TableCell>
      </TableRow>)}{rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground h-24">{loading ? 'Carregando...' : 'Nenhum material encontrado.'}</TableCell></TableRow>}</TableBody></Table>
    </div>
    <div className="flex items-center gap-4 flex-wrap"><Button disabled={!canGenerate || loading} onClick={generate}><Check size={16} /> Gerar pedido final</Button><span className="text-sm text-muted-foreground">{selectedRows.length} item(ns) validado(s)</span></div>
    {selectedRows.some(r => !Number.isInteger(r.quantity) || r.quantity <= 0) && <p className="text-sm text-destructive" role="alert">Os itens validados precisam de uma quantidade inteira maior que zero.</p>}
    {finalOrder && <section className="space-y-4 border-t pt-6">
      <div className="flex justify-between items-center gap-4 flex-wrap"><h2 className="font-heading text-xl font-bold">Pedido final</h2><div className="flex gap-2"><Button variant="outline" onClick={() => XLSX.writeFile(createOrderWorkbook(finalOrder), `${filename}.xls`, { bookType: 'biff8' })}><Download size={16} /> Exportar XLS</Button><Button variant="outline" onClick={() => createOrderPdf(finalOrder).save(`${filename}.pdf`)}><Download size={16} /> Exportar PDF</Button></div></div>
      <p className="text-sm text-muted-foreground">{finalOrder.scope} · {finalOrder.start} a {finalOrder.end} · {finalOrder.weeks} semana(s)</p>
      <Table><TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Unidade</TableHead><TableHead className="text-right">Quantidade</TableHead></TableRow></TableHeader><TableBody>{finalOrder.items.map(i => <TableRow key={i.productId}><TableCell>{i.name}</TableCell><TableCell>{i.unit}</TableCell><TableCell className="text-right font-semibold">{i.quantity}</TableCell></TableRow>)}</TableBody></Table>
    </section>}
  </div>;
}