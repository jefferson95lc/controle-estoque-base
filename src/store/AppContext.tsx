import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, StockMovement } from '@/types';

interface AppState {
  products: Product[];
  movements: StockMovement[];
  addProduct: (p: Omit<Product, 'id'>) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  addStockIn: (productId: string, quantity: number, reason: string) => void;
  addStockOut: (productId: string, quantity: number, reason: string) => boolean;
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
  const [products, setProducts] = useState<Product[]>(() => loadFromStorage('products', []));
  const [movements, setMovements] = useState<StockMovement[]>(() => loadFromStorage('movements', []));

  useEffect(() => { localStorage.setItem('products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('movements', JSON.stringify(movements)); }, [movements]);

  const addProduct = (p: Omit<Product, 'id'>) => setProducts(prev => [...prev, { ...p, id: uid() }]);
  const updateProduct = (p: Product) => setProducts(prev => prev.map(x => x.id === p.id ? p : x));
  const deleteProduct = (id: string) => setProducts(prev => prev.filter(x => x.id !== id));



  const addStockIn = (productId: string, quantity: number, reason: string) => {
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, quantity: p.quantity + quantity } : p
    ));
    setMovements(prev => [...prev, {
      id: uid(),
      productId,
      type: 'entrada',
      quantity,
      reason,
      date: new Date().toISOString(),
    }]);
  };

  const addStockOut = (productId: string, quantity: number, reason: string): boolean => {
    const product = products.find(p => p.id === productId);
    if (!product || product.quantity < quantity) return false;
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, quantity: p.quantity - quantity } : p
    ));
    setMovements(prev => [...prev, {
      id: uid(),
      productId,
      type: 'saida',
      quantity,
      reason,
      date: new Date().toISOString(),
    }]);
    return true;
  };

  return (
    <AppContext.Provider value={{
      products, movements,
      addProduct, updateProduct, deleteProduct,
      addStockIn, addStockOut,
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
