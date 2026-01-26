// $lib/services/provinceService.ts

import type { Province, Country,Departament, GeoPointData, PolygonData } from '$lib/types/types';


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

export async function getprovinces(): Promise<Province[]> {
  if (typeof window === 'undefined') return [];

  const Parse = (await import('$lib/parseClient')).default;
  const Province = Parse.Object.extend("Province");

  const query = new Parse.Query(Province);
  query.include("departament");

  try {
    const results = await query.find();

    return results.map((obj: any): Province => {
      const departamentObj = obj.get("departament");
      const geopointData = obj.get("geopoint");
      const polygonData = obj.get("polygon");
      
      // Debug logs
      console.log('📦 province desde Parse:', {
        id: obj.id,
        name: obj.get("name"),
        geopoint: geopointData,
        polygon: polygonData
      });
      
      return {
        id: obj.id,
        code: obj.get("code"),
        name: obj.get("name"),
        departament: departamentObj ? {
          id: departamentObj.id,
          code: departamentObj.get("code"),
          name: departamentObj.get("name"),
          country: departamentObj.get('country'),
        } : { code: 0, name: 'Sin departamento' },
        location: toGeoPoint(geopointData),
        area: toPolygon(polygonData)
      };
    });
  } catch (error) {
    console.error("Error fetching provinces:", error);
    return [];
  }
}


export async function createprovince(data: {
  code: number;
  name: string;
  departamentId: string;
  location?: GeoPointData;
  area?: PolygonData;
}) {
  if (typeof window === 'undefined') throw new Error("Cannot create in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const Province = Parse.Object.extend("Province");

  const obj = new Province();

  obj.set("code", data.code);
  obj.set("name", data.name);

  // RELACIÓN: Country
  const Departament = Parse.Object.extend("Departament");
  const departament = new Departament();
  departament.id = data.departamentId;
  obj.set("departament", departament);

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

  console.log('✅ provinceo creado exitosamente');

  return {
    id: obj.id,
    code: obj.get("code"),
    name: obj.get("name")
  };
}


export async function updateprovince(
  id: string,
  data: {
    code?: number;
    name: string;
    departamentId?: string;
    location?: GeoPointData;
    area?: PolygonData;
  }
) {
  if (typeof window === 'undefined') throw new Error("Cannot update in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const Province = Parse.Object.extend("Province");

  const query = new Parse.Query(Province);
  const obj = await query.get(id);

  if (data.code) obj.set("code", data.code);
  obj.set("name", data.name);

  if (data.departamentId) {
    const Departament = Parse.Object.extend("Departament");
    const departament = new Departament();
    departament.id = data.departamentId;
    obj.set("departament", departament);
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

  console.log('✅ provinceo actualizado exitosamente');

  return {
    id: obj.id,
    code: obj.get("code"),
    name: obj.get("name")
  };
}


export async function deleteprovince(id: string) {
  if (typeof window === 'undefined') throw new Error("Cannot delete in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const Province = Parse.Object.extend("Province");

  const query = new Parse.Query(Province);
  const obj = await query.get(id);

  await obj.destroy();
  
  console.log('✅ provinceo eliminado exitosamente');
}