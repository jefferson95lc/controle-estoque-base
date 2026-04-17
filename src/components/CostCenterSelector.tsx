import { useApp } from '@/store/AppContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

export default function CostCenterSelector() {
  const { costCenters, activeCenterId, setActiveCenterId, matrizId } = useApp();

  if (costCenters.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 size={16} />
        Nenhum centro de custo cadastrado
      </div>
    );
  }

  const value = activeCenterId ?? '__consolidado__';

  return (
    <div className="flex items-center gap-2">
      <Building2 size={16} className="text-muted-foreground" />
      <Select
        value={value}
        onValueChange={(v) => setActiveCenterId(v === '__consolidado__' ? null : v)}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__consolidado__">
            {matrizId ? '🏢 Matriz (Consolidado)' : 'Consolidado (todas)'}
          </SelectItem>
          {costCenters.filter(c => c.type === 'filial').map(c => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
