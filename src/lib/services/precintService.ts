// $lib/services/precinctService.ts

import type { Precinct, GeoPointData} from '$lib/types/types';


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

export async function getPrecincts(): Promise<Precinct[]> {
  if (typeof window === 'undefined') return [];

  const Parse = (await import('$lib/parseClient')).default;
  const precinct = Parse.Object.extend("Precinct");

  const query = new Parse.Query(precinct);
  query.include("locality");
  query.include("locality.municipality");
  query.include("locality.municipality.province");
  query.include("locality.municipality.province.departament");
  query.include("locality.municipality.province.departament.country");
  query.limit(1000);

  try {
    const results = await query.find();

    return results.map((obj: any): Precinct => {
      const geopointData = obj.get("geopoint");
      //const electoralProcessObj= obj.get("electoralProcess");
      const localityObj = obj.get("locality");
      const municipalityObj = localityObj.get("municipality");
      const provinceObj = municipalityObj.get("province");
      const departamentObj = provinceObj?.get("departament");
      const countryObj = departamentObj?.get("country");
      return {
        id: obj.id,
        code: obj.get("code"),
        name: obj.get("name"),
        locality: localityObj ? {
            id: localityObj.id,
            code:localityObj.get("code"),
            name:localityObj.get("name"),
            municipality: municipalityObj ? {
              id: municipalityObj.id,
              code: municipalityObj.get("code"),
              name: municipalityObj.get("name"),
              province: provinceObj ? {
                id: provinceObj.id,
                code: provinceObj.get("code"),
                name: provinceObj.get("name"),
                departament: departamentObj?{
                    id:departamentObj.id,
                    code: departamentObj.get("code"),
                    name:departamentObj.get("name"),
                    country:countryObj? {id:countryObj.id,code:countryObj.get("code"),name:countryObj.get("name")}:{code:0,name:"sin pais"},
                }:{code:0,name:"sin departamento"},
            } : { code: 0, name: "Sin provincia",departament:{code:0,name:""}},
            }:{code:0,name:"Sin municipio", province:{code:0,name:"", departament:{code:0,name:"",country:{code:0,name:""}}}},
        }:{code:0,name:"",municipality:{code:0,name:"",province:{code:0,name:"",departament:{code:0,name:""}}}},
        location: toGeoPoint(geopointData),
     //   electoralProcess: electoralProcessObj? {id:electoralProcessObj.id,name:electoralProcessObj.get("name"),year:electoralProcessObj.get("year"),type:electoralProcessObj.get("type"),state:electoralProcessObj.get("state")}:{name:"",year:0,type:"Departamental",state:""}
      };
    });
  } catch (error) {
    console.error("Error fetching precincts:", error);
    return [];
  }
}


export async function createPrecinct(data: {
  code: number;
  name: string;
  localityId: string;
 // electoralProcessId: string;
  location?: GeoPointData;
}) {
  if (typeof window === 'undefined') throw new Error("Cannot create in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const precinct = Parse.Object.extend("Precinct");

  const obj = new precinct();

  obj.set("code", data.code);
  obj.set("name", data.name);

  // RELACIÓN: Proceso
  /*const ElectoralProcess = Parse.Object.extend("ElectoralProcess");
  const electoralProcess = new ElectoralProcess();
  electoralProcess.id = data.electoralProcessId;
  obj.set("electoralProcess", electoralProcess);*/

  // RELACIÓN: Localidad
  const Locality = Parse.Object.extend("Locality");
  const locality = new Locality();
  locality.id = data.localityId;
  obj.set("locality", locality);

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


export async function updatePrecinct(
  id: string,
  data: {
  code: number;
  name: string;
  localityId: string;
  //electoralProcessId: string;
  location?: GeoPointData;
  }
) {
  if (typeof window === 'undefined') throw new Error("Cannot update in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const precinct = Parse.Object.extend("Precinct");

  const query = new Parse.Query(precinct);
  const obj = await query.get(id);

  if (data.code) obj.set("code", data.code);
  obj.set("name", data.name);
 /* if(data.electoralProcessId){
    const ElectoralProcess = Parse.Object.extend("ElectoralProcess");
    const electoralProcess = new ElectoralProcess();
    electoralProcess.id = data.electoralProcessId;
    obj.set("electoralProcess", electoralProcess);
  }*/

  if (data.localityId) {
  // RELACIÓN: Localidad
  const Locality = Parse.Object.extend("Locality");
  const locality = new Locality();
  locality.id = data.localityId;
  obj.set("locality", locality);
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


export async function deletePrecinct(id: string) {
  if (typeof window === 'undefined') throw new Error("Cannot delete in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const precinct = Parse.Object.extend("Precinct");

  const query = new Parse.Query(precinct);
  const obj = await query.get(id);

  await obj.destroy();
  
  console.log('✅ precincto eliminado exitosamente');
}