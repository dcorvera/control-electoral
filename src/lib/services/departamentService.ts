// $lib/services/departamentService.ts

import type { Departament, Country, GeoPointData, PolygonData } from '$lib/types/types';


// Helpers ------------------------------

// Convert JSON -> TS GeoPoint
const toGeoPoint = (data: any): GeoPointData | undefined => {
  if (!data || typeof data !== 'object') return undefined;
  
  // Estructura con lat/lng
  if (data.lat !== undefined && data.lng !== undefined) {
    return { latitude: data.lat, longitude: data.lng };
  }
  
  // Estructura con latitude/longitude (retrocompatibilidad)
  if (data.latitude !== undefined && data.longitude !== undefined) {
    return { latitude: data.latitude, longitude: data.longitude };
  }
  
  return undefined;
};

// Convert JSON -> TS Polygon
const toPolygon = (data: any): PolygonData | undefined => {
  if (!data || typeof data !== 'object') return undefined;
  
  // Si tiene la estructura {points: [...]}
  if (data.points && Array.isArray(data.points)) {
    return data.points as PolygonData;
  }
  
  // Si tiene la estructura {coordinates: [...]} (retrocompatibilidad)
  if (data.coordinates && Array.isArray(data.coordinates)) {
    return data.coordinates as PolygonData;
  }
  
  // Si es directamente un array (retrocompatibilidad)
  if (Array.isArray(data)) {
    return data as PolygonData;
  }
  
  return undefined;
};


// Main Service ------------------------------

// Alias para compatibilidad con el componente (nombre en inglés)
export async function getDepartments(): Promise<Departament[]> {
  return getDepartaments();
}

export async function getDepartaments(): Promise<Departament[]> {
  if (typeof window === 'undefined') return [];

  const Parse = (await import('$lib/parseClient')).default;
  const Department = Parse.Object.extend("Departament");

  const query = new Parse.Query(Department);
  query.include("country");

  try {
    const results = await query.find();

    return results.map((obj: any): Departament => {
      const countryObj = obj.get("country");
      const geopointData = obj.get("geopoint");
      const polygonData = obj.get("polygon");
      
      return {
        id: obj.id,
        code: obj.get("code"),
        name: obj.get("name"),
        country: countryObj ? {
          id: countryObj.id,
          code: countryObj.get("code"),
          name: countryObj.get("name")
        } : { code: 0, name: 'Sin país' },
        location: toGeoPoint(geopointData),
        area: toPolygon(polygonData)
      };
    });
  } catch (error) {
    console.error("Error fetching Departaments:", error);
    return [];
  }
}


export async function createDepartament(data: {
  code: number;
  name: string;
  countryId: string;
  location?: GeoPointData;
  area?: PolygonData;
}) {
  if (typeof window === 'undefined') throw new Error("Cannot create in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const Department = Parse.Object.extend("Departament");

  const obj = new Department();

  obj.set("code", data.code);
  obj.set("name", data.name);

  // RELACIÓN: Country
  const Country = Parse.Object.extend("Country");
  const country = new Country();
  country.id = data.countryId;
  obj.set("country", country);

  // Location como objeto JSON con nombre diferente
  if (data.location) {
    obj.set("geopoint", {
      lat: data.location.latitude,
      lng: data.location.longitude
    });
    console.log('📍 Geopoint guardado:', data.location);
  }

  // Area como objeto JSON con nombre diferente para evitar detección geoespacial
  if (data.area) {
    // Usar "polygon" en lugar de "area"
    obj.set("polygon", {
      points: data.area
    });
    console.log('🗺️ Polygon guardado:', data.area.length, 'puntos');
  }

  await obj.save();

  console.log('✅ Departamento creado exitosamente');

  return {
    id: obj.id,
    code: obj.get("code"),
    name: obj.get("name")
  };
}


export async function updateDepartament(
  id: string,
  data: {
    code?: number;
    name: string;
    countryId?: string;
    location?: GeoPointData;
    area?: PolygonData;
  }
) {
  if (typeof window === 'undefined') throw new Error("Cannot update in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const Department = Parse.Object.extend("Departament");

  const query = new Parse.Query(Department);
  const obj = await query.get(id);

  if (data.code) obj.set("code", data.code);
  obj.set("name", data.name);

  if (data.countryId) {
    const Country = Parse.Object.extend("Country");
    const country = new Country();
    country.id = data.countryId;
    obj.set("country", country);
  }

  // Location como objeto JSON con nombre diferente
  if (data.location) {
    obj.set("geopoint", {
      lat: data.location.latitude,
      lng: data.location.longitude
    });
    console.log('📍 Geopoint actualizado:', data.location);
  }

  // Area como objeto JSON con nombre diferente
  if (data.area && data.area.length >= 3) {
    obj.set("polygon", {
      points: data.area
    });
    console.log('🗺️ Polygon actualizado:', data.area.length, 'puntos');
  }

  await obj.save();

  console.log('✅ Departamento actualizado exitosamente');

  return {
    id: obj.id,
    code: obj.get("code"),
    name: obj.get("name")
  };
}


export async function deleteDepartament(id: string) {
  if (typeof window === 'undefined') throw new Error("Cannot delete in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const Department = Parse.Object.extend("Departament");

  const query = new Parse.Query(Department);
  const obj = await query.get(id);

  await obj.destroy();
  
  console.log('✅ Departamento eliminado exitosamente');
}