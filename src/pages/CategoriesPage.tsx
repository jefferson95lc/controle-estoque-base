import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Category } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tags, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const empty: Omit<Category, 'id'> = { name: '', active: true };

export default function CategoriesPage() {
  const { categories, addCategory, updateCategory, deleteCategory } = useApp();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState('');

  const reset = () => { setForm(empty); setEditing(null); };

  const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Atenção', description: 'Informe o nome.', variant: 'destructive' });
      return;
    }
    const result = editing
      ? await updateCategory({ ...editing, ...form })
      : await addCategory(form);
    if (!result.ok) {
      toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Sucesso', description: editing ? 'Categoria atualizada.' : 'Categoria criada.' });
    setOpen(false);
    reset();
  };

  const handleEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, active: c.active });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteCategory(id);
    if (!result.ok) {
      toast({ title: 'Erro', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Excluída', description: 'Categoria removida.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Categorias</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus size={16} className="mr-2" />Nova Categoria</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">{editing ? 'Editar' : 'Nova'} Categoria</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input placeholder="Ex: Matéria-prima" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Status</Label>
                  <p className="text-xs text-muted-foreground">Apenas categorias ativas aparecem no cadastro de produtos.</p>
                </div>
                <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
              </div>
              <Button className="w-full" onClick={handleSave}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar categoria..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium flex items-center gap-2">
                    <Tags size={16} className="text-muted-foreground" />
                    {c.name}
                  </td>
                  <td className="p-3">
                    <Badge variant={c.active ? 'default' : 'secondary'}>
                      {c.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Nenhuma categoria encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
