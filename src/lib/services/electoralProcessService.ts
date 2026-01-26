// $lib/services/electoralProcess.ts

import type { ElectoralProcess } from '$lib/types/types';


export async function getElectoralProcess(): Promise<ElectoralProcess[]> {
  if (typeof window === 'undefined') return []; // no correr en SSR

  const Parse = (await import('$lib/parseClient')).default;
  const ElectoralProcess = Parse.Object.extend("ElectoralProcess");

  const query = new Parse.Query(ElectoralProcess);
  try {
    const results = await query.find();
    return results.map((obj: any) => ({
      id: obj.id,
      name: obj.get("name"),
      year: obj.get("year"),
      type:obj.get("type"),
      state: obj.get("state"),
    }));
  } catch (error) {
    console.error("Error fetching electoral_process:", error);
    return [];
  }
}


export async function getElectoralProcessActive(): Promise<ElectoralProcess[]> {
  if (typeof window === 'undefined') return []; // no correr en SSR

  const Parse = (await import('$lib/parseClient')).default;
  const ElectoralProcess = Parse.Object.extend("ElectoralProcess");

  const query = new Parse.Query(ElectoralProcess);
  query.equalTo("state","Activo");
  try {
    const results = await query.find();
    const res= results.map((obj: any) => ({
      id: obj.id,
      name: obj.get("name"),
      year: obj.get("year"),
      type:obj.get("type"),
      state: obj.get("state"),
    }));
    return res;
  } catch (error) {
    console.error("Error fetching electoral_process:", error);
    return [];
  }
}

export async function createElectoralProcess(data: { name: string; year: number; type:string,state: string }) {
  if (typeof window === 'undefined') throw new Error("Cannot create in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const ElectoralProcess = Parse.Object.extend("ElectoralProcess");

  const obj = new ElectoralProcess();
  obj.set("name", data.name);
  obj.set("year", data.year);
  obj.set("type", data.type);
  obj.set("state", data.state);

  await obj.save();
  return {
    id: obj.id,
    name: obj.get("name"),
    year: obj.get("year"),
    type: obj.get("type"),
    state: obj.get("state"),
  };
}

export async function updateElectoralProcess(id: string, data: { name: string; year: number; type:string,state: string }) {
  if (typeof window === 'undefined') throw new Error("Cannot update in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const ElectoralProcess = Parse.Object.extend("ElectoralProcess");
  const query = new Parse.Query(ElectoralProcess);
  const obj = await query.get(id);
  obj.set("name", data.name);
  obj.set("year", data.year);
  obj.set("type", data.type);
  obj.set("state", data.state);
  await obj.save();
  return {
    id: obj.id,
    name: obj.get("name"),
    year: obj.get("year"),
    type: obj.get("type"),
    state: obj.get("state"),
  };
}

export async function deleteElectoralProcess(id: string) {
  if (typeof window === 'undefined') throw new Error("Cannot delete in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const ElectoralProcess = Parse.Object.extend("ElectoralProcess");
  const query = new Parse.Query(ElectoralProcess);
  const obj = await query.get(id);
  await obj.destroy();
}
