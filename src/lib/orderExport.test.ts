import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { createOrderPdf, createOrderWorkbook, FinalOrder } from './orderExport';

const order: FinalOrder = { scope: 'Bezerra', start: '01/11/2026', end: '14/11/2026', weeks: 4,
  items: [{ productId: 'p1', name: 'Máscara', sku: 'SKU1', unit: 'un', quantity: 36 }] };
describe('exportação do pedido final', () => {
  it('XLS preserva produtos e quantidades do pedido final', () => {
    const binary = XLSX.write(createOrderWorkbook(order), { bookType: 'biff8', type: 'array' });
    const readback = XLSX.read(binary, { type: 'array' });
    const sheet = readback.Sheets['Pedido'];
    expect(sheet.A7.v).toBe('Máscara');
    expect(sheet.D7.v).toBe(36);
  });
  it('PDF é um documento não vazio', () => {
    const doc = createOrderPdf(order);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000);
  });
});