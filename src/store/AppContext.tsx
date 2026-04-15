import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, Supplier, Purchase, StockMovement, PurchaseStatus } from '@/types';

interface AppState {
  products: Product[];
  suppliers: Supplier[];
  purchases: Purchase[];
  movements: StockMovement[];
  addProduct: (p: Omit<Product, 'id'>) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  addSupplier: (s: Omit<Supplier, 'id'>) => void;
  updateSupplier: (s: Supplier) => void;
  deleteSupplier: (id: string) => void;
  addPurchase: (p: Omit<Purchase, 'id'>) => void;
  updatePurchaseStatus: (id: string, status: PurchaseStatus) => void;
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
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadFromStorage('suppliers', []));
  const [purchases, setPurchases] = useState<Purchase[]>(() => loadFromStorage('purchases', []));
  const [movements, setMovements] = useState<StockMovement[]>(() => loadFromStorage('movements', []));

  useEffect(() => { localStorage.setItem('products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('suppliers', JSON.stringify(suppliers)); }, [suppliers]);
  useEffect(() => { localStorage.setItem('purchases', JSON.stringify(purchases)); }, [purchases]);
  useEffect(() => { localStorage.setItem('movements', JSON.stringify(movements)); }, [movements]);

  const addProduct = (p: Omit<Product, 'id'>) => setProducts(prev => [...prev, { ...p, id: uid() }]);
  const updateProduct = (p: Product) => setProducts(prev => prev.map(x => x.id === p.id ? p : x));
  const deleteProduct = (id: string) => setProducts(prev => prev.filter(x => x.id !== id));

  const addSupplier = (s: Omit<Supplier, 'id'>) => setSuppliers(prev => [...prev, { ...s, id: uid() }]);
  const updateSupplier = (s: Supplier) => setSuppliers(prev => prev.map(x => x.id === s.id ? s : x));
  const deleteSupplier = (id: string) => setSuppliers(prev => prev.filter(x => x.id !== id));

  const addPurchase = (p: Omit<Purchase, 'id'>) => setPurchases(prev => [...prev, { ...p, id: uid() }]);

  const updatePurchaseStatus = (id: string, status: PurchaseStatus) => {
    setPurchases(prev => prev.map(p => {
      if (p.id !== id) return p;
      if (p.status === 'Recebido') return p; // can't change once received
      if (status === 'Recebido') {
        // Update stock
        p.items.forEach(item => {
          setProducts(prods => prods.map(prod =>
            prod.id === item.productId
              ? { ...prod, quantity: prod.quantity + item.quantity }
              : prod
          ));
          setMovements(prev => [...prev, {
            id: uid(),
            productId: item.productId,
            type: 'entrada',
            quantity: item.quantity,
            reason: `Pedido de compra #${id.slice(0, 8)}`,
            date: new Date().toISOString(),
            purchaseId: id,
          }]);
        });
      }
      return { ...p, status };
    }));
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
      products, suppliers, purchases, movements,
      addProduct, updateProduct, deleteProduct,
      addSupplier, updateSupplier, deleteSupplier,
      addPurchase, updatePurchaseStatus, addStockOut,
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
