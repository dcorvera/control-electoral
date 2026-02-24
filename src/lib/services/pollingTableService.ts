// $lib/services/pollingTableService.ts

import type { PollingTable } from '$lib/types/types';

// Helper para mapear con información geográfica completa
const toPollingTableWithGeo = (obj: any): PollingTable => {
  const precinctObj = obj.get("precinct");
  const localityObj = precinctObj?.get("locality");
  const municipalityObj = localityObj?.get("municipality");
  const provinceObj = municipalityObj?.get("province");
  const departamentObj = provinceObj?.get("departament");
  
  // Construir el objeto con la estructura completa
  const result: any = {
    id: obj.id,
    number: obj.get("number"),
    inscribedCount: obj.get("inscribedCount"),
    actCode: obj.get("actCode")
  };

  // Solo agregar precinct si existe y tiene toda la cadena geográfica
  if (precinctObj && localityObj && municipalityObj && provinceObj && departamentObj) {
    result.precinct = {
      id: precinctObj.id,
      code: precinctObj.get("code"),
      name: precinctObj.get("name"),
      locality: {
        id: localityObj.id,
        code: localityObj.get("code"),
        name: localityObj.get("name"),
        municipality: {
          id: municipalityObj.id,
          code: municipalityObj.get("code"),
          name: municipalityObj.get("name"),
          province: {
            id: provinceObj.id,
            code: provinceObj.get("code"),
            name: provinceObj.get("name"),
            departament: {
              id: departamentObj.id,
              code: departamentObj.get("code"),
              name: departamentObj.get("name")
            }
          }
        }
      }
    };
  }
  
  return result as PollingTable;
};

// Helper básico (sin geo) para funciones que no lo necesitan
const toPollingTable = (obj: any): PollingTable => {
  return {
    id: obj.id,
    number: obj.get("number"),
    inscribedCount: obj.get("inscribedCount"),
    actCode: obj.get("actCode")
  };
};

// FUNCIÓN PRINCIPAL: Obtener todas las mesas CON información geográfica
export async function getPollingTables(): Promise<PollingTable[]> {
  if (typeof window === 'undefined') return [];

  const Parse = (await import('$lib/parseClient')).default;
  const PollingTableClass = Parse.Object.extend("PollingTable");

  const query = new Parse.Query(PollingTableClass);
  
  // CRÍTICO: Incluir TODA la cadena geográfica
  query.include([
    'precinct',
    'precinct.locality',
    'precinct.locality.municipality',
    'precinct.locality.municipality.province',
    'precinct.locality.municipality.province.departament'  // Sin 't' al final según tu schema
  ]);
  
  query.ascending("number");
  query.limit(2000);

  try {
    const results = await query.find();
    return results.map(toPollingTableWithGeo);  // Usar helper con geo
  } catch (error) {
    console.error("Error fetching PollingTables:", error);
    return [];
  }
}

export async function createPollingTable(data: {
  number: number;
  inscribedCount?: number;
  actCode?: number;
  precinctId: string;
}) {
  if (typeof window === 'undefined') throw new Error("Cannot create in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const PollingTableClass = Parse.Object.extend("PollingTable");

  const obj = new PollingTableClass();
  obj.set("number", data.number);

  if (data.inscribedCount !== undefined) {
    obj.set("inscribedCount", data.inscribedCount);
  }
  
  if (data.actCode) {
    obj.set("actCode", data.actCode);
  }

  const Precinct = Parse.Object.extend("Precinct");
  const precinct = new Precinct();
  precinct.id = data.precinctId;
  obj.set("precinct", precinct);

  await obj.save();

  return {
    id: obj.id,
    number: obj.get("number"),
    inscribedCount: obj.get("inscribedCount"),
    actCode: obj.get("actCode")
  };
}

export async function getPollingTablesByPrecinct(precinctId: string): Promise<PollingTable[]> {
  if (typeof window === 'undefined') return [];

  const Parse = (await import('$lib/parseClient')).default;
  const PollingTableClass = Parse.Object.extend("PollingTable");

  const Precinct = Parse.Object.extend("Precinct");
  const precinct = new Precinct();
  precinct.id = precinctId;

  const query = new Parse.Query(PollingTableClass);
  query.equalTo("precinct", precinct);
  query.ascending("number");
  query.limit(2000);

  try {
    const results = await query.find();
    return results.map(toPollingTable);
  } catch (error) {
    console.error("Error fetching PollingTables by Precinct:", error);
    return [];
  }
}

export async function updatePollingTable(
  id: string,
  data: {
    number?: number;
    inscribedCount?: number;
    actCode?: number;
    precinctId?: string;
  }
) {
  if (typeof window === 'undefined') throw new Error("Cannot update in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const PollingTableClass = Parse.Object.extend("PollingTable");

  const query = new Parse.Query(PollingTableClass);
  const obj = await query.get(id);

  if (data.number !== undefined) obj.set("number", data.number);
  if (data.inscribedCount !== undefined) obj.set("inscribedCount", data.inscribedCount);
  if (data.actCode !== undefined) obj.set("actCode", data.actCode);

  if (data.precinctId) {
    const Precinct = Parse.Object.extend("Precinct");
    const precinct = new Precinct();
    precinct.id = data.precinctId;
    obj.set("precinct", precinct);
  }

  await obj.save();

  return {
    id: obj.id,
    number: obj.get("number"),
    inscribedCount: obj.get("inscribedCount"),
    actCode: obj.get("actCode")
  };
}

export async function deletePollingTable(id: string) {
  if (typeof window === 'undefined') throw new Error("Cannot delete in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const PollingTableClass = Parse.Object.extend("PollingTable");

  const query = new Parse.Query(PollingTableClass);
  const obj = await query.get(id);

  await obj.destroy();
}