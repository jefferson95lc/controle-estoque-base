import { useApp } from '@/store/AppContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { useEffect } from 'react';

export default function CostCenterSelector() {
  const { costCenters, activeCenterId, setActiveCenterId, matrizId, filiais, isMaster } = useApp();

  // Usuários comuns com apenas uma filial: força seleção dessa filial e oculta "Consolidado"
  const restrictToSingle = !isMaster && filiais.length === 1;

  useEffect(() => {
    if (restrictToSingle && activeCenterId !== filiais[0].id) {
      setActiveCenterId(filiais[0].id);
    }
  }, [restrictToSingle, filiais, activeCenterId, setActiveCenterId]);

  if (costCenters.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 size={16} />
        Nenhum centro de custo cadastrado
      </div>
    );
  }

  if (restrictToSingle) {
    return (
      <div className="flex items-center gap-2">
        <Building2 size={16} className="text-muted-foreground" />
        <div className="w-[220px] px-3 py-2 text-sm border rounded-md bg-muted/40">
          {filiais[0].name}
        </div>
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
