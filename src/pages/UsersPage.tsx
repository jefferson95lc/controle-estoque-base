import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface UserRow {
  id: string;
  email: string;
  active: boolean;
  role: "master" | "comum";
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("id, email, active");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const list: UserRow[] = (profiles ?? []).map((p) => ({
      id: p.id, email: p.email, active: p.active,
      role: (roles?.find((r) => r.user_id === p.id)?.role ?? "comum") as "master" | "comum",
    }));
    setUsers(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const callAdmin = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-users", { body: payload });
    if (error || data?.error) {
      toast({ title: "Erro", description: data?.error ?? error?.message, variant: "destructive" });
      return false;
    }
    return true;
  };

  const onCreate = async (email: string, password: string) => {
    if (await callAdmin({ action: "create", email, password })) {
      toast({ title: "Usuário criado" });
      setCreateOpen(false);
      load();
    }
  };

  const onUpdate = async (userId: string, email: string, active: boolean) => {
    if (await callAdmin({ action: "update", userId, email, active })) {
      toast({ title: "Usuário atualizado" });
      setEditing(null);
      load();
    }
  };

  const onResetPassword = async (userId: string, password: string) => {
    if (await callAdmin({ action: "update", userId, password })) {
      toast({ title: "Senha redefinida" });
      setResetting(null);
    }
  };

  const onDelete = async (userId: string) => {
    if (!confirm("Excluir este usuário? Esta ação é permanente.")) return;
    if (await callAdmin({ action: "delete", userId })) {
      toast({ title: "Usuário excluído" });
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">Gerenciamento de Usuários</h2>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie quem acessa o sistema.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus size={16} /> Novo usuário</Button>
          </DialogTrigger>
          <CreateDialog onSubmit={onCreate} />
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum usuário</TableCell></TableRow>
            ) : users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "master" ? "default" : "secondary"}>
                    {u.role === "master" ? "Master" : "Comum"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.active ? "outline" : "destructive"}>
                    {u.active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(u)}><Pencil size={16} /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setResetting(u)}><KeyRound size={16} /></Button>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(u.id)} disabled={u.id === currentUser?.id}>
                    <Trash2 size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {editing && <EditDialog user={editing} onClose={() => setEditing(null)} onSubmit={onUpdate} />}
      {resetting && <ResetDialog user={resetting} onClose={() => setResetting(null)} onSubmit={onResetPassword} />}
    </div>
  );
}

function CreateDialog({ onSubmit }: { onSubmit: (email: string, password: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(email, password)} disabled={!email || password.length < 6}>Criar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditDialog({ user, onClose, onSubmit }: { user: UserRow; onClose: () => void; onSubmit: (id: string, email: string, active: boolean) => void }) {
  const [email, setEmail] = useState(user.email);
  const [active, setActive] = useState(user.active);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Usuário ativo
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSubmit(user.id, email, active)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({ user, onClose, onSubmit }: { user: UserRow; onClose: () => void; onSubmit: (id: string, password: string) => void }) {
  const [password, setPassword] = useState("");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Redefinir senha — {user.email}</DialogTitle></DialogHeader>
        <div className="space-y-1.5"><Label>Nova senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSubmit(user.id, password)} disabled={password.length < 6}>Redefinir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
