import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, RotateCcw } from 'lucide-react';

interface MinStockCellProps {
  productId: string;
  centerId: string;
  generalMin: number;
  effectiveMin: number;
  onSave: (productId: string, centerId: string, minStock: number | null) => Promise<boolean>;
}

/**
 * Inline editor for product min stock per cost center.
 * - If effectiveMin === generalMin AND no override stored, shows fallback in muted style.
 * - Edit to override; "Limpar" reverts to general (deletes the row).
 */
export function MinStockCell({ productId, centerId, generalMin, effectiveMin, onSave }: MinStockCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(effectiveMin));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(String(effectiveMin)); }, [effectiveMin, centerId, productId]);

  const isOverride = effectiveMin !== generalMin;

  const handleSave = async () => {
    const n = Number(value);
    if (isNaN(n) || n < 0) return;
    setSaving(true);
    await onSave(productId, centerId, n);
    setSaving(false);
    setEditing(false);
  };

  const handleClear = async () => {
    setSaving(true);
    await onSave(productId, centerId, null);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-1">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          className="h-8 w-20 text-center"
          autoFocus
          disabled={saving}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave} disabled={saving}><Check size={14} /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setValue(String(effectiveMin)); setEditing(false); }} disabled={saving}><X size={14} /></Button>
        {isOverride && (
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Voltar ao mínimo geral" onClick={handleClear} disabled={saving}><RotateCcw size={14} /></Button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`px-2 py-1 rounded hover:bg-muted/50 transition-colors ${isOverride ? 'font-semibold' : 'text-muted-foreground italic'}`}
      title={isOverride ? 'Mínimo específico desta filial (clique para editar)' : `Usando mínimo geral (${generalMin}). Clique para definir um mínimo específico.`}
    >
      {effectiveMin}
    </button>
  );
}
