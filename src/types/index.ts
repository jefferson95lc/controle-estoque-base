export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  quantity: number;
  minStock: number;
}


export interface StockMovement {
  id: string;
  productId: string;
  type: 'entrada' | 'saida';
  quantity: number;
  reason: string;
  date: string;
}
