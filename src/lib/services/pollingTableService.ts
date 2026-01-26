// Actualizar estas funciones en pollingTableService.ts

import type { PollingTable } from '$lib/types/types';

const toPollingTable = (obj: any): PollingTable => {
  const precinctObj = obj.get("precinct");
  const localityObj = precinctObj.get("locality");
  
  return {
    id: obj.id,
    number: obj.get("number"),
    inscribedCount: obj.get("inscribedCount"),
    actCode: obj.get("actCode"),
  };
};

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