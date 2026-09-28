/**
 * Villas of the active community with the residents living in each, for pickers that
 * select a unit or a resident (visitor hosts, bookings made on a resident's behalf).
 * Villas are loaded once through the villa slice when the picker is first shown.
 */

import { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/src/store/store';
import { useVilla } from './useVilla';

export interface VillaResidentOption {
  id: string; // User ID
  name: string; // User Name
  type: string; // Residency Type e.g. Primary Resident, Owner, Tenant
  phone?: string;
}

export interface VillaOption {
  id: string; // Villa ID
  name: string; // e.g. "Villa 101 - Block A"
  primaryResidentId?: string;
  primaryResidentName?: string;
  residents: VillaResidentOption[];
}

const toVillaOption = (v: any): VillaOption => {
  const villaId = v._id || v.id;
  const rawUnit = (v.unitNumber || v.name || '').trim();
  const formattedUnit = rawUnit.toLowerCase().startsWith('villa') ? rawUnit : `Villa ${rawUnit}`;
  // Block names are often stored as "Block A"; don't prefix a second "Block".
  const blockLabel = v.blockOrBuilding
    ? (/^block\b/i.test(v.blockOrBuilding.trim()) ? v.blockOrBuilding.trim() : `Block ${v.blockOrBuilding.trim()}`)
    : '';
  const villaName = `${formattedUnit}${blockLabel ? ` - ${blockLabel}` : ''}`;

  const primaryRes = v.primaryResidentId || (v.residents && v.residents[0]?.userId);
  const primaryResId = typeof primaryRes === 'object' ? (primaryRes._id || primaryRes.id) : primaryRes;
  const primaryResName = typeof primaryRes === 'object' ? (primaryRes.name || primaryRes.username) : 'Primary Resident';

  const residents: VillaResidentOption[] = [];
  if (Array.isArray(v.residents) && v.residents.length > 0) {
    v.residents.forEach((r: any) => {
      const userObj = typeof r.userId === 'object' ? r.userId : null;
      const rId = userObj?._id || userObj?.id || r.userId || r.id;
      const rName = userObj?.name || userObj?.username || userObj?.phone || 'Resident';
      if (rId) {
        residents.push({
          id: rId,
          name: rName,
          type: r.residencyType || (r.isPrimary ? 'Primary Resident' : 'Resident'),
          phone: userObj?.phone,
        });
      }
    });
  }
  if (residents.length === 0 && primaryResId) {
    residents.push({ id: primaryResId, name: primaryResName, type: 'Primary Resident' });
  }

  return { id: villaId, name: villaName, primaryResidentId: primaryResId, primaryResidentName: primaryResName, residents };
};

export function useVillaResidentOptions(active: boolean) {
  const { fetchVillas, loading } = useVilla();
  const villas = useSelector((state: RootState) => (state as any).villa?.villas);

  useEffect(() => {
    if (active && (!villas || villas.length === 0)) {
      fetchVillas({ page: 1, limit: 200 });
    }
  }, [active, villas, fetchVillas]);

  const options: VillaOption[] = useMemo(
    () => (Array.isArray(villas) ? villas.map(toVillaOption) : []),
    [villas]
  );

  return { options, loading };
}

export default useVillaResidentOptions;
