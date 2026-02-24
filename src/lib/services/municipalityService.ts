// $lib/services/municipalityService.ts

import type { Municipality, Province, Country, Departament, GeoPointData, PolygonData } from '$lib/types/types';


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

export async function getmunicipalitys(): Promise<Municipality[]> {
  if (typeof window === 'undefined') return [];

  const Parse = (await import('$lib/parseClient')).default;
  const Municipality = Parse.Object.extend("Municipality");

  const query = new Parse.Query(Municipality);
  query.include("province");
  query.include("province.departament");
  query.include("province.departament.country");
  query.limit(1000);

  try {
    const results = await query.find();

    return results.map((obj: any): Municipality => {
      const geopointData = obj.get("geopoint");
      const polygonData = obj.get("polygon");
      const provinceObj = obj.get("province");
      const departamentObj = provinceObj?.get("departament");
      const countryObj = departamentObj?.get("country");

      return {
        id: obj.id,
        code: obj.get("code"),
        name: obj.get("name"),
        province: provinceObj ? {
          id: provinceObj.id,
          code: provinceObj.get("code"),
          name: provinceObj.get("name"),
          departament: departamentObj ? {
            id: departamentObj.id,
            code: departamentObj.get("code"),
            name: departamentObj.get("name"),
            country: countryObj ? {
              id: countryObj.id,
              code: countryObj.get("code"),
              name: countryObj.get("name")
            } : { code: 0, name: "sin país" }
          } : { code: 0, name: "sin departamento" }
        } : { code: 0, name: "sin Provincia", departament: { code: 0, name: "Sin Departamento" } },
        location: toGeoPoint(geopointData),
        area: toPolygon(polygonData)
      };
    });
  } catch (error) {
    console.error("Error fetching municipalities:", error);
    return [];
  }
}

// NUEVA FUNCIÓN: Filtrar municipios por provincia
export async function getMunicipalitiesByProvince(provinceId: string): Promise<Municipality[]> {
  if (typeof window === 'undefined') return [];

  const Parse = (await import('$lib/parseClient')).default;
  const Municipality = Parse.Object.extend("Municipality");
  const Province = Parse.Object.extend("Province");

  const query = new Parse.Query(Municipality);
  
  // Crear pointer a la provincia
  const provincePointer = Province.createWithoutData(provinceId);
  query.equalTo("province", provincePointer);
  
  query.include("province");
  query.include("province.departament");
  query.include("province.departament.country");
  query.ascending("name");

  try {
    const results = await query.find();

    return results.map((obj: any): Municipality => {
      const geopointData = obj.get("geopoint");
      const polygonData = obj.get("polygon");
      const provinceObj = obj.get("province");
      const departamentObj = provinceObj?.get("departament");
      const countryObj = departamentObj?.get("country");

      return {
        id: obj.id,
        code: obj.get("code"),
        name: obj.get("name"),
        province: provinceObj ? {
          id: provinceObj.id,
          code: provinceObj.get("code"),
          name: provinceObj.get("name"),
          departament: departamentObj ? {
            id: departamentObj.id,
            code: departamentObj.get("code"),
            name: departamentObj.get("name"),
            country: countryObj ? {
              id: countryObj.id,
              code: countryObj.get("code"),
              name: countryObj.get("name")
            } : { code: 0, name: "sin país" }
          } : { code: 0, name: "sin departamento" }
        } : { code: 0, name: "sin Provincia", departament: { code: 0, name: "Sin Departamento" } },
        location: toGeoPoint(geopointData),
        area: toPolygon(polygonData)
      };
    });
  } catch (error) {
    console.error("Error fetching municipalities by province:", error);
    return [];
  }
}


export async function createMunicipality(data: {
  code: number;
  name: string;
  provinceId: string;
  location?: GeoPointData;
  area?: PolygonData;
}) {
  if (typeof window === 'undefined') throw new Error("Cannot create in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const Municipality = Parse.Object.extend("Municipality");

  const obj = new Municipality();

  obj.set("code", data.code);
  obj.set("name", data.name);

  // RELACIÓN: Province
  const Province = Parse.Object.extend("Province");
  const province = new Province();
  province.id = data.provinceId;
  obj.set("province", province);

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

  console.log('✅ Municipio creado exitosamente');

  return {
    id: obj.id,
    code: obj.get("code"),
    name: obj.get("name")
  };
}


export async function updateMunicipality(
  id: string,
  data: {
    code?: number;
    name: string;
    provinceId?: string;
    location?: GeoPointData;
    area?: PolygonData;
  }
) {
  if (typeof window === 'undefined') throw new Error("Cannot update in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const Municipality = Parse.Object.extend("Municipality");

  const query = new Parse.Query(Municipality);
  const obj = await query.get(id);

  if (data.code) obj.set("code", data.code);
  obj.set("name", data.name);

  if (data.provinceId) {
    const Province = Parse.Object.extend("Province");
    const province = new Province();
    province.id = data.provinceId;
    obj.set("province", province);
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

  console.log('✅ Municipio actualizado exitosamente');

  return {
    id: obj.id,
    code: obj.get("code"),
    name: obj.get("name")
  };
}


export async function deleteMunicipality(id: string) {
  if (typeof window === 'undefined') throw new Error("Cannot delete in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const Municipality = Parse.Object.extend("Municipality");

  const query = new Parse.Query(Municipality);
  const obj = await query.get(id);

  await obj.destroy();
  
  console.log('✅ Municipio eliminado exitosamente');
}