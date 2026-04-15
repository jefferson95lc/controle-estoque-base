import { NavLink, Outlet } from 'react-router-dom';
import { Package, Users, ShoppingCart, Warehouse, BarChart3, LayoutDashboard } from 'lucide-react';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/produtos', icon: Package, label: 'Produtos' },
  { to: '/fornecedores', icon: Users, label: 'Fornecedores' },
  { to: '/compras', icon: ShoppingCart, label: 'Compras' },
  { to: '/estoque', icon: Warehouse, label: 'Estoque' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
];

export default function AppLayout() {
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
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
