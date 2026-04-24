export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  // quantity removed: stock is now per cost center (see stockByCenter in AppContext)
  minStock: number;
}

export type CostCenterType = 'matriz' | 'filial';

export interface CostCenter {
  id: string;
  name: string;
  type: CostCenterType;
}

export interface Category {
  id: string;
  name: string;
  active: boolean;
}

export interface ProductMinStock {
  productId: string;
  costCenterId: string;
  minStock: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'entrada' | 'saida' | 'transferencia';
  quantity: number;
  reason: string;
  date: string;
  costCenterId: string;          // origin (entrada/saida/transferencia)
  destinationCenterId?: string;  // only for transferencia
  userId?: string;               // who performed the movement
}
