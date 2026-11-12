import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface FinalOrderItem { productId: string; name: string; sku: string; unit: string; quantity: number }
export interface FinalOrder { scope: string; start: string; end: string; weeks: number; items: FinalOrderItem[] }

export function createOrderWorkbook(order: FinalOrder) {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Pedido — Odontoart Stock Pro'],
    ['Centro de custo', order.scope], ['Período de referência', `${order.start} a ${order.end}`],
    ['Semanas', order.weeks], [], ['Produto', 'SKU', 'Unidade', 'Quantidade'],
    ...order.items.map(i => [i.name, i.sku, i.unit, i.quantity]),
  ]);
  ws['!cols'] = [{ wch: 55 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
  return wb;
}

export function createOrderPdf(order: FinalOrder) {
  const doc = new jsPDF({ format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Pedido — Odontoart Stock Pro', 14, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(`Centro de custo: ${order.scope}\nPeríodo: ${order.start} a ${order.end}\nCobertura: ${order.weeks} semana(s)`, 180);
  doc.text(lines, 14, 30);
  autoTable(doc, {
    startY: 34 + lines.length * 5,
    head: [['Produto', 'SKU', 'Unidade', 'Quantidade']],
    body: order.items.map(i => [i.name, i.sku, i.unit, i.quantity]),
    theme: 'grid', styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 95 }, 3: { halign: 'right' } },
    margin: { top: 14, bottom: 18 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.text(`Página ${doc.getNumberOfPages()}`, 14, 287);
    },
  });
  return doc;
}