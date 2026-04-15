export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  quantity: number;
  minStock: number;
}

export interface Supplier {
  id: string;
  name: string;
  document: string;
  contact: string;
  email: string;
}

export interface PurchaseItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export type PurchaseStatus = 'Pendente' | 'Aprovado' | 'Recebido';

export interface Purchase {
  id: string;
  supplierId: string;
  date: string;
  status: PurchaseStatus;
  items: PurchaseItem[];
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'entrada' | 'saida';
  quantity: number;
  reason: string;
  date: string;
  purchaseId?: string;
}
