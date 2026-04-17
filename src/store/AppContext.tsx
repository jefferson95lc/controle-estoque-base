import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Product, StockMovement, CostCenter } from '@/types';

type StockMap = Record<string, Record<string, number>>; // productId -> costCenterId -> qty

interface AppState {
  products: Product[];
  movements: StockMovement[];
  costCenters: CostCenter[];
  stockByCenter: StockMap;

  // active context
  activeCenterId: string | null; // null = consolidado (matriz)
  setActiveCenterId: (id: string | null) => void;

  // products
  addProduct: (p: Omit<Product, 'id'>) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;

  // cost centers
  addCostCenter: (c: Omit<CostCenter, 'id'>) => { ok: boolean; error?: string };
  updateCostCenter: (c: CostCenter) => { ok: boolean; error?: string };
  deleteCostCenter: (id: string) => { ok: boolean; error?: string };

  // stock movements
  addStockIn: (productId: string, quantity: number, reason: string, costCenterId: string, date?: string) => boolean;
  addStockOut: (productId: string, quantity: number, reason: string, costCenterId: string, date?: string) => boolean;
  transferStock: (productId: string, quantity: number, fromId: string, toId: string, reason: string, date?: string) => boolean;

  // helpers
  getStock: (productId: string, costCenterId: string | null) => number;
  matrizId: string | null;
  filiais: CostCenter[];
}

const AppContext = createContext<AppState | null>(null);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch { return fallback; }
}

function uid() {
  return crypto.randomUUID();
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(() => loadFromStorage('products_v2', []));
  const [movements, setMovements] = useState<StockMovement[]>(() => loadFromStorage('movements_v2', []));
  const [costCenters, setCostCenters] = useState<CostCenter[]>(() => loadFromStorage('costCenters', []));
  const [stockByCenter, setStockByCenter] = useState<StockMap>(() => loadFromStorage('stockByCenter', {}));
  const [activeCenterId, setActiveCenterId] = useState<string | null>(() => loadFromStorage<string | null>('activeCenterId', null));

  useEffect(() => { localStorage.setItem('products_v2', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('movements_v2', JSON.stringify(movements)); }, [movements]);
  useEffect(() => { localStorage.setItem('costCenters', JSON.stringify(costCenters)); }, [costCenters]);
  useEffect(() => { localStorage.setItem('stockByCenter', JSON.stringify(stockByCenter)); }, [stockByCenter]);
  useEffect(() => { localStorage.setItem('activeCenterId', JSON.stringify(activeCenterId)); }, [activeCenterId]);

  const matriz = useMemo(() => costCenters.find(c => c.type === 'matriz') || null, [costCenters]);
  const filiais = useMemo(() => costCenters.filter(c => c.type === 'filial'), [costCenters]);

  // ===== Products =====
  const addProduct = (p: Omit<Product, 'id'>) => setProducts(prev => [...prev, { ...p, id: uid() }]);
  const updateProduct = (p: Product) => setProducts(prev => prev.map(x => x.id === p.id ? p : x));
  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(x => x.id !== id));
    setStockByCenter(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // ===== Cost Centers =====
  const addCostCenter = (c: Omit<CostCenter, 'id'>) => {
    if (c.type === 'matriz' && costCenters.some(x => x.type === 'matriz')) {
      return { ok: false, error: 'Já existe uma Matriz cadastrada.' };
    }
    setCostCenters(prev => [...prev, { ...c, id: uid() }]);
    return { ok: true };
  };

  const updateCostCenter = (c: CostCenter) => {
    if (c.type === 'matriz' && costCenters.some(x => x.type === 'matriz' && x.id !== c.id)) {
      return { ok: false, error: 'Já existe uma Matriz cadastrada.' };
    }
    setCostCenters(prev => prev.map(x => x.id === c.id ? c : x));
    return { ok: true };
  };

  const deleteCostCenter = (id: string) => {
    const center = costCenters.find(c => c.id === id);
    if (!center) return { ok: false, error: 'Centro de custo não encontrado.' };
    const hasStock = Object.values(stockByCenter).some(byC => (byC[id] || 0) > 0);
    if (hasStock) return { ok: false, error: 'Existe estoque neste centro de custo. Zere antes de excluir.' };
    setCostCenters(prev => prev.filter(c => c.id !== id));
    if (activeCenterId === id) setActiveCenterId(null);
    return { ok: true };
  };

  // ===== Stock helpers =====
  const getStock = (productId: string, costCenterId: string | null): number => {
    const byCenter = stockByCenter[productId] || {};
    if (!costCenterId || (matriz && costCenterId === matriz.id)) {
      // Consolidated: sum across all filiais
      return filiais.reduce((sum, f) => sum + (byCenter[f.id] || 0), 0);
    }
    return byCenter[costCenterId] || 0;
  };

  const isFilial = (id: string) => filiais.some(f => f.id === id);

  const adjust = (productId: string, costCenterId: string, delta: number) => {
    setStockByCenter(prev => {
      const productMap = { ...(prev[productId] || {}) };
      productMap[costCenterId] = (productMap[costCenterId] || 0) + delta;
      return { ...prev, [productId]: productMap };
    });
  };

  // ===== Movements =====
  const addStockIn = (productId: string, quantity: number, reason: string, costCenterId: string, date?: string): boolean => {
    if (!isFilial(costCenterId)) return false;
    adjust(productId, costCenterId, quantity);
    setMovements(prev => [...prev, {
      id: uid(), productId, type: 'entrada', quantity, reason,
      date: date || new Date().toISOString(), costCenterId,
    }]);
    return true;
  };

  const addStockOut = (productId: string, quantity: number, reason: string, costCenterId: string, date?: string): boolean => {
    if (!isFilial(costCenterId)) return false;
    const current = (stockByCenter[productId]?.[costCenterId]) || 0;
    if (current < quantity) return false;
    adjust(productId, costCenterId, -quantity);
    setMovements(prev => [...prev, {
      id: uid(), productId, type: 'saida', quantity, reason,
      date: date || new Date().toISOString(), costCenterId,
    }]);
    return true;
  };

  const transferStock = (productId: string, quantity: number, fromId: string, toId: string, reason: string, date?: string): boolean => {
    if (!isFilial(fromId) || !isFilial(toId) || fromId === toId) return false;
    const current = (stockByCenter[productId]?.[fromId]) || 0;
    if (current < quantity) return false;
    setStockByCenter(prev => {
      const productMap = { ...(prev[productId] || {}) };
      productMap[fromId] = (productMap[fromId] || 0) - quantity;
      productMap[toId] = (productMap[toId] || 0) + quantity;
      return { ...prev, [productId]: productMap };
    });
    setMovements(prev => [...prev, {
      id: uid(), productId, type: 'transferencia', quantity,
      reason: reason || 'Transferência entre unidades',
      date: date || new Date().toISOString(),
      costCenterId: fromId, destinationCenterId: toId,
    }]);
    return true;
  };

  return (
    <AppContext.Provider value={{
      products, movements, costCenters, stockByCenter,
      activeCenterId, setActiveCenterId,
      addProduct, updateProduct, deleteProduct,
      addCostCenter, updateCostCenter, deleteCostCenter,
      addStockIn, addStockOut, transferStock,
      getStock,
      matrizId: matriz?.id || null,
      filiais,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
