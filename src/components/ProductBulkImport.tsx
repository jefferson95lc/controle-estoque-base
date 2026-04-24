import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Product } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const UNITS = ['UN', 'KG', 'CX', 'L', 'M', 'PCT'];

interface ParsedRow {
  row: number;
  name: string;
  sku: string;
  category: string;
  unit: string;
  minStock: number;
  errors: string[];
  existingProductId?: string; // when SKU already exists and filial is selected
}

export function ProductBulkImport() {
  const { products, addProduct, categories, activeCenterId, matrizId, costCenters, setProductMinStockForCenter } = useApp();
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const filialSelected = activeCenterId && activeCenterId !== matrizId ? activeCenterId : null;
  const filialName = filialSelected ? costCenters.find(c => c.id === filialSelected)?.name : null;

  const activeCategoryNames = categories.filter(c => c.active).map(c => c.name.toLowerCase());

  const downloadTemplate = () => {
    const headers = [['nome', 'sku', 'categoria', 'unidade', 'estoque_minimo']];
    const example = [
      ['Produto Exemplo 1', 'SKU001', categories[0]?.name || 'Matéria-prima', 'UN', 10],
      ['Produto Exemplo 2', 'SKU002', categories[0]?.name || 'Matéria-prima', 'KG', 5],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    XLSX.writeFile(wb, 'template-produtos.xlsx');
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        const productsBySku = new Map(products.map(p => [p.sku.toLowerCase(), p]));
        const seenSkus = new Set<string>();

        const result: ParsedRow[] = rows.map((r, idx) => {
          const errors: string[] = [];
          const name = String(r.nome ?? r.name ?? '').trim();
          const sku = String(r.sku ?? '').trim();
          const category = String(r.categoria ?? r.category ?? '').trim();
          const unitRaw = String(r.unidade ?? r.unit ?? 'UN').trim().toUpperCase();
          const minStock = Number(r.estoque_minimo ?? r.minStock ?? 0);

          const existing = sku ? productsBySku.get(sku.toLowerCase()) : undefined;

          if (!name) errors.push('Nome obrigatório');
          if (!sku) errors.push('SKU obrigatório');
          if (sku && existing && !filialSelected) errors.push('SKU já existe');
          if (sku && seenSkus.has(sku.toLowerCase())) errors.push('SKU duplicado no arquivo');
          if (sku) seenSkus.add(sku.toLowerCase());
          if (!filialSelected || !existing) {
            if (!UNITS.includes(unitRaw)) errors.push(`Unidade inválida (use: ${UNITS.join(', ')})`);
            if (category && !activeCategoryNames.includes(category.toLowerCase())) errors.push('Categoria não cadastrada/inativa');
          }
          if (isNaN(minStock) || minStock < 0) errors.push('Estoque mínimo inválido');

          return {
            row: idx + 2,
            name,
            sku,
            category,
            unit: unitRaw,
            minStock: isNaN(minStock) ? 0 : minStock,
            errors,
            existingProductId: existing?.id,
          };
        });

        setParsed(result);
      } catch (err) {
        console.error(err);
        toast.error('Erro ao ler arquivo. Verifique o formato.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validRows = parsed.filter(r => r.errors.length === 0);
  const invalidRows = parsed.filter(r => r.errors.length > 0);

  const handleImport = async () => {
    let createdCount = 0;
    let minSetCount = 0;
    for (const r of validRows) {
      let productId = r.existingProductId;
      if (!productId) {
        // create new product. If filial is selected, keep general min as 0 (specific goes per-filial).
        const p: Omit<Product, 'id'> = {
          name: r.name, sku: r.sku, category: r.category, unit: r.unit,
          minStock: filialSelected ? 0 : r.minStock,
        };
        await addProduct(p);
        createdCount++;
        // re-find the just created product to get id
        // addProduct updates the products state, but we need the id NOW for min stock.
        // We fetch it via the in-memory list after a short tick: instead, query DB.
        if (filialSelected) {
          // fallback: search by sku in updated state requires re-render; do a direct query via supabase isn't trivial here.
          // Solution: after addProduct completes, the local products state is updated, but our closure is stale.
          // Use a small workaround: read the latest products through the import dialog by calling a fresh select.
        }
      }
      if (filialSelected) {
        // Resolve product id (handles both existing and just-created)
        // For just-created we need to look it up from DB to be safe.
        if (!productId) {
          // Best-effort: it should now exist in `products` after addProduct (state updated async).
          // To be safe, we wait a microtask and re-read from the latest products via a ref-less approach:
          // Simpler: query the products list right now (closure may be stale, so SKU lookup may miss).
          // Workaround: do nothing here; handled below via a second pass.
        }
        if (productId) {
          await setProductMinStockForCenter(productId, filialSelected, r.minStock);
          minSetCount++;
        }
      }
    }

    // Second pass for newly-created products with filial selected: resolve via fresh products list
    if (filialSelected) {
      // Re-read via a fresh query to ensure we capture newly created ids
      const newSkus = validRows.filter(r => !r.existingProductId).map(r => r.sku.toLowerCase());
      if (newSkus.length > 0) {
        // wait one tick for state to flush
        await new Promise(res => setTimeout(res, 200));
        // products state may still be stale in closure; use a direct fetch
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = await supabase.from('products').select('id, sku').in('sku', validRows.filter(r => !r.existingProductId).map(r => r.sku));
        if (data) {
          const idBySku = new Map(data.map((p: any) => [p.sku.toLowerCase(), p.id]));
          for (const r of validRows.filter(r => !r.existingProductId)) {
            const id = idBySku.get(r.sku.toLowerCase());
            if (id) {
              await setProductMinStockForCenter(id, filialSelected, r.minStock);
              minSetCount++;
            }
          }
        }
      }
    }

    if (filialSelected) {
      toast.success(`${createdCount} produto(s) criado(s) e ${minSetCount} mínimo(s) definido(s) para ${filialName}.`);
    } else {
      toast.success(`${createdCount} produto(s) importado(s) com sucesso.`);
    }
    reset();
    setOpen(false);
  };

  const reset = () => {
    setParsed([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload size={16} className="mr-2" />Importar Excel</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Importar Produtos via Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-dashed p-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="text-primary mt-0.5" size={20} />
              <div className="flex-1 text-sm">
                <p className="font-medium mb-1">Formato esperado</p>
                <p className="text-muted-foreground mb-2">
                  Colunas: <code className="text-xs bg-muted px-1 rounded">nome</code>, <code className="text-xs bg-muted px-1 rounded">sku</code>, <code className="text-xs bg-muted px-1 rounded">categoria</code>, <code className="text-xs bg-muted px-1 rounded">unidade</code>, <code className="text-xs bg-muted px-1 rounded">estoque_minimo</code>
                </p>
                <Button size="sm" variant="secondary" onClick={downloadTemplate}>
                  <Download size={14} className="mr-2" />Baixar template
                </Button>
              </div>
            </div>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
              <Upload size={16} className="mr-2" />
              {fileName || 'Selecionar arquivo .xlsx'}
            </Button>
          </div>

          {parsed.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 bg-emerald-500/10">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={16} />
                    <span className="font-semibold">{validRows.length}</span>
                    <span className="text-sm">válido(s)</span>
                  </div>
                </div>
                <div className="rounded-lg border p-3 bg-destructive/10">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle size={16} />
                    <span className="font-semibold">{invalidRows.length}</span>
                    <span className="text-sm">com erro</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Linha</th>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">SKU</th>
                      <th className="text-left p-2">Categoria</th>
                      <th className="text-left p-2">Un.</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map(r => (
                      <tr key={r.row} className="border-t">
                        <td className="p-2 text-muted-foreground">{r.row}</td>
                        <td className="p-2">{r.name || '—'}</td>
                        <td className="p-2">{r.sku || '—'}</td>
                        <td className="p-2">{r.category || '—'}</td>
                        <td className="p-2">{r.unit}</td>
                        <td className="p-2">
                          {r.errors.length === 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                          ) : (
                            <span className="text-destructive">{r.errors.join('; ')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); setOpen(false); }}>Cancelar</Button>
          <Button onClick={handleImport} disabled={validRows.length === 0}>
            Importar {validRows.length > 0 && `(${validRows.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
