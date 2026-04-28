import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback, useEffect } from 'react';
import { Product, StockMovement, CostCenter, Category, ProductMinStock } from '@/types';
import { supabase } from '@/integrations/supabase/client';

type StockMap = Record<string, Record<string, number>>; // productId -> costCenterId -> qty
type MinStockMap = Record<string, Record<string, number>>; // productId -> costCenterId -> minStock

interface AppState {
  products: Product[];
  movements: StockMovement[];
  costCenters: CostCenter[];
  categories: Category[];
  stockByCenter: StockMap;
  loading: boolean;

  activeCenterId: string | null;
  setActiveCenterId: (id: string | null) => void;

  addProduct: (p: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (p: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  addCostCenter: (c: Omit<CostCenter, 'id'>) => Promise<{ ok: boolean; error?: string }>;
  updateCostCenter: (c: CostCenter) => Promise<{ ok: boolean; error?: string }>;
  deleteCostCenter: (id: string) => Promise<{ ok: boolean; error?: string }>;

  addCategory: (c: Omit<Category, 'id'>) => Promise<{ ok: boolean; error?: string }>;
  updateCategory: (c: Category) => Promise<{ ok: boolean; error?: string }>;
  deleteCategory: (id: string) => Promise<{ ok: boolean; error?: string }>;

  addStockIn: (productId: string, quantity: number, reason: string, costCenterId: string, date?: string, unitCost?: number) => Promise<boolean>;
  addStockOut: (productId: string, quantity: number, reason: string, costCenterId: string, date?: string) => Promise<boolean>;
  transferStock: (productId: string, quantity: number, fromId: string, toId: string, reason: string, date?: string) => Promise<boolean>;

  getStock: (productId: string, costCenterId: string | null) => number;
  getMinStock: (productId: string, costCenterId: string | null) => number;
  setProductMinStockForCenter: (productId: string, costCenterId: string, minStock: number | null) => Promise<boolean>;
  clearAllMovements: () => Promise<{ ok: boolean; error?: string }>;
  matrizId: string | null;
  filiais: CostCenter[];
  isMaster: boolean;
}

const AppContext = createContext<AppState | null>(null);

function buildStockMap(movements: StockMovement[]): StockMap {
  const map: StockMap = {};
  for (const m of movements) {
    if (!map[m.productId]) map[m.productId] = {};
    const pm = map[m.productId];
    if (m.type === 'entrada') {
      pm[m.costCenterId] = (pm[m.costCenterId] || 0) + m.quantity;
    } else if (m.type === 'saida') {
      pm[m.costCenterId] = (pm[m.costCenterId] || 0) - m.quantity;
    } else if (m.type === 'transferencia') {
      pm[m.costCenterId] = (pm[m.costCenterId] || 0) - m.quantity;
      if (m.destinationCenterId) {
        pm[m.destinationCenterId] = (pm[m.destinationCenterId] || 0) + m.quantity;
      }
    }
  }
  return map;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [minStockByCenter, setMinStockByCenter] = useState<MinStockMap>({});
  const [activeCenterId, setActiveCenterId] = useState<string | null>(null);
  const [isMaster, setIsMaster] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const stockByCenter = useMemo(() => buildStockMap(movements), [movements]);

  const matriz = useMemo(() => costCenters.find(c => c.type === 'matriz') || null, [costCenters]);
  const filiais = useMemo(() => costCenters.filter(c => c.type === 'filial'), [costCenters]);

  // ===== Load from DB =====
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) {
        setLoading(false);
        return;
      }

      const userId = session.user.id;

      // Check if user is master
      const { data: isMasterData } = await supabase.rpc("has_role", {
        _user_id: userId, _role: "master",
      });
      const userIsMaster = !!isMasterData;
      setIsMaster(userIsMaster);

      // Load user's allowed cost centers (for non-master)
      let allowedCenterIds: string[] | null = null;
      if (!userIsMaster) {
        const { data: ucData } = await supabase.from('user_cost_centers').select('cost_center_id').eq('user_id', userId);
        if (ucData && ucData.length > 0) {
          allowedCenterIds = ucData.map(r => r.cost_center_id);
        }
      }

      // Helper to fetch ALL rows bypassing the default 1000-row limit
      async function fetchAll<T = any>(table: any, build?: (q: any) => any): Promise<T[]> {
        const pageSize = 1000;
        let from = 0;
        const all: T[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          let q: any = (supabase.from(table) as any).select('*').range(from, from + pageSize - 1);
          if (build) q = build(q);
          const { data, error } = await q;
          if (error) { console.error(`fetchAll(${table})`, error); break; }
          if (!data || data.length === 0) break;
          all.push(...(data as T[]));
          if (data.length < pageSize) break;
          from += pageSize;
        }
        return all;
      }

      const [catData, ccData, prodData, movData, minData] = await Promise.all([
        fetchAll('categories', q => q.order('name')),
        fetchAll('cost_centers', q => q.order('name')),
        fetchAll('products', q => q.order('name')),
        fetchAll('stock_movements', q => q.order('date', { ascending: true })),
        fetchAll('product_min_stock'),
      ]);
      const catRes = { data: catData } as any;
      const ccRes = { data: ccData } as any;
      const prodRes = { data: prodData } as any;
      const movRes = { data: movData } as any;
      const minRes = { data: minData } as any;
      if (cancelled) return;

      if (catRes.data) setCategories(catRes.data.map(r => ({ id: r.id, name: r.name, active: r.active })));
      
      if (ccRes.data) {
        let allCenters = ccRes.data.map(r => ({ id: r.id, name: r.name, type: r.type as 'matriz' | 'filial' }));
        // Filter filiais for non-master users with assigned centers
        if (allowedCenterIds) {
          allCenters = allCenters.filter(c => c.type === 'matriz' || allowedCenterIds!.includes(c.id));
        }
        setCostCenters(allCenters);
      }

      if (prodRes.data) setProducts(prodRes.data.map(r => ({ id: r.id, name: r.name, sku: r.sku, category: r.category, unit: r.unit, minStock: r.min_stock })));
      if (movRes.data) setMovements(movRes.data.map(r => ({
        id: r.id, productId: r.product_id, type: r.type as StockMovement['type'],
        quantity: r.quantity, reason: r.reason, date: r.date,
        costCenterId: r.cost_center_id, destinationCenterId: r.destination_center_id || undefined,
        userId: (r as any).user_id || undefined,
        unitCost: (r as any).unit_cost != null ? Number((r as any).unit_cost) : undefined,
      })));
      if (minRes.data) {
        const map: MinStockMap = {};
        for (const r of minRes.data as any[]) {
          if (!map[r.product_id]) map[r.product_id] = {};
          map[r.product_id][r.cost_center_id] = r.min_stock;
        }
        setMinStockByCenter(map);
      }
      setLoading(false);
    }

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setLoading(true);
        load();
      } else if (event === 'SIGNED_OUT') {
        setProducts([]);
        setMovements([]);
        setCostCenters([]);
        setCategories([]);
        setMinStockByCenter({});
        setLoading(false);
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  // ===== Products =====
  const addProduct = useCallback(async (p: Omit<Product, 'id'>) => {
    const { data, error } = await supabase.from('products').insert({
      name: p.name, sku: p.sku, category: p.category, unit: p.unit, min_stock: p.minStock,
    }).select().single();
    if (error) { console.error(error); return; }
    setProducts(prev => [...prev, { id: data.id, name: data.name, sku: data.sku, category: data.category, unit: data.unit, minStock: data.min_stock }]);
  }, []);

  const updateProduct = useCallback(async (p: Product) => {
    const { error } = await supabase.from('products').update({
      name: p.name, sku: p.sku, category: p.category, unit: p.unit, min_stock: p.minStock,
    }).eq('id', p.id);
    if (error) { console.error(error); return; }
    setProducts(prev => prev.map(x => x.id === p.id ? p : x));
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { console.error(error); return; }
    setProducts(prev => prev.filter(x => x.id !== id));
    setMovements(prev => prev.filter(m => m.productId !== id));
  }, []);

  // ===== Cost Centers =====
  const addCostCenter = useCallback(async (c: Omit<CostCenter, 'id'>): Promise<{ ok: boolean; error?: string }> => {
    if (c.type === 'matriz' && costCenters.some(x => x.type === 'matriz')) {
      return { ok: false, error: 'Já existe uma Matriz cadastrada.' };
    }
    const { data, error } = await supabase.from('cost_centers').insert({ name: c.name, type: c.type }).select().single();
    if (error) return { ok: false, error: error.message };
    setCostCenters(prev => [...prev, { id: data.id, name: data.name, type: data.type as 'matriz' | 'filial' }]);
    return { ok: true };
  }, [costCenters]);

  const updateCostCenter = useCallback(async (c: CostCenter): Promise<{ ok: boolean; error?: string }> => {
    if (c.type === 'matriz' && costCenters.some(x => x.type === 'matriz' && x.id !== c.id)) {
      return { ok: false, error: 'Já existe uma Matriz cadastrada.' };
    }
    const { error } = await supabase.from('cost_centers').update({ name: c.name, type: c.type }).eq('id', c.id);
    if (error) return { ok: false, error: error.message };
    setCostCenters(prev => prev.map(x => x.id === c.id ? c : x));
    return { ok: true };
  }, [costCenters]);

  const deleteCostCenter = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const center = costCenters.find(c => c.id === id);
    if (!center) return { ok: false, error: 'Centro de custo não encontrado.' };
    const hasStock = Object.values(stockByCenter).some(byC => (byC[id] || 0) > 0);
    if (hasStock) return { ok: false, error: 'Existe estoque neste centro de custo. Zere antes de excluir.' };
    const { error } = await supabase.from('cost_centers').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    setCostCenters(prev => prev.filter(c => c.id !== id));
    if (activeCenterId === id) setActiveCenterId(null);
    return { ok: true };
  }, [costCenters, stockByCenter, activeCenterId]);

  // ===== Categories =====
  const addCategory = useCallback(async (c: Omit<Category, 'id'>): Promise<{ ok: boolean; error?: string }> => {
    const name = c.name.trim();
    if (!name) return { ok: false, error: 'Nome obrigatório.' };
    if (categories.some(x => x.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: 'Já existe uma categoria com esse nome.' };
    }
    const { data, error } = await supabase.from('categories').insert({ name, active: c.active }).select().single();
    if (error) return { ok: false, error: error.message };
    setCategories(prev => [...prev, { id: data.id, name: data.name, active: data.active }]);
    return { ok: true };
  }, [categories]);

  const updateCategory = useCallback(async (c: Category): Promise<{ ok: boolean; error?: string }> => {
    const name = c.name.trim();
    if (!name) return { ok: false, error: 'Nome obrigatório.' };
    if (categories.some(x => x.id !== c.id && x.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: 'Já existe uma categoria com esse nome.' };
    }
    const old = categories.find(x => x.id === c.id);
    const { error } = await supabase.from('categories').update({ name, active: c.active }).eq('id', c.id);
    if (error) return { ok: false, error: error.message };
    setCategories(prev => prev.map(x => x.id === c.id ? { ...c, name } : x));
    // Update products referencing old category name
    if (old && old.name !== name) {
      await supabase.from('products').update({ category: name }).eq('category', old.name);
      setProducts(prev => prev.map(p => p.category === old.name ? { ...p, category: name } : p));
    }
    return { ok: true };
  }, [categories]);

  const deleteCategory = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return { ok: false, error: 'Categoria não encontrada.' };
    const inUse = products.some(p => p.category === cat.name);
    if (inUse) return { ok: false, error: 'Categoria vinculada a produtos. Inative-a em vez de excluir.' };
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    setCategories(prev => prev.filter(c => c.id !== id));
    return { ok: true };
  }, [categories, products]);

  // ===== Stock helpers =====
  const getStock = useCallback((productId: string, costCenterId: string | null): number => {
    const byCenter = stockByCenter[productId] || {};
    if (!costCenterId || (matriz && costCenterId === matriz.id)) {
      return filiais.reduce((sum, f) => sum + (byCenter[f.id] || 0), 0);
    }
    return byCenter[costCenterId] || 0;
  }, [stockByCenter, matriz, filiais]);

  // ===== Min stock per center =====
  const getMinStock = useCallback((productId: string, costCenterId: string | null): number => {
    const product = products.find(p => p.id === productId);
    const generalMin = product?.minStock || 0;
    if (!costCenterId || (matriz && costCenterId === matriz.id)) {
      // Consolidated: sum of per-filial mins (fallback to general for those without override)
      const byCenter = minStockByCenter[productId] || {};
      return filiais.reduce((sum, f) => sum + (byCenter[f.id] ?? generalMin), 0);
    }
    const specific = minStockByCenter[productId]?.[costCenterId];
    return specific ?? generalMin;
  }, [minStockByCenter, products, matriz, filiais]);

  const setProductMinStockForCenter = useCallback(async (productId: string, costCenterId: string, minStock: number | null): Promise<boolean> => {
    if (minStock === null) {
      const { error } = await supabase.from('product_min_stock').delete().eq('product_id', productId).eq('cost_center_id', costCenterId);
      if (error) { console.error(error); return false; }
      setMinStockByCenter(prev => {
        const next = { ...prev };
        if (next[productId]) {
          const inner = { ...next[productId] };
          delete inner[costCenterId];
          next[productId] = inner;
        }
        return next;
      });
      return true;
    }
    const { error } = await supabase.from('product_min_stock').upsert({
      product_id: productId, cost_center_id: costCenterId, min_stock: Math.max(0, Math.floor(minStock)),
    }, { onConflict: 'product_id,cost_center_id' });
    if (error) { console.error(error); return false; }
    setMinStockByCenter(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [costCenterId]: Math.max(0, Math.floor(minStock)) },
    }));
    return true;
  }, []);

  const isFilial = useCallback((id: string) => filiais.some(f => f.id === id), [filiais]);

  // ===== Movements =====
  const insertMovement = useCallback(async (m: Omit<StockMovement, 'id'>): Promise<StockMovement | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || null;
    const { data, error } = await supabase.from('stock_movements').insert({
      product_id: m.productId, type: m.type, quantity: m.quantity,
      reason: m.reason, date: m.date, cost_center_id: m.costCenterId,
      destination_center_id: m.destinationCenterId || null,
      user_id: currentUserId,
      unit_cost: m.unitCost != null ? m.unitCost : null,
    } as any).select().single();
    if (error) { console.error(error); return null; }
    const mov: StockMovement = {
      id: data.id, productId: data.product_id, type: data.type as StockMovement['type'],
      quantity: data.quantity, reason: data.reason, date: data.date,
      costCenterId: data.cost_center_id, destinationCenterId: data.destination_center_id || undefined,
      userId: data.user_id || undefined,
      unitCost: (data as any).unit_cost != null ? Number((data as any).unit_cost) : undefined,
    };
    setMovements(prev => [...prev, mov]);
    return mov;
  }, []);

  const addStockIn = useCallback(async (productId: string, quantity: number, reason: string, costCenterId: string, date?: string, unitCost?: number): Promise<boolean> => {
    if (!isFilial(costCenterId)) return false;
    const mov = await insertMovement({
      productId, type: 'entrada', quantity, reason,
      date: date || new Date().toISOString(), costCenterId,
      unitCost,
    });
    return !!mov;
  }, [isFilial, insertMovement]);

  const addStockOut = useCallback(async (productId: string, quantity: number, reason: string, costCenterId: string, date?: string): Promise<boolean> => {
    if (!isFilial(costCenterId)) return false;
    const current = (stockByCenter[productId]?.[costCenterId]) || 0;
    if (current < quantity) return false;
    const mov = await insertMovement({
      productId, type: 'saida', quantity, reason,
      date: date || new Date().toISOString(), costCenterId,
    });
    return !!mov;
  }, [isFilial, stockByCenter, insertMovement]);

  const transferStock = useCallback(async (productId: string, quantity: number, fromId: string, toId: string, reason: string, date?: string): Promise<boolean> => {
    if (!isFilial(fromId) || !isFilial(toId) || fromId === toId) return false;
    const current = (stockByCenter[productId]?.[fromId]) || 0;
    if (current < quantity) return false;
    const mov = await insertMovement({
      productId, type: 'transferencia', quantity,
      reason: reason || 'Transferência entre unidades',
      date: date || new Date().toISOString(),
      costCenterId: fromId, destinationCenterId: toId,
    });
    return !!mov;
  }, [isFilial, stockByCenter, insertMovement]);

  const clearAllMovements = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!isMaster) return { ok: false, error: 'Apenas usuário Master pode limpar o histórico.' };
    const { error } = await supabase
      .from('stock_movements')
      .delete()
      .not('id', 'is', null);
    if (error) return { ok: false, error: error.message };
    setMovements([]);
    return { ok: true };
  }, [isMaster]);

  return (
    <AppContext.Provider value={{
      products, movements, costCenters, categories, stockByCenter, loading,
      activeCenterId, setActiveCenterId,
      addProduct, updateProduct, deleteProduct,
      addCostCenter, updateCostCenter, deleteCostCenter,
      addCategory, updateCategory, deleteCategory,
      addStockIn, addStockOut, transferStock,
      getStock,
      getMinStock,
      setProductMinStockForCenter,
      clearAllMovements,
      matrizId: matriz?.id || null,
      filiais,
      isMaster,
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
