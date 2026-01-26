// $lib/services/Country.ts

import type { Country } from '$lib/types/types';


export async function getCountry(): Promise<Country[]> {
  if (typeof window === 'undefined') return []; // no correr en SSR

  const Parse = (await import('$lib/parseClient')).default;
  const Country = Parse.Object.extend("Country");

  const query = new Parse.Query(Country);
  try {
    const results = await query.find();
    return results.map((obj: any) => ({
      id: obj.id,
      code:obj.get("code"),
      name: obj.get("name"),
    }));
  } catch (error) {
    console.error("Error fetching country:", error);
    return [];
  }
}

export async function createCountry(data: {code:number; name: string; }) {
  if (typeof window === 'undefined') throw new Error("Cannot create in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const Country = Parse.Object.extend("Country");

  const obj = new Country();
  obj.set("code", data.code);
  obj.set("name", data.name);
  await obj.save();
  return {
      id: obj.id,
      code:obj.get("code"),
      name: obj.get("name"),
  };
}

export async function updateCountry(id: string, data: { code:number; name: string; }) {
  if (typeof window === 'undefined') throw new Error("Cannot update in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const Country = Parse.Object.extend("Country");
  const query = new Parse.Query(Country);
  const obj = await query.get(id);
  obj.set("code", data.code);
  obj.set("name", data.name);
  await obj.save();
  return {
     id: obj.id,
      code:obj.get("code"),
      name: obj.get("name"),
  };
}

export async function deleteCountry(id: string) {
  if (typeof window === 'undefined') throw new Error("Cannot delete in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const Country = Parse.Object.extend("Country");
  const query = new Parse.Query(Country);
  const obj = await query.get(id);
  await obj.destroy();
}
