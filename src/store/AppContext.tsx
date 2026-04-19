import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';
import { Product, StockMovement, CostCenter, Category } from '@/types';

type StockMap = Record<string, Record<string, number>>; // productId -> costCenterId -> qty

interface AppState {
  products: Product[];
  movements: StockMovement[];
  costCenters: CostCenter[];
  categories: Category[];
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

  // categories
  addCategory: (c: Omit<Category, 'id'>) => { ok: boolean; error?: string };
  updateCategory: (c: Category) => { ok: boolean; error?: string };
  deleteCategory: (id: string) => { ok: boolean; error?: string };

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

const KEYS = {
  products: 'products_v2',
  movements: 'movements_v2',
  costCenters: 'costCenters',
  stockByCenter: 'stockByCenter',
  activeCenterId: 'activeCenterId',
  categories: 'categories',
} as const;

function safeGet<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    if (data === null) return fallback;
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('[AppContext] Falha ao salvar', key, err);
  }
}

function uid() {
  return crypto.randomUUID();
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-materia-prima', name: 'Matéria-prima', active: true },
  { id: 'cat-embalagem', name: 'Embalagem', active: true },
  { id: 'cat-insumo', name: 'Insumo', active: true },
  { id: 'cat-produto-acabado', name: 'Produto acabado', active: true },
  { id: 'cat-outros', name: 'Outros', active: true },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [products, setProductsState] = useState<Product[]>(() => safeGet(KEYS.products, []));
  const [movements, setMovementsState] = useState<StockMovement[]>(() => safeGet(KEYS.movements, []));
  const [costCenters, setCostCentersState] = useState<CostCenter[]>(() => safeGet(KEYS.costCenters, []));
  const [stockByCenter, setStockByCenterState] = useState<StockMap>(() => safeGet(KEYS.stockByCenter, {}));
  const [activeCenterId, setActiveCenterIdState] = useState<string | null>(() => safeGet<string | null>(KEYS.activeCenterId, null));
  const [categories, setCategoriesState] = useState<Category[]>(() => safeGet<Category[]>(KEYS.categories, DEFAULT_CATEGORIES));

  // Setters that persist SYNCHRONOUSLY (no useEffect race conditions)
  const setProducts = useCallback((updater: React.SetStateAction<Product[]>) => {
    setProductsState(prev => {
      const next = typeof updater === 'function' ? (updater as (p: Product[]) => Product[])(prev) : updater;
      safeSet(KEYS.products, next);
      return next;
    });
  }, []);

  const setMovements = useCallback((updater: React.SetStateAction<StockMovement[]>) => {
    setMovementsState(prev => {
      const next = typeof updater === 'function' ? (updater as (p: StockMovement[]) => StockMovement[])(prev) : updater;
      safeSet(KEYS.movements, next);
      return next;
    });
  }, []);

  const setCostCenters = useCallback((updater: React.SetStateAction<CostCenter[]>) => {
    setCostCentersState(prev => {
      const next = typeof updater === 'function' ? (updater as (p: CostCenter[]) => CostCenter[])(prev) : updater;
      safeSet(KEYS.costCenters, next);
      return next;
    });
  }, []);

  const setStockByCenter = useCallback((updater: React.SetStateAction<StockMap>) => {
    setStockByCenterState(prev => {
      const next = typeof updater === 'function' ? (updater as (p: StockMap) => StockMap)(prev) : updater;
      safeSet(KEYS.stockByCenter, next);
      return next;
    });
  }, []);

  const setActiveCenterId = useCallback((id: string | null) => {
    setActiveCenterIdState(id);
    safeSet(KEYS.activeCenterId, id);
  }, []);

  const setCategories = useCallback((updater: React.SetStateAction<Category[]>) => {
    setCategoriesState(prev => {
      const next = typeof updater === 'function' ? (updater as (p: Category[]) => Category[])(prev) : updater;
      safeSet(KEYS.categories, next);
      return next;
    });
  }, []);

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

  // ===== Categories =====
  const addCategory = (c: Omit<Category, 'id'>) => {
    const name = c.name.trim();
    if (!name) return { ok: false, error: 'Nome obrigatório.' };
    if (categories.some(x => x.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: 'Já existe uma categoria com esse nome.' };
    }
    setCategories(prev => [...prev, { ...c, name, id: uid() }]);
    return { ok: true };
  };

  const updateCategory = (c: Category) => {
    const name = c.name.trim();
    if (!name) return { ok: false, error: 'Nome obrigatório.' };
    if (categories.some(x => x.id !== c.id && x.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: 'Já existe uma categoria com esse nome.' };
    }
    const old = categories.find(x => x.id === c.id);
    setCategories(prev => prev.map(x => x.id === c.id ? { ...c, name } : x));
    if (old && old.name !== name) {
      setProducts(prev => prev.map(p => p.category === old.name ? { ...p, category: name } : p));
    }
    return { ok: true };
  };

  const deleteCategory = (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return { ok: false, error: 'Categoria não encontrada.' };
    const inUse = products.some(p => p.category === cat.name);
    if (inUse) return { ok: false, error: 'Categoria vinculada a produtos. Inative-a em vez de excluir.' };
    setCategories(prev => prev.filter(c => c.id !== id));
    return { ok: true };
  };

  // ===== Stock helpers =====
  const getStock = (productId: string, costCenterId: string | null): number => {
    const byCenter = stockByCenter[productId] || {};
    if (!costCenterId || (matriz && costCenterId === matriz.id)) {
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
      products, movements, costCenters, categories, stockByCenter,
      activeCenterId, setActiveCenterId,
      addProduct, updateProduct, deleteProduct,
      addCostCenter, updateCostCenter, deleteCostCenter,
      addCategory, updateCategory, deleteCategory,
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
