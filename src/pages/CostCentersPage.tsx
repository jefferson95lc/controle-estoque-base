import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { CostCenter } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const empty: Omit<CostCenter, 'id'> = { name: '', type: 'filial' };

export default function CostCentersPage() {
  const { costCenters, addCostCenter, updateCostCenter, deleteCostCenter, matrizId } = useApp();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [form, setForm] = useState(empty);

  const reset = () => { setForm(empty); setEditing(null); };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: 'Atenção', description: 'Informe o nome.', variant: 'destructive' });
      return;
    }
    const result = editing
      ? updateCostCenter({ ...editing, ...form })
      : addCostCenter(form);
    if (!result.ok) {
      toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Sucesso', description: editing ? 'Centro de custo atualizado.' : 'Centro de custo criado.' });
    setOpen(false);
    reset();
  };

  const handleEdit = (c: CostCenter) => {
    setEditing(c);
    setForm({ name: c.name, type: c.type });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    const result = deleteCostCenter(id);
    if (!result.ok) {
      toast({ title: 'Erro', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Excluído', description: 'Centro de custo removido.' });
    }
  };

  const hasMatriz = !!matrizId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Centros de Custo</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus size={16} className="mr-2" />Novo Centro de Custo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">{editing ? 'Editar' : 'Novo'} Centro de Custo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input placeholder="Ex: Matriz, Filial 01..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v: 'matriz' | 'filial') => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matriz" disabled={hasMatriz && (!editing || editing.type !== 'matriz')}>
                      Matriz {hasMatriz && (!editing || editing.type !== 'matriz') ? '(já existe)' : ''}
                    </SelectItem>
                    <SelectItem value="filial">Filial</SelectItem>
                  </SelectContent>
                </Select>
                {form.type === 'matriz' && (
                  <p className="text-xs text-muted-foreground mt-1">A Matriz é apenas consolidação. Não é possível movimentar estoque diretamente nela.</p>
                )}
              </div>
              <Button className="w-full" onClick={handleSave}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!hasMatriz && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6 text-sm">
            <strong>Recomendação:</strong> cadastre uma <em>Matriz</em> para visualizar o estoque consolidado de todas as filiais.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium">Tipo</th>
                <th className="text-left p-3 font-medium">ID</th>
                <th className="text-right p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {costCenters.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium flex items-center gap-2">
                    <Building2 size={16} className="text-muted-foreground" />
                    {c.name}
                  </td>
                  <td className="p-3">
                    <Badge variant={c.type === 'matriz' ? 'default' : 'secondary'}>
                      {c.type === 'matriz' ? 'Matriz' : 'Filial'}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground font-mono text-xs">{c.id.slice(0, 8)}</td>
                  <td className="p-3 text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></Button>
                  </td>
                </tr>
              ))}
              {costCenters.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhum centro de custo cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
