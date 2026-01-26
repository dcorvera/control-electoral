// $lib/services/localityService.ts

import type { Locality, GeoPointData} from '$lib/types/types';


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



// Main Service ------------------------------

export async function getLocalitys(): Promise<Locality[]> {
  if (typeof window === 'undefined') return [];

  const Parse = (await import('$lib/parseClient')).default;
  const Locality = Parse.Object.extend("Locality");

  const query = new Parse.Query(Locality);
  query.include("municipality");
  query.include("municipality.province");
  query.include("municipality.province.departament");
  query.include("municipality.province.departament.country");
  query.limit(1000);

  try {
    const results = await query.find();

    return results.map((obj: any): Locality => {
      console.log(obj);
      const geopointData = obj.get("geopoint");
      const municipalityObj = obj.get("municipality");
      const provinceObj = municipalityObj.get("province");
      const departamentObj = provinceObj.get("departament");
      const countryObj = departamentObj.get("country");
      return {
        id: obj.id,
        code: obj.get("code"),
        name: obj.get("name"),
        municipality: municipalityObj ? {
          id: municipalityObj.id,
          code: municipalityObj.get("code"),
          name: municipalityObj.get("name"),
          province: provinceObj?{
            id:provinceObj.id,
            code: provinceObj.get("code"),
            name:provinceObj.get("name"),
            departament: departamentObj?{
                id:departamentObj.id,
                code:departamentObj.get("code"),
                name:departamentObj.get("name"),
                country:countryObj.id}:{code:0,name:"sin departamento"},
          }:{code:0,name:"sin Provincia",departament:{code:0,name:"Sin Departamento"}},
        } : { code: 0, name: 'Sin Municipio',province:{code:0,name:"Sin Provincia"} },
        location: toGeoPoint(geopointData),
      };
    });
  } catch (error) {
    console.error("Error fetching localitys:", error);
    return [];
  }
}


export async function createLocality(data: {
  code: number;
  name: string;
  municipalityId: string;
  location?: GeoPointData;
}) {
  if (typeof window === 'undefined') throw new Error("Cannot create in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const locality = Parse.Object.extend("Locality");

  const obj = new locality();

  obj.set("code", data.code);
  obj.set("name", data.name);

  // RELACIÓN: Municipio
  const Municipality = Parse.Object.extend("Municipality");
  const municipality = new Municipality();
  municipality.id = data.municipalityId;
  obj.set("municipality", municipality);

  // Location como objeto JSON con nombre diferente
  if (data.location) {
    obj.set("geopoint", {
      lat: data.location.latitude,
      lng: data.location.longitude
    });
    console.log('📍 Geopoint guardado:', data.location);
  }

  await obj.save();

  console.log('✅ Localidad creada exitosamente');

  return {
    id: obj.id,
    code: obj.get("code"),
    name: obj.get("name")
  };
}


export async function updateLocality(
  id: string,
  data: {
  code: number;
  name: string;
  municipalityId: string;
  location?: GeoPointData;
  }
) {
  if (typeof window === 'undefined') throw new Error("Cannot update in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const locality = Parse.Object.extend("Locality");

  const query = new Parse.Query(locality);
  const obj = await query.get(id);

  if (data.code) obj.set("code", data.code);
  obj.set("name", data.name);

  if (data.municipalityId) {
  const Municipality = Parse.Object.extend("Municipality");
  const municipality = new Municipality();
  municipality.id = data.municipalityId;
  obj.set("municipality", municipality);
  }

  // Location como objeto JSON con nombre diferente
  if (data.location) {
    obj.set("geopoint", {
      lat: data.location.latitude,
      lng: data.location.longitude
    });
    console.log('📍 Geopoint actualizado:', data.location);
  }


  await obj.save();

  console.log('✅ Localidad actualizada exitosamente');

  return {
    id: obj.id,
    code: obj.get("code"),
    name: obj.get("name")
  };
}


export async function deleteLocality(id: string) {
  if (typeof window === 'undefined') throw new Error("Cannot delete in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const locality = Parse.Object.extend("Locality");

  const query = new Parse.Query(locality);
  const obj = await query.get(id);

  await obj.destroy();
  
  console.log('✅ localityo eliminado exitosamente');
}