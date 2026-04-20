import { NavLink, Outlet } from 'react-router-dom';
import { Package, FileSpreadsheet, Warehouse, BarChart3, LayoutDashboard, Building2, Tags, Users, LogOut } from 'lucide-react';
import CostCenterSelector from './CostCenterSelector';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

const baseLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/produtos', icon: Package, label: 'Produtos' },
  { to: '/categorias', icon: Tags, label: 'Categorias' },
  { to: '/centros-custo', icon: Building2, label: 'Centros de Custo' },
  { to: '/estoque', icon: Warehouse, label: 'Estoque' },
  { to: '/ordem-compras', icon: FileSpreadsheet, label: 'Ordem de Compras' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
];

export default function AppLayout() {
  const { isMaster, signOut, user } = useAuth();
  const links = isMaster
    ? [...baseLinks, { to: '/usuarios', icon: Users, label: 'Usuários' }]
    : baseLinks;
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <h1 className="font-heading text-lg font-bold text-sidebar-primary-foreground tracking-tight">
            📦 GestãoPro
          </h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="h-14 shrink-0 border-b bg-background flex items-center justify-end px-6 gap-4">
          <span className="text-xs text-muted-foreground">Operando em:</span>
          <CostCenterSelector />
          <div className="h-6 w-px bg-border" />
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button size="sm" variant="ghost" onClick={signOut}>
            <LogOut size={16} /> Sair
          </Button>
        </header>
        <div className="p-6 max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
