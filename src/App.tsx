import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/store/AppContext";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import ProductsPage from "@/pages/ProductsPage";
import CostCentersPage from "@/pages/CostCentersPage";
import CategoriesPage from "@/pages/CategoriesPage";
import PurchaseOrderPage from "@/pages/PurchaseOrderPage";
import StockPage from "@/pages/StockPage";
import ReportsPage from "@/pages/ReportsPage";
import UsersPage from "@/pages/UsersPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <AppProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/produtos" element={<ProductsPage />} />
                <Route path="/centros-custo" element={<CostCentersPage />} />
                <Route path="/categorias" element={<CategoriesPage />} />
                <Route path="/ordem-compras" element={<PurchaseOrderPage />} />
                <Route path="/estoque" element={<StockPage />} />
                <Route path="/relatorios" element={<ReportsPage />} />
                <Route path="/usuarios" element={<ProtectedRoute requireMaster><UsersPage /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
