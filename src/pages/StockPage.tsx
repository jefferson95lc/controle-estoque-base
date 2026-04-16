import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const OUT_REASONS = ['Venda', 'Perda', 'Uso interno', 'Devolução', 'Outro'];
const IN_REASONS = ['Compra', 'Devolução de cliente', 'Ajuste de inventário', 'Outro'];

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

export default function StockPage() {
  const { products, addStockIn, addStockOut } = useApp();
  const { toast } = useToast();

  const [outOpen, setOutOpen] = useState(false);
  const [inOpen, setInOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [movDate, setMovDate] = useState(todayStr());

  const lowStock = products.filter(p => p.quantity <= p.minStock);

  const resetForm = () => { setProductId(''); setQuantity(1); setReason(''); setMovDate(todayStr()); };

  const handleOut = () => {
    if (!productId || !reason || quantity <= 0) return;
    const ok = addStockOut(productId, quantity, reason);
    if (!ok) {
      toast({ title: 'Erro', description: 'Estoque insuficiente para essa saída.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Sucesso', description: 'Saída registrada com sucesso.' });
    setOutOpen(false);
    resetForm();
  };

  const handleIn = () => {
    if (!productId || !reason || quantity <= 0) return;
    addStockIn(productId, quantity, reason);
    toast({ title: 'Sucesso', description: 'Entrada registrada com sucesso.' });
    setInOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Estoque</h1>
        <div className="flex gap-2">
          <Dialog open={inOpen} onOpenChange={(v) => { setInOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus size={16} className="mr-2" />Entrada Manual</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">Registrar Entrada</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Produto</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.quantity} {p.unit})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Quantidade</Label><Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></div>
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

          <Dialog open={outOpen} onOpenChange={(v) => { setOutOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button variant="outline"><Minus size={16} className="mr-2" />Saída Manual</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">Registrar Saída</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Produto</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.quantity} {p.unit})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Quantidade</Label><Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></div>
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
        </div>
      </div>

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
                  {p.name}: {p.quantity}/{p.minStock}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Produto</th>
                <th className="text-left p-3 font-medium">SKU</th>
                <th className="text-left p-3 font-medium">Categoria</th>
                <th className="text-center p-3 font-medium">Qtd. Atual</th>
                <th className="text-center p-3 font-medium">Mín.</th>
                <th className="text-center p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const isLow = p.quantity <= p.minStock;
                return (
                  <tr key={p.id} className={`border-b last:border-0 transition-colors ${isLow ? 'bg-destructive/5' : 'hover:bg-muted/30'}`}>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{p.sku}</td>
                    <td className="p-3"><Badge variant="secondary">{p.category || '—'}</Badge></td>
                    <td className={`p-3 text-center font-semibold ${isLow ? 'text-destructive' : ''}`}>{p.quantity} {p.unit}</td>
                    <td className="p-3 text-center text-muted-foreground">{p.minStock}</td>
                    <td className="p-3 text-center">
                      {isLow ? <Badge variant="destructive">Baixo</Badge> : <Badge variant="secondary">OK</Badge>}
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
