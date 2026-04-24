import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, AlertTriangle, ArrowLeftRight, Building2 } from 'lucide-react';
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
  };

  const openIn = () => {
    if (filiais.length === 0) {
      toast({ title: 'Atenção', description: 'Cadastre uma filial antes de movimentar estoque.', variant: 'destructive' });
      return;
    }
    setCenterId(activeCenterId && activeCenterId !== matrizId ? activeCenterId : '');
    setInOpen(true);
  };
  const openOut = () => {
    if (filiais.length === 0) {
      toast({ title: 'Atenção', description: 'Cadastre uma filial antes de movimentar estoque.', variant: 'destructive' });
      return;
    }
    setCenterId(activeCenterId && activeCenterId !== matrizId ? activeCenterId : '');
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

  const handleIn = async () => {
    if (!productId || !reason || quantity <= 0 || !centerId) return;
    const dateISO = movDate ? new Date(movDate + 'T12:00:00').toISOString() : undefined;
    const ok = await addStockIn(productId, quantity, reason, centerId, dateISO);
    if (!ok) { toast({ title: 'Erro', description: 'Não foi possível registrar.', variant: 'destructive' }); return; }
    toast({ title: 'Sucesso', description: 'Entrada registrada.' });
    setInOpen(false); resetForm();
  };

  const handleOut = async () => {
    if (!productId || !reason || quantity <= 0 || !centerId) return;
    const dateISO = movDate ? new Date(movDate + 'T12:00:00').toISOString() : undefined;
    const ok = await addStockOut(productId, quantity, reason, centerId, dateISO);
    if (!ok) { toast({ title: 'Erro', description: 'Estoque insuficiente nessa filial.', variant: 'destructive' }); return; }
    toast({ title: 'Sucesso', description: 'Saída registrada.' });
    setOutOpen(false); resetForm();
  };

  const handleTransfer = async () => {
    if (!productId || !centerId || !destCenterId || centerId === destCenterId || quantity <= 0) return;
    const dateISO = movDate ? new Date(movDate + 'T12:00:00').toISOString() : undefined;
    const ok = await transferStock(productId, quantity, centerId, destCenterId, reason, dateISO);
    if (!ok) { toast({ title: 'Erro', description: 'Estoque insuficiente na filial de origem.', variant: 'destructive' }); return; }
    toast({ title: 'Sucesso', description: 'Transferência registrada.' });
    setTransferOpen(false); resetForm();
  };

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
      <Dialog open={inOpen} onOpenChange={(v) => { setInOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
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
            <div>
              <Label>Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{IN_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleIn}>Registrar Entrada</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Saída */}
      <Dialog open={outOpen} onOpenChange={(v) => { setOutOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
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
            <Button className="w-full" onClick={handleOut}>Registrar Saída</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transferência */}
      <Dialog open={transferOpen} onOpenChange={(v) => { setTransferOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
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
            <Button className="w-full" onClick={handleTransfer}>Registrar Transferência</Button>
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
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Produto</th>
                <th className="text-left p-3 font-medium">SKU</th>
                <th className="text-center p-3 font-medium">
                  {isConsolidated ? 'Consolidado' : viewingCenter?.name}
                </th>
                {isConsolidated && filiais.map(f => (
                  <th key={f.id} className="text-center p-3 font-medium text-xs text-muted-foreground">{f.name}</th>
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
        </CardContent>
      </Card>
    </div>
  );
}
