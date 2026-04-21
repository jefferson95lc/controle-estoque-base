import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { toast } from 'sonner';

type MovType = 'entrada' | 'saida' | 'transferencia';

const REASONS_IN = ['Compra', 'Devolução de cliente', 'Ajuste de inventário', 'Outro'];
const REASONS_OUT = ['Venda', 'Perda', 'Uso interno', 'Devolução', 'Outro'];

interface ParsedRow {
  row: number;
  productName: string;
  productId: string;
  quantity: number;
  reason: string;
  date: string;
  costCenterName: string;
  costCenterId: string;
  destCenterName: string;
  destCenterId: string;
  errors: string[];
}

export function StockBulkImport() {
  const { products, filiais, addStockIn, addStockOut, transferStock, getStock } = useApp();
  const [open, setOpen] = useState(false);
  const [movType, setMovType] = useState<MovType>('entrada');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const productMap = new Map(products.map(p => [p.name.toLowerCase(), p]));
  const filialMap = new Map(filiais.map(f => [f.name.toLowerCase(), f]));

  const downloadTemplate = () => {
    let headers: string[][];
    let example: (string | number)[][];
    const exProduct = products[0]?.name || 'Produto X';
    const exFilial = filiais[0]?.name || 'Filial A';
    const exFilial2 = filiais[1]?.name || 'Filial B';

    if (movType === 'transferencia') {
      headers = [['produto', 'quantidade', 'filial_origem', 'filial_destino', 'motivo', 'data']];
      example = [
        [exProduct, 10, exFilial, exFilial2, 'Reabastecimento', '2025-01-15'],
        [exProduct, 5, exFilial, exFilial2, 'Transferência', '2025-01-16'],
      ];
    } else {
      headers = [['produto', 'quantidade', 'filial', 'motivo', 'data']];
      const reasons = movType === 'entrada' ? REASONS_IN : REASONS_OUT;
      example = [
        [exProduct, 10, exFilial, reasons[0], '2025-01-15'],
        [exProduct, 5, exFilial, reasons[1], '2025-01-16'],
      ];
    }

    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    ws['!cols'] = headers[0].map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    const label = movType === 'entrada' ? 'Entradas' : movType === 'saida' ? 'Saídas' : 'Transferências';
    XLSX.utils.book_append_sheet(wb, ws, label);
    XLSX.writeFile(wb, `template-${movType}.xlsx`);
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

        const result: ParsedRow[] = rows.map((r, idx) => {
          const errors: string[] = [];

          const productName = String(r.produto ?? r.product ?? '').trim();
          const quantityRaw = Number(r.quantidade ?? r.quantity ?? 0);
          const reason = String(r.motivo ?? r.reason ?? '').trim();
          const dateRaw = String(r.data ?? r.date ?? '').trim();
          const centerName = String(r.filial ?? r.filial_origem ?? r.cost_center ?? '').trim();
          const destName = String(r.filial_destino ?? r.destination ?? '').trim();

          const prod = productMap.get(productName.toLowerCase());
          const center = filialMap.get(centerName.toLowerCase());
          const dest = destName ? filialMap.get(destName.toLowerCase()) : undefined;

          if (!productName) errors.push('Produto obrigatório');
          else if (!prod) errors.push('Produto não encontrado');

          if (!quantityRaw || quantityRaw <= 0) errors.push('Quantidade inválida');

          if (!centerName) errors.push('Filial obrigatória');
          else if (!center) errors.push('Filial não encontrada');

          if (!reason) errors.push('Motivo obrigatório');

          if (movType === 'transferencia') {
            if (!destName) errors.push('Filial destino obrigatória');
            else if (!dest) errors.push('Filial destino não encontrada');
            else if (center && dest && center.id === dest.id) errors.push('Origem e destino iguais');
          }

          if (movType === 'saida' && prod && center && errors.length === 0) {
            const stock = getStock(prod.id, center.id);
            if (stock < quantityRaw) errors.push(`Estoque insuficiente (disp: ${stock})`);
          }

          return {
            row: idx + 2,
            productName,
            productId: prod?.id || '',
            quantity: quantityRaw,
            reason,
            date: dateRaw,
            costCenterName: centerName,
            costCenterId: center?.id || '',
            destCenterName: destName,
            destCenterId: dest?.id || '',
            errors,
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
    setImporting(true);
    let success = 0;
    let fail = 0;

    for (const r of validRows) {
      const dateISO = r.date ? new Date(r.date + 'T12:00:00').toISOString() : undefined;
      let ok = false;

      if (movType === 'entrada') {
        ok = await addStockIn(r.productId, r.quantity, r.reason, r.costCenterId, dateISO);
      } else if (movType === 'saida') {
        ok = await addStockOut(r.productId, r.quantity, r.reason, r.costCenterId, dateISO);
      } else {
        ok = await transferStock(r.productId, r.quantity, r.costCenterId, r.destCenterId, r.reason, dateISO);
      }

      if (ok) success++;
      else fail++;
    }

    if (fail > 0) {
      toast.warning(`${success} registrado(s), ${fail} com erro.`);
    } else {
      toast.success(`${success} movimentação(ões) importada(s) com sucesso.`);
    }

    setImporting(false);
    reset();
    setOpen(false);
  };

  const reset = () => {
    setParsed([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const typeLabel = movType === 'entrada' ? 'Entradas' : movType === 'saida' ? 'Saídas' : 'Transferências';

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload size={16} className="mr-2" />Importar Excel</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Importar Movimentações via Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo de Movimentação</Label>
            <Select value={movType} onValueChange={(v) => { setMovType(v as MovType); reset(); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-dashed p-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="text-primary mt-0.5" size={20} />
              <div className="flex-1 text-sm">
                <p className="font-medium mb-1">Formato esperado — {typeLabel}</p>
                <p className="text-muted-foreground mb-2">
                  {movType === 'transferencia' ? (
                    <>Colunas: <code className="text-xs bg-muted px-1 rounded">produto</code>, <code className="text-xs bg-muted px-1 rounded">quantidade</code>, <code className="text-xs bg-muted px-1 rounded">filial_origem</code>, <code className="text-xs bg-muted px-1 rounded">filial_destino</code>, <code className="text-xs bg-muted px-1 rounded">motivo</code>, <code className="text-xs bg-muted px-1 rounded">data</code></>
                  ) : (
                    <>Colunas: <code className="text-xs bg-muted px-1 rounded">produto</code>, <code className="text-xs bg-muted px-1 rounded">quantidade</code>, <code className="text-xs bg-muted px-1 rounded">filial</code>, <code className="text-xs bg-muted px-1 rounded">motivo</code>, <code className="text-xs bg-muted px-1 rounded">data</code></>
                  )}
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
                      <th className="text-left p-2">Produto</th>
                      <th className="text-left p-2">Qtd</th>
                      <th className="text-left p-2">{movType === 'transferencia' ? 'Origem' : 'Filial'}</th>
                      {movType === 'transferencia' && <th className="text-left p-2">Destino</th>}
                      <th className="text-left p-2">Motivo</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map(r => (
                      <tr key={r.row} className="border-t">
                        <td className="p-2 text-muted-foreground">{r.row}</td>
                        <td className="p-2">{r.productName || '—'}</td>
                        <td className="p-2">{r.quantity}</td>
                        <td className="p-2">{r.costCenterName || '—'}</td>
                        {movType === 'transferencia' && <td className="p-2">{r.destCenterName || '—'}</td>}
                        <td className="p-2">{r.reason || '—'}</td>
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
          <Button onClick={handleImport} disabled={validRows.length === 0 || importing}>
            {importing ? 'Importando...' : `Importar ${validRows.length > 0 ? `(${validRows.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
