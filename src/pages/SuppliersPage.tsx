import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Supplier } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const emptySupplier = { name: '', document: '', contact: '', email: '' };

export default function SuppliersPage() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptySupplier);

  const handleSave = () => {
    if (!form.name) return;
    if (editing) updateSupplier({ ...editing, ...form });
    else addSupplier(form);
    setOpen(false);
    setEditing(null);
    setForm(emptySupplier);
  };

  const handleEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, document: s.document, contact: s.contact, email: s.email });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Fornecedores</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptySupplier); } }}>
          <DialogTrigger asChild>
            <Button><Plus size={16} className="mr-2" />Novo Fornecedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">{editing ? 'Editar' : 'Novo'} Fornecedor</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>CNPJ/CPF</Label><Input value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} /></div>
              <div><Label>Contato</Label><Input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <Button className="w-full" onClick={handleSave}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium">CNPJ/CPF</th>
                <th className="text-left p-3 font-medium">Contato</th>
                <th className="text-left p-3 font-medium">E-mail</th>
                <th className="text-right p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 text-muted-foreground">{s.document || '—'}</td>
                  <td className="p-3">{s.contact || '—'}</td>
                  <td className="p-3 text-muted-foreground">{s.email || '—'}</td>
                  <td className="p-3 text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteSupplier(s.id)}><Trash2 size={14} /></Button>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum fornecedor cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
