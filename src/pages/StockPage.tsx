import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, AlertTriangle, ArrowLeftRight, Building2, Trash2, ListPlus } from 'lucide-react';
import { StockBulkImport } from '@/components/StockBulkImport';
import { ProductCombobox } from '@/components/ProductCombobox';
import { MinStockCell } from '@/components/MinStockCell';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const OUT_REASONS = ['Venda', 'Perda', 'Uso interno', 'Devolução', 'Outro'];
const IN_REASONS = ['Compra', 'Devolução de cliente', 'Ajuste de inventário', 'Outro'];

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

export default function StockPage() {
  const {
    products, filiais, matrizId, activeCenterId, setActiveCenterId,
    addStockIn, addStockOut, transferStock, getStock, costCenters,
    getMinStock, setProductMinStockForCenter,
  } = useApp();
  const { isMaster } = useAuth();
  const { toast } = useToast();

  const [outOpen, setOutOpen] = useState(false);
  const [inOpen, setInOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [movDate, setMovDate] = useState(todayStr());
  const [centerId, setCenterId] = useState<string>('');
  const [destCenterId, setDestCenterId] = useState<string>('');
  const [unitCost, setUnitCost] = useState<string>('');

  const [confirmType, setConfirmType] = useState<null | 'entrada' | 'saida' | 'transferencia'>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filas de lançamentos (carrinho local)
  type QueueInItem = { productId: string; quantity: number; reason: string; centerId: string; movDate: string; unitCost: string };
  type QueueOutItem = { productId: string; quantity: number; reason: string; centerId: string; movDate: string };
  type QueueTransferItem = { productId: string; quantity: number; centerId: string; destCenterId: string; reason: string; movDate: string };
  const [queueIn, setQueueIn] = useState<QueueInItem[]>([]);
  const [queueOut, setQueueOut] = useState<QueueOutItem[]>([]);
  const [queueTransfer, setQueueTransfer] = useState<QueueTransferItem[]>([]);
  const [confirmBatch, setConfirmBatch] = useState<null | 'entrada' | 'saida' | 'transferencia'>(null);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  const isConsolidated = !activeCenterId || activeCenterId === matrizId;
  const viewingCenter = isConsolidated ? null : costCenters.find(c => c.id === activeCenterId) || null;

  const lowStock = useMemo(
    () => products.filter(p => getStock(p.id, activeCenterId) <= getMinStock(p.id, activeCenterId)),
    [products, getStock, getMinStock, activeCenterId]
  );

  const resetForm = () => {
    setProductId(''); setQuantity(1); setReason(''); setMovDate(todayStr());
    setCenterId(activeCenterId && activeCenterId !== matrizId ? activeCenterId : '');
    setDestCenterId('');
    setUnitCost('');
  };

  const openIn = () => {
    if (filiais.length === 0) {
      toast({ title: 'Atenção', description: 'Cadastre uma filial antes de movimentar estoque.', variant: 'destructive' });
      return;
    }
    setCenterId(activeCenterId && activeCenterId !== matrizId ? activeCenterId : '');
    setReason('Compra');
    setInOpen(true);
  };
  const openOut = () => {
    if (filiais.length === 0) {
      toast({ title: 'Atenção', description: 'Cadastre uma filial antes de movimentar estoque.', variant: 'destructive' });
      return;
    }
    setCenterId(activeCenterId && activeCenterId !== matrizId ? activeCenterId : '');
    setReason('Uso interno');
    setOutOpen(true);
  };
  const openTransfer = () => {
    if (filiais.length < 2) {
      toast({ title: 'Atenção', description: 'É necessário ao menos 2 filiais para transferir.', variant: 'destructive' });
      return;
    }
    setCenterId(activeCenterId && activeCenterId !== matrizId ? activeCenterId : '');
    setTransferOpen(true);
  };

  const requestIn = () => {
    if (!productId || !reason || quantity <= 0 || !centerId) {
      toast({ title: 'Atenção', description: 'Preencha todos os campos.', variant: 'destructive' });
      return;
    }
    const cost = parseFloat(unitCost.replace(',', '.'));
    if (!unitCost || isNaN(cost) || cost <= 0) {
      toast({ title: 'Valor obrigatório', description: 'Informe o valor unitário do produto.', variant: 'destructive' });
      return;
    }
    setConfirmType('entrada');
  };

  const requestOut = () => {
    if (!productId || !reason || quantity <= 0 || !centerId) {
      toast({ title: 'Atenção', description: 'Preencha todos os campos.', variant: 'destructive' });
      return;
    }
    setConfirmType('saida');
  };

  const requestTransfer = () => {
    if (!productId || !centerId || !destCenterId || centerId === destCenterId || quantity <= 0) {
      toast({ title: 'Atenção', description: 'Preencha todos os campos corretamente.', variant: 'destructive' });
      return;
    }
    setConfirmType('transferencia');
  };

  const handleIn = async () => {
    const cost = parseFloat(unitCost.replace(',', '.'));
    const dateISO = movDate ? new Date(movDate + 'T12:00:00').toISOString() : undefined;
    const ok = await addStockIn(productId, quantity, reason, centerId, dateISO, cost);
    if (!ok) { toast({ title: 'Erro', description: 'Não foi possível registrar.', variant: 'destructive' }); return; }
    toast({ title: 'Sucesso', description: 'Entrada registrada.' });
    setInOpen(false); resetForm();
  };

  const handleOut = async () => {
    const dateISO = movDate ? new Date(movDate + 'T12:00:00').toISOString() : undefined;
    const ok = await addStockOut(productId, quantity, reason, centerId, dateISO);
    if (!ok) { toast({ title: 'Erro', description: 'Estoque insuficiente nessa filial.', variant: 'destructive' }); return; }
    toast({ title: 'Sucesso', description: 'Saída registrada.' });
    setOutOpen(false); resetForm();
  };

  const handleTransfer = async () => {
    const dateISO = movDate ? new Date(movDate + 'T12:00:00').toISOString() : undefined;
    const ok = await transferStock(productId, quantity, centerId, destCenterId, reason, dateISO);
    if (!ok) { toast({ title: 'Erro', description: 'Estoque insuficiente na filial de origem.', variant: 'destructive' }); return; }
    toast({ title: 'Sucesso', description: 'Transferência registrada.' });
    setTransferOpen(false); resetForm();
  };

  const confirmExecute = async () => {
    setSubmitting(true);
    try {
      if (confirmType === 'entrada') await handleIn();
      else if (confirmType === 'saida') await handleOut();
      else if (confirmType === 'transferencia') await handleTransfer();
    } finally {
      setSubmitting(false);
      setConfirmType(null);
    }
  };

  // ===== Carrinho / fila =====
  const productLabel = (id: string) => products.find(p => p.id === id)?.name || '—';
  const productUnitOf = (id: string) => products.find(p => p.id === id)?.unit || '';
  const centerLabel = (id: string) => costCenters.find(c => c.id === id)?.name || '—';

  const addInToQueue = () => {
    if (!productId || !reason || quantity <= 0 || !centerId) {
      toast({ title: 'Atenção', description: 'Preencha todos os campos.', variant: 'destructive' }); return;
    }
    const cost = parseFloat(unitCost.replace(',', '.'));
    if (!unitCost || isNaN(cost) || cost <= 0) {
      toast({ title: 'Valor obrigatório', description: 'Informe o valor unitário.', variant: 'destructive' }); return;
    }
    setQueueIn(q => [...q, { productId, quantity, reason, centerId, movDate, unitCost }]);
    setProductId(''); setQuantity(1); setUnitCost('');
  };
  const addOutToQueue = () => {
    if (!productId || !reason || quantity <= 0 || !centerId) {
      toast({ title: 'Atenção', description: 'Preencha todos os campos.', variant: 'destructive' }); return;
    }
    setQueueOut(q => [...q, { productId, quantity, reason, centerId, movDate }]);
    setProductId(''); setQuantity(1);
  };
  const addTransferToQueue = () => {
    if (!productId || !centerId || !destCenterId || centerId === destCenterId || quantity <= 0) {
      toast({ title: 'Atenção', description: 'Preencha todos os campos corretamente.', variant: 'destructive' }); return;
    }
    setQueueTransfer(q => [...q, { productId, quantity, centerId, destCenterId, reason, movDate }]);
    setProductId(''); setQuantity(1);
  };

  const executeBatch = async () => {
    setSubmitting(true);
    let okCount = 0, failCount = 0;
    try {
      if (confirmBatch === 'entrada') {
        setBatchProgress({ done: 0, total: queueIn.length });
        for (let i = 0; i < queueIn.length; i++) {
          const it = queueIn[i];
          const dateISO = it.movDate ? new Date(it.movDate + 'T12:00:00').toISOString() : undefined;
          const cost = parseFloat(it.unitCost.replace(',', '.'));
          const ok = await addStockIn(it.productId, it.quantity, it.reason, it.centerId, dateISO, cost);
          ok ? okCount++ : failCount++;
          setBatchProgress({ done: i + 1, total: queueIn.length });
        }
        setQueueIn([]); setInOpen(false);
      } else if (confirmBatch === 'saida') {
        setBatchProgress({ done: 0, total: queueOut.length });
        for (let i = 0; i < queueOut.length; i++) {
          const it = queueOut[i];
          const dateISO = it.movDate ? new Date(it.movDate + 'T12:00:00').toISOString() : undefined;
          const ok = await addStockOut(it.productId, it.quantity, it.reason, it.centerId, dateISO);
          ok ? okCount++ : failCount++;
          setBatchProgress({ done: i + 1, total: queueOut.length });
        }
        setQueueOut([]); setOutOpen(false);
      } else if (confirmBatch === 'transferencia') {
        setBatchProgress({ done: 0, total: queueTransfer.length });
        for (let i = 0; i < queueTransfer.length; i++) {
          const it = queueTransfer[i];
          const dateISO = it.movDate ? new Date(it.movDate + 'T12:00:00').toISOString() : undefined;
          const ok = await transferStock(it.productId, it.quantity, it.centerId, it.destCenterId, it.reason, dateISO);
          ok ? okCount++ : failCount++;
          setBatchProgress({ done: i + 1, total: queueTransfer.length });
        }
        setQueueTransfer([]); setTransferOpen(false);
      }
      toast({
        title: failCount === 0 ? 'Lançamentos efetivados' : 'Concluído com falhas',
        description: `${okCount} sucesso(s)${failCount ? `, ${failCount} falha(s)` : ''}.`,
        variant: failCount === 0 ? 'default' : 'destructive',
      });
      resetForm();
    } finally {
      setSubmitting(false);
      setConfirmBatch(null);
      setBatchProgress(null);
    }
  };

  const productName = products.find(p => p.id === productId)?.name || '—';
  const productUnit = products.find(p => p.id === productId)?.unit || '';
  const centerName = costCenters.find(c => c.id === centerId)?.name || '—';
  const destName = costCenters.find(c => c.id === destCenterId)?.name || '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Estoque</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <Building2 size={14} />
            {isConsolidated ? 'Consolidado (Matriz) — somente leitura' : `Filial: ${viewingCenter?.name}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isMaster && <StockBulkImport />}
          <Button onClick={openIn}><Plus size={16} className="mr-2" />Entrada</Button>
          <Button variant="outline" onClick={openOut}><Minus size={16} className="mr-2" />Saída</Button>
          <Button variant="outline" onClick={openTransfer}><ArrowLeftRight size={16} className="mr-2" />Transferir</Button>
        </div>
      </div>

      {isConsolidated && (
        <Card className="bg-muted/30">
          <CardContent className="pt-4 pb-4 text-sm text-muted-foreground">
            Você está visualizando o <strong>estoque consolidado da Matriz</strong>, calculado automaticamente a partir das filiais. Para movimentar, selecione uma filial no topo ou abra um formulário e escolha a filial.
          </CardContent>
        </Card>
      )}

      {/* Entrada */}
      <Dialog open={inOpen} onOpenChange={(v) => { setInOpen(v); if (!v) { resetForm(); setQueueIn([]); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Registrar Entrada</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Filial</Label>
              <Select value={centerId} onValueChange={setCenterId}>
                <SelectTrigger><SelectValue placeholder="Selecione a filial" /></SelectTrigger>
                <SelectContent>{filiais.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Produto</Label>
              <ProductCombobox
                products={products.map(p => ({ id: p.id, label: `${p.name}${centerId ? ` (${getStock(p.id, centerId)} ${p.unit})` : ''}` }))}
                value={productId}
                onValueChange={setProductId}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantidade</Label><Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></div>
              <div><Label>Data</Label><Input type="date" value={movDate} onChange={e => setMovDate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor unitário (R$) *</Label>
                <Input
                  type="number" min={0} step="0.01" placeholder="0,00"
                  value={unitCost}
                  onChange={e => setUnitCost(e.target.value)}
                />
              </div>
              <div>
                <Label>Total</Label>
                <Input
                  readOnly
                  value={(() => {
                    const c = parseFloat((unitCost || '0').replace(',', '.'));
                    if (isNaN(c) || c <= 0) return 'R$ 0,00';
                    return (c * quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  })()}
                  className="bg-muted/40"
                />
              </div>
            </div>
            <div>
              <Label>Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{IN_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {queueIn.length > 0 && (
              <div className="rounded-md border bg-muted/20 p-2 space-y-1 max-h-40 overflow-y-auto">
                <div className="text-xs font-medium text-muted-foreground px-1">Fila ({queueIn.length})</div>
                {queueIn.map((it, i) => {
                  const c = parseFloat(it.unitCost.replace(',', '.')) || 0;
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs bg-background rounded px-2 py-1.5">
                      <div className="flex-1 min-w-0 truncate">
                        <strong>{productLabel(it.productId)}</strong> · {it.quantity} {productUnitOf(it.productId)} · {centerLabel(it.centerId)} · {(c * it.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setQueueIn(q => q.filter((_, idx) => idx !== i))}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={addInToQueue}><ListPlus size={16} className="mr-2" />Adicionar à fila</Button>
              <Button onClick={requestIn}>Registrar agora</Button>
            </div>
            {queueIn.length > 0 && (
              <Button className="w-full" variant="default" onClick={() => setConfirmBatch('entrada')}>
                Confirmar fila ({queueIn.length} {queueIn.length === 1 ? 'item' : 'itens'})
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Saída */}
      <Dialog open={outOpen} onOpenChange={(v) => { setOutOpen(v); if (!v) { resetForm(); setQueueOut([]); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Registrar Saída</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Filial</Label>
              <Select value={centerId} onValueChange={setCenterId}>
                <SelectTrigger><SelectValue placeholder="Selecione a filial" /></SelectTrigger>
                <SelectContent>{filiais.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Produto</Label>
              <ProductCombobox
                products={products.map(p => ({ id: p.id, label: `${p.name}${centerId ? ` (${getStock(p.id, centerId)} ${p.unit})` : ''}` }))}
                value={productId}
                onValueChange={setProductId}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantidade</Label><Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></div>
              <div><Label>Data</Label><Input type="date" value={movDate} onChange={e => setMovDate(e.target.value)} /></div>
            </div>
            <div>
              <Label>Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{OUT_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {queueOut.length > 0 && (
              <div className="rounded-md border bg-muted/20 p-2 space-y-1 max-h-40 overflow-y-auto">
                <div className="text-xs font-medium text-muted-foreground px-1">Fila ({queueOut.length})</div>
                {queueOut.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs bg-background rounded px-2 py-1.5">
                    <div className="flex-1 min-w-0 truncate">
                      <strong>{productLabel(it.productId)}</strong> · {it.quantity} {productUnitOf(it.productId)} · {centerLabel(it.centerId)} · {it.reason}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setQueueOut(q => q.filter((_, idx) => idx !== i))}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={addOutToQueue}><ListPlus size={16} className="mr-2" />Adicionar à fila</Button>
              <Button onClick={requestOut}>Registrar agora</Button>
            </div>
            {queueOut.length > 0 && (
              <Button className="w-full" onClick={() => setConfirmBatch('saida')}>
                Confirmar fila ({queueOut.length} {queueOut.length === 1 ? 'item' : 'itens'})
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transferência */}
      <Dialog open={transferOpen} onOpenChange={(v) => { setTransferOpen(v); if (!v) { resetForm(); setQueueTransfer([]); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Transferir entre Filiais</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Origem</Label>
                <Select value={centerId} onValueChange={setCenterId}>
                  <SelectTrigger><SelectValue placeholder="Filial origem" /></SelectTrigger>
                  <SelectContent>{filiais.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Destino</Label>
                <Select value={destCenterId} onValueChange={setDestCenterId}>
                  <SelectTrigger><SelectValue placeholder="Filial destino" /></SelectTrigger>
                  <SelectContent>{filiais.filter(f => f.id !== centerId).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Produto</Label>
              <ProductCombobox
                products={products.map(p => ({ id: p.id, label: `${p.name}${centerId ? ` (disp: ${getStock(p.id, centerId)} ${p.unit})` : ''}` }))}
                value={productId}
                onValueChange={setProductId}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantidade</Label><Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></div>
              <div><Label>Data</Label><Input type="date" value={movDate} onChange={e => setMovDate(e.target.value)} /></div>
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo da transferência" />
            </div>
            {queueTransfer.length > 0 && (
              <div className="rounded-md border bg-muted/20 p-2 space-y-1 max-h-40 overflow-y-auto">
                <div className="text-xs font-medium text-muted-foreground px-1">Fila ({queueTransfer.length})</div>
                {queueTransfer.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs bg-background rounded px-2 py-1.5">
                    <div className="flex-1 min-w-0 truncate">
                      <strong>{productLabel(it.productId)}</strong> · {it.quantity} {productUnitOf(it.productId)} · {centerLabel(it.centerId)} → {centerLabel(it.destCenterId)}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setQueueTransfer(q => q.filter((_, idx) => idx !== i))}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={addTransferToQueue}><ListPlus size={16} className="mr-2" />Adicionar à fila</Button>
              <Button onClick={requestTransfer}>Registrar agora</Button>
            </div>
            {queueTransfer.length > 0 && (
              <Button className="w-full" onClick={() => setConfirmBatch('transferencia')}>
                Confirmar fila ({queueTransfer.length} {queueTransfer.length === 1 ? 'item' : 'itens'})
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {lowStock.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning" />
              Produtos abaixo do estoque mínimo ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStock.map(p => (
                <Badge key={p.id} variant="outline" className="border-warning/50 text-warning">
                  {p.name}: {getStock(p.id, activeCenterId)}/{getMinStock(p.id, activeCenterId)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Produto</th>
                <th className="text-left p-3 font-medium">SKU</th>
                <th className="text-center p-3 font-medium">
                  {isConsolidated ? 'Consolidado' : viewingCenter?.name}
                </th>
                {isConsolidated && filiais.map(f => (
                  <th key={f.id} className="text-center p-3 font-medium text-xs text-muted-foreground whitespace-nowrap">{f.name}</th>
                ))}
                <th className="text-center p-3 font-medium">Mín.</th>
                <th className="text-center p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const qty = getStock(p.id, activeCenterId);
                const effectiveMin = getMinStock(p.id, activeCenterId);
                const isLow = qty <= effectiveMin;
                return (
                  <tr key={p.id} className={`border-b last:border-0 transition-colors ${isLow ? 'bg-destructive/5' : 'hover:bg-muted/30'}`}>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{p.sku}</td>
                    <td className={`p-3 text-center font-semibold ${isLow ? 'text-destructive' : ''}`}>{qty} {p.unit}</td>
                    {isConsolidated && filiais.map(f => (
                      <td key={f.id} className="p-3 text-center text-muted-foreground">{getStock(p.id, f.id)}</td>
                    ))}
                    <td className="p-3 text-center">
                      {isConsolidated ? (
                        <span className="text-muted-foreground">{effectiveMin}</span>
                      ) : (
                        <MinStockCell
                          productId={p.id}
                          centerId={activeCenterId!}
                          generalMin={p.minStock}
                          effectiveMin={effectiveMin}
                          onSave={setProductMinStockForCenter}
                        />
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {isLow ? <Badge variant="destructive">Baixo</Badge> : <Badge variant="secondary">OK</Badge>}
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr><td colSpan={isConsolidated ? 5 + filiais.length : 5} className="p-8 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmType !== null} onOpenChange={(v) => !v && !submitting && setConfirmType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              Confirmar {confirmType === 'entrada' ? 'Entrada' : confirmType === 'saida' ? 'Saída' : 'Transferência'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Revise os dados antes de efetivar o lançamento:</p>
                <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                  <div><span className="text-muted-foreground">Produto:</span> <strong>{productName}</strong></div>
                  <div><span className="text-muted-foreground">Quantidade:</span> <strong>{quantity} {productUnit}</strong></div>
                  {confirmType === 'transferencia' ? (
                    <>
                      <div><span className="text-muted-foreground">Origem:</span> <strong>{centerName}</strong></div>
                      <div><span className="text-muted-foreground">Destino:</span> <strong>{destName}</strong></div>
                    </>
                  ) : (
                    <div><span className="text-muted-foreground">Filial:</span> <strong>{centerName}</strong></div>
                  )}
                  {confirmType === 'entrada' && (
                    <div><span className="text-muted-foreground">Valor unitário:</span> <strong>{(parseFloat((unitCost || '0').replace(',', '.')) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
                  )}
                  <div><span className="text-muted-foreground">Data:</span> <strong>{movDate}</strong></div>
                  {reason && <div><span className="text-muted-foreground">Motivo:</span> <strong>{reason}</strong></div>}
                </div>
                <p className="text-xs text-muted-foreground">Esta ação será registrada no histórico.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmExecute(); }} disabled={submitting}>
              {submitting ? 'Registrando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmBatch !== null} onOpenChange={(v) => !v && !submitting && setConfirmBatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              Confirmar fila de {confirmBatch === 'entrada' ? 'Entradas' : confirmBatch === 'saida' ? 'Saídas' : 'Transferências'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  {confirmBatch === 'entrada' && `Serão registradas ${queueIn.length} entrada(s) em sequência.`}
                  {confirmBatch === 'saida' && `Serão registradas ${queueOut.length} saída(s) em sequência.`}
                  {confirmBatch === 'transferencia' && `Serão registradas ${queueTransfer.length} transferência(s) em sequência.`}
                </p>
                <div className="rounded-md border bg-muted/30 p-3 max-h-60 overflow-y-auto space-y-1 text-xs">
                  {confirmBatch === 'entrada' && queueIn.map((it, i) => (
                    <div key={i}>{i + 1}. <strong>{productLabel(it.productId)}</strong> — {it.quantity} {productUnitOf(it.productId)} @ {centerLabel(it.centerId)}</div>
                  ))}
                  {confirmBatch === 'saida' && queueOut.map((it, i) => (
                    <div key={i}>{i + 1}. <strong>{productLabel(it.productId)}</strong> — {it.quantity} {productUnitOf(it.productId)} @ {centerLabel(it.centerId)}</div>
                  ))}
                  {confirmBatch === 'transferencia' && queueTransfer.map((it, i) => (
                    <div key={i}>{i + 1}. <strong>{productLabel(it.productId)}</strong> — {it.quantity} {productUnitOf(it.productId)} · {centerLabel(it.centerId)} → {centerLabel(it.destCenterId)}</div>
                  ))}
                </div>
                {batchProgress && (
                  <p className="text-xs text-muted-foreground">Progresso: {batchProgress.done}/{batchProgress.total}</p>
                )}
                <p className="text-xs text-muted-foreground">Itens com falha (ex.: estoque insuficiente) serão pulados e contabilizados ao final.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); executeBatch(); }} disabled={submitting}>
              {submitting ? `Registrando... ${batchProgress ? `${batchProgress.done}/${batchProgress.total}` : ''}` : 'Confirmar todos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
