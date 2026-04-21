import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductBulkImport } from '@/components/ProductBulkImport';

const UNITS = ['UN', 'KG', 'CX', 'L', 'M', 'PCT'];

const emptyProduct: Omit<Product, 'id'> = { name: '', sku: '', category: '', unit: 'UN', minStock: 0 };

export default function ProductsPage() {
  const { products, addProduct, updateProduct, deleteProduct, getStock, activeCenterId, categories } = useApp();
  const activeCategories = categories.filter(c => c.active);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!form.name || !form.sku) return;
    if (editing) {
      await updateProduct({ ...editing, ...form });
    } else {
      await addProduct(form);
    }
    setOpen(false);
    setEditing(null);
    setForm(emptyProduct);
  };

  const handleEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku, category: p.category, unit: p.unit, minStock: p.minStock });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Produtos</h1>
        <div className="flex items-center gap-2">
        <ProductBulkImport />
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyProduct); } }}>
          <DialogTrigger asChild>
            <Button><Plus size={16} className="mr-2" />Novo Produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder={activeCategories.length ? 'Selecione' : 'Cadastre categorias primeiro'} /></SelectTrigger>
                    <SelectContent>
                      {activeCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      {form.category && !activeCategories.some(c => c.name === form.category) && (
                        <SelectItem value={form.category}>{form.category} (inativa)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Estoque Mínimo</Label>
                <Input type="number" value={form.minStock} onChange={e => setForm({ ...form, minStock: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground mt-1">As quantidades em estoque são gerenciadas por filial na tela de Estoque.</p>
              </div>
              <Button className="w-full" onClick={handleSave}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou SKU..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium">SKU</th>
                <th className="text-left p-3 font-medium">Categoria</th>
                <th className="text-center p-3 font-medium">Estoque {activeCenterId ? '(filial)' : '(consolidado)'}</th>
                <th className="text-center p-3 font-medium">Mín.</th>
                <th className="text-right p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const qty = getStock(p.id, activeCenterId);
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-muted-foreground">{p.sku}</td>
                    <td className="p-3"><Badge variant="secondary">{p.category || '—'}</Badge></td>
                    <td className="p-3 text-center">
                      <span className={qty <= p.minStock ? 'text-destructive font-semibold' : ''}>
                        {qty} {p.unit}
                      </span>
                    </td>
                    <td className="p-3 text-center text-muted-foreground">{p.minStock}</td>
                    <td className="p-3 text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteProduct(p.id)}><Trash2 size={14} /></Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
