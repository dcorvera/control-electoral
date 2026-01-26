// // $lib/services/geographyImportService.ts

// import type { Country, Departament, Province, Municipality, Locality, Precinct } from '$lib/types/types';
// import { getCountry, createCountry } from './countryService';
// import { getDepartaments, createDepartament } from './departamentService';
// import { getprovinces, createprovince } from './provinceService';
// import { getmunicipalitys, createMunicipality } from './municipalityService';
// import { getLocalitys, createLocality } from './localityService';
// import { getPrecincts, createPrecinct } from './precintService';
// import { createPollingTable } from './pollingTableService';

// interface ExcelRow {
//   Codigo?: number;
//   Descripcion?: string;
//   CodigoPais?: number;
//   NombrePais?: string;
//   CodigoDepartamento?: number;
//   NombreDepartamento?: string;
//   CodigoProvincia?: number;
//   NombreProvincia?: string;
//   CodigoSeccion?: number;
//   NombreMunicipio?: string;
//   CodigoLocalidad?:number;
//   NombreLocalidad?:string;
//   CodigoRecinto?: number;
//   NombreRecinto?: string;
//   NumeroMesa?: number;
//   Inscritos?: number;
// }

// export interface ImportResult {
//   countries: number;
//   departaments: number;
//   provinces: number;
//   municipalities: number;
//   localities: number;
//   precincts: number;
//   tables: number;
//   totalRows: number;
//   errors: Array<{ row: number; message: string }>;
// }

// // Cache para evitar duplicados
// const cache = {
//   countries: new Map<number, string>(),
//   departaments: new Map<number, string>(),
//   provinces: new Map<number, string>(),
//   municipalities: new Map<number, string>(),
//   localities: new Map<number, string>(),
//   precincts: new Map<number, string>()
// };

// function clearCache() {
//   cache.countries.clear();
//   cache.departaments.clear();
//   cache.provinces.clear();
//   cache.municipalities.clear();
//   cache.localities.clear();
//   cache.precincts.clear();
// }

// export async function importGeographyFromExcel(file: File): Promise<ImportResult> {
//   const result: ImportResult = {
//     countries: 0,
//     departaments: 0,
//     provinces: 0,
//     municipalities: 0,
//     localities: 0,
//     precincts: 0,
//     tables: 0,
//     totalRows: 0,
//     errors: []
//   };

//   // Limpiar cache al inicio
//   clearCache();

//   try {
//     // Importar SheetJS dinámicamente (solo en el navegador)
//     const XLSX = await import('xlsx');
    
//     // Leer archivo
//     const data = await file.arrayBuffer();
//     const workbook = XLSX.read(data, { type: 'array' });
//     const worksheet = workbook.Sheets[workbook.SheetNames[0]];
//     const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

//     result.totalRows = rows.length;

//     if (rows.length === 0) {
//       throw new Error('El archivo está vacío');
//     }

//     // Cargar datos existentes
//     console.log('Cargando datos existentes...');
//     const existingCountries = await getCountry();
//     const existingDepartaments = await getDepartaments();
//     const existingProvinces = await getprovinces();
//     const existingMunicipalities = await getmunicipalitys();
//     const existingLocalities = await getLocalitys();
//     const existingPrecincts = await getPrecincts();

//     // Poblar cache con datos existentes
//     existingCountries.forEach(c => { console.log(c);cache.countries.set(c.code, c.id!);});
//     existingDepartaments.forEach(d => cache.departaments.set(d.code, d.id!));
//     existingProvinces.forEach(p => cache.provinces.set(p.code, p.id!));
//     existingMunicipalities.forEach(m => cache.municipalities.set(m.code, m.id!));
//     existingLocalities.forEach(l => cache.localities.set(l.code, l.id!));
//     existingPrecincts.forEach(p => cache.precincts.set(p.code, p.id!));

//     console.log(`Procesando ${rows.length} filas...`);

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];
//      // console.log(row);
//       try {
//         // Validar datos requeridos
//         if (!row.CodigoPais || !row.NombrePais) {
//           throw new Error('Faltan datos de país');
//         }
//         if (!row.CodigoDepartamento || !row.NombreDepartamento) {
//           throw new Error('Faltan datos de departamento');
//         }
//         if (!row.CodigoProvincia || !row.NombreProvincia) {
//           throw new Error('Faltan datos de provincia');
//         }
//         if (!row.CodigoSeccion || !row.NombreMunicipio) {
//           throw new Error('Faltan datos de municipio');
//         }
//         if (!row.CodigoLocalidad || !row.NombreLocalidad) {
//           throw new Error('Faltan datos de localidad');
//         }
//         if (!row.CodigoRecinto || !row.NombreRecinto) {
//           throw new Error('Faltan datos de recinto');
//         }
//         if (!row.NumeroMesa) {
//           throw new Error('Falta número de mesa');
//         }

//         // 1. País
//         let countryId = cache.countries.get(row.CodigoPais);
//         console.log(countryId, row.CodigoPais);
//         if (!countryId) {
//           const newCountry = await createCountry({
//             code: row.CodigoPais,
//             name: row.NombrePais
//           });
//           countryId = newCountry.id!;
//           cache.countries.set(row.CodigoPais, countryId || '');
//           result.countries++;
//         }

//        // 2. Departamento
//         const deptCode = row.CodigoDepartamento;
//         let departamentId = cache.departaments.get(deptCode);
//         if (!departamentId) {
//           const newDept = await createDepartament({
//             code: deptCode,
//             name: row.NombreDepartamento,
//             countryId: countryId || '',
//             location: {latitude: -21.534731229266253,longitude: -64.74335840121152},
//             area: []
//           });
//           departamentId = newDept.id!;
//           cache.departaments.set(deptCode, departamentId || '');
//           result.departaments++;
//         }

//         // 3. Provincia
//         const provCode = row.CodigoProvincia;
//         let provinceId = cache.provinces.get(provCode);
//         if (!provinceId) {
//           const newProv = await createprovince({
//             code: provCode,
//             name: row.NombreProvincia,
//             departamentId: departamentId || '',
//             location: {latitude: -21.534731229266253,longitude: -64.74335840121152},
//             area: []
//           });
//           provinceId = newProv.id!;
//           cache.provinces.set(provCode, provinceId ||'');
//           result.provinces++;
//         }

//         // 4. Municipio
//         let municipalityId = cache.municipalities.get(row.CodigoSeccion);
//         if (!municipalityId) {
//           const newMun = await createMunicipality({
//             code: row.CodigoSeccion,
//             name: row.NombreMunicipio,
//             provinceId: provinceId || '',
//             location: {latitude: -21.534731229266253,longitude: -64.74335840121152},
//             area: []
//           });
//           municipalityId = newMun.id!;
//           cache.municipalities.set(row.CodigoSeccion, municipalityId ||'');
//           result.municipalities++;
//         }

//         // 5. Localidad (usando municipio como localidad)
//         // Si tienes tabla de localidades separada, agrégala aquí
//         let localityId = cache.localities.get(row.CodigoLocalidad);
//         if (!localityId) {
//           const newMun = await createLocality({
//             code: row.CodigoSeccion,
//             name: row.NombreMunicipio,
//             municipalityId: municipalityId || '',
//             location: {latitude: -21.534731229266253,longitude: -64.74335840121152}
//           });
//           localityId = newMun.id!;
//           cache.localities.set(row.CodigoLocalidad, localityId ||'');
//           result.localities++;
//         }

//         // 6. Recinto
//         let precinctId = cache.precincts.get(row.CodigoRecinto);
//         if (!precinctId) {
//           const newPrecinct = await createPrecinct({
//             code: row.CodigoRecinto,
//             name: row.NombreRecinto,
//             localityId: localityId || '',
//             location: undefined
//           });
//           precinctId = newPrecinct.id!;
//           cache.precincts.set(row.CodigoRecinto, precinctId || '');
//           result.precincts++;
//         }

//         // 7. Mesa con código de acta
//         const actCode = row.Codigo || generateActCode(row.CodigoRecinto, row.NumeroMesa);
        
//         await createPollingTable({
//           number: row.NumeroMesa,
//           inscribedCount: row.Inscritos || 0,
//           actCode: actCode,
//           precinctId: precinctId || ''
//         });
        
//         result.tables++;

//         // Log progreso cada 10 filas
//         if ((i + 1) % 10 === 0) {
//           console.log(`Procesadas ${i + 1}/${rows.length} filas`);
//         }

//       } catch (error: any) {
//         result.errors.push({
//           row: i + 2, // +2 porque Excel empieza en 1 y hay header
//           message: error.message || 'Error desconocido'
//         });
//         console.error(`Error en fila ${i + 2}:`, error);
//       }
        
//     }

//     console.log('✅ Importación completada:', result);
//     return result;

//   } catch (error: any) {
//     console.error('Error en importación:', error);
//     throw new Error(`Error procesando archivo: ${error.message}`);
//   }
// }

// // Función para generar código de acta correlativo
// export function generateActCode(
//   codigoRecinto: number,
//   numeroMesa: number,
// ): number {
//   const recintoStr = codigoRecinto;
//   const mesaStr = numeroMesa;
//   return recintoStr + mesaStr;
// }

// $lib/services/geographyImportService.ts

import type { Country, Departament, Province, Municipality, Locality, Precinct } from '$lib/types/types';
import { getCountry, createCountry } from './countryService';
import { getDepartaments, createDepartament } from './departamentService';
import { getprovinces, createprovince } from './provinceService';
import { getmunicipalitys, createMunicipality } from './municipalityService';
import { getLocalitys, createLocality } from './localityService';
import { getPrecincts, createPrecinct } from './precintService';
import { createPollingTable } from './pollingTableService';

interface ExcelRow {
  CodigoMesa?: number;
  Descripcion?: string;
  CodigoPais?: number;
  NombrePais?: string;
  CodigoDepartamento?: number;
  NombreDepartamento?: string;
  CodigoProvincia?: number;
  NombreProvincia?: string;
  CodigoSeccion?: number;
  NombreMunicipio?: string;
  CodigoLocalidad?:number;
  NombreLocalidad?:string;
  CodigoRecinto?: number;
  NombreRecinto?: string;
  NumeroMesa?: number;
  InscritosHabilitados?: number;
}

export interface ImportResult {
  countries: number;
  departaments: number;
  provinces: number;
  municipalities: number;
  localities: number;
  precincts: number;
  tables: number;
  totalRows: number;
  errors: Array<{ row: number; message: string }>;
}

// Cache con códigos compuestos únicos
const cache = {
  countries: new Map<number, string>(), // codigo_pais -> id
  departaments: new Map<string, string>(), // "codigo_pais-codigo_dept" -> id
  provinces: new Map<string, string>(), // "codigo_pais-codigo_dept-codigo_prov" -> id
  municipalities: new Map<string, string>(), // "codigo_pais-codigo_dept-codigo_prov-codigo_mun" -> id
  localities: new Map<string, string>(), // "codigo_pais-...-codigo_loc" -> id
  precincts: new Map<string, string>() // "codigo_pais-...-codigo_recinto" -> id
};

// Funciones para generar claves compuestas únicas
function getDepartamentKey(codigoPais: number, codigoDept: number): string {
  return `${codigoPais}-${codigoDept}`;
}

function getProvinceKey(codigoPais: number, codigoDept: number, codigoProv: number): string {
  return `${codigoPais}-${codigoDept}-${codigoProv}`;
}

function getMunicipalityKey(codigoPais: number, codigoDept: number, codigoProv: number, codigoMun: number): string {
  return `${codigoPais}-${codigoDept}-${codigoProv}-${codigoMun}`;
}

function getLocalityKey(codigoPais: number, codigoDept: number, codigoProv: number, codigoMun: number, codigoLoc: number): string {
  return `${codigoPais}-${codigoDept}-${codigoProv}-${codigoMun}-${codigoLoc}`;
}

function getPrecinctKey(codigoPais: number, codigoDept: number, codigoProv: number, codigoMun: number, codigoLoc: number, codigoRec: number): string {
  return `${codigoPais}-${codigoDept}-${codigoProv}-${codigoMun}-${codigoLoc}-${codigoRec}`;
}

function clearCache() {
  cache.countries.clear();
  cache.departaments.clear();
  cache.provinces.clear();
  cache.municipalities.clear();
  cache.localities.clear();
  cache.precincts.clear();
}

export async function importGeographyFromExcel(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    countries: 0,
    departaments: 0,
    provinces: 0,
    municipalities: 0,
    localities: 0,
    precincts: 0,
    tables: 0,
    totalRows: 0,
    errors: []
  };

  clearCache();

  try {
    const XLSX = await import('xlsx');
    
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

    result.totalRows = rows.length;

    if (rows.length === 0) {
      throw new Error('El archivo está vacío');
    }

    console.log('📊 Cargando datos existentes...');
    const existingCountries = await getCountry();
    const existingDepartaments = await getDepartaments();
    const existingProvinces = await getprovinces();
    const existingMunicipalities = await getmunicipalitys();
    const existingLocalities = await getLocalitys();
    const existingPrecincts = await getPrecincts();

    // Poblar cache con códigos compuestos
    existingCountries.forEach(c => {
      cache.countries.set(c.code, c.id!);
    });

    existingDepartaments.forEach(d => {
      if (d.country?.code) {
        const key = getDepartamentKey(d.country.code, Number(d.code));
        cache.departaments.set(key, d.id!);
      }
    });

    existingProvinces.forEach(p => {
      if (p.departament?.country?.code && p.departament?.code) {
        const key = getProvinceKey(
          p.departament.country.code,
          Number(p.departament.code),
          Number(p.code)
        );
        cache.provinces.set(key, p.id!);
      }
    });

    existingMunicipalities.forEach(m => {
      if (m.province?.departament?.country?.code && m.province?.departament?.code && m.province?.code) {
        const key = getMunicipalityKey(
          m.province.departament.country.code,
          Number(m.province.departament.code),
          Number(m.province.code),
          m.code
        );
        cache.municipalities.set(key, m.id!);
      }
    });

    existingLocalities.forEach(l => {
      if (l.municipality?.province?.departament?.country?.code && l.municipality?.province?.departament?.code && l.municipality?.province?.code) {
        const key = getLocalityKey(
          l.municipality.province.departament.country.code,
          Number(l.municipality.province.departament.code),
          Number(l.municipality.province.code),
          Number(l.municipality.code),
          l.code
        );
        cache.localities.set(key, l.id!);
      }
    });

    existingPrecincts.forEach(p => {
      // Asumiendo que locality tiene la jerarquía completa
      if (p.locality?.municipality?.province?.departament?.country?.code) {
        const loc = p.locality;
        const key = getPrecinctKey(
          loc.municipality!.province!.departament!.country!.code,
          Number(loc.municipality!.province!.departament!.code),
          Number(loc.municipality!.province!.code),
          loc.municipality!.code,
          Number(loc.code),
          p.code
        );
        cache.precincts.set(key, p.id!);
      }
    });

    console.log(`📝 Procesando ${rows.length} filas...`);
    console.log(`Cache inicial: ${cache.countries.size} países, ${cache.departaments.size} deptos, ${cache.provinces.size} provincias`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Validaciones
        if (!row.CodigoPais || !row.NombrePais) throw new Error('Faltan datos de país');
        if (!row.CodigoDepartamento || !row.NombreDepartamento) throw new Error('Faltan datos de departamento');
        if (!row.CodigoProvincia || !row.NombreProvincia) throw new Error('Faltan datos de provincia');
        if (!row.CodigoSeccion || !row.NombreMunicipio) throw new Error('Faltan datos de municipio');
         if (!row.CodigoLocalidad || !row.NombreLocalidad) throw new Error('Faltan datos de localidad');
        if (!row.CodigoRecinto || !row.NombreRecinto) throw new Error('Faltan datos de recinto');
        if (!row.NumeroMesa) throw new Error('Falta número de mesa');

        // 1. PAÍS (código simple, único globalmente)
        let countryId = cache.countries.get(row.CodigoPais);
        if (!countryId) {
          const newCountry = await createCountry({
            code: row.CodigoPais,
            name: row.NombrePais
          });
          countryId = newCountry.id!;
          cache.countries.set(row.CodigoPais, countryId || '');
          result.countries++;
          console.log(`✅ País creado: ${row.NombrePais} (${row.CodigoPais})`);
        }

        // 2. DEPARTAMENTO (código compuesto: pais-dept)
        const deptKey = getDepartamentKey(row.CodigoPais, row.CodigoDepartamento);
        let departamentId = cache.departaments.get(deptKey);
        
        if (!departamentId) {
          const newDept = await createDepartament({
            code: row.CodigoDepartamento,
            name: row.NombreDepartamento,
            countryId: countryId || '',
            location: {latitude: -21.534731229266253,longitude: -64.74335840121152},
            area: []
          });
          departamentId = newDept.id!;
          cache.departaments.set(deptKey, departamentId ||'');
          result.departaments++;
          console.log(`✅ Departamento creado: ${row.NombreDepartamento} (${deptKey})`);
        }

        // 3. PROVINCIA (código compuesto: pais-dept-prov)
        const provKey = getProvinceKey(row.CodigoPais, row.CodigoDepartamento, row.CodigoProvincia);
        let provinceId = cache.provinces.get(provKey);
        
        if (!provinceId) {
          const newProv = await createprovince({
            code: row.CodigoProvincia,
            name: row.NombreProvincia,
            departamentId: departamentId || '',
            location: {latitude: -21.534731229266253,longitude: -64.74335840121152},
            area: []
          });
          provinceId = newProv.id!;
          cache.provinces.set(provKey, provinceId || '');
          result.provinces++;
          console.log(`✅ Provincia creada: ${row.NombreProvincia} (${provKey})`);
        }

        // 4. MUNICIPIO (código compuesto: pais-dept-prov-mun)
        const munKey = getMunicipalityKey(row.CodigoPais, row.CodigoDepartamento, row.CodigoProvincia,row.CodigoSeccion);
        let municipalityId = cache.municipalities.get(munKey);
        
        if (!municipalityId) {
          const newMun = await createMunicipality({
            code: row.CodigoSeccion,
            name: row.NombreMunicipio,
            provinceId: provinceId || '',
            location: {latitude: -21.534731229266253,longitude: -64.74335840121152},
            area: []
          });
          municipalityId = newMun.id!;
          cache.municipalities.set(munKey, municipalityId || '');
          result.municipalities++;
          console.log(`✅ Municipio creado: ${row.NombreMunicipio} (${munKey})`);
        }

        // 5. LOCALIDAD (por ahora, usar municipio como localidad)
        // Si tienes tabla separada, agregar lógica similar con código compuesto
        const locKey = getLocalityKey(row.CodigoPais, row.CodigoDepartamento, row.CodigoProvincia, row.CodigoSeccion,row.CodigoLocalidad);
        let localityId = cache.localities.get(locKey);
        
        if (!localityId) {
          const newLoc = await createLocality({
            code: row.CodigoLocalidad,
            name: row.NombreLocalidad,
            municipalityId: municipalityId || '',
            location: {latitude: -21.534731229266253,longitude: -64.74335840121152}
          });
          localityId = newLoc.id!;
          cache.localities.set(locKey, localityId || '');
          result.localities++;
          console.log(`✅ Localidad creada: ${row.NombreLocalidad} (${locKey})`);
        }

        // 6. RECINTO (código compuesto completo)
        const recintoKey = getPrecinctKey(
          row.CodigoPais, 
          row.CodigoDepartamento, 
          row.CodigoProvincia, 
          row.CodigoSeccion,
          row.CodigoLocalidad, 
          row.CodigoRecinto
        );
        let precinctId = cache.precincts.get(recintoKey);
        
        if (!precinctId) {
          const newPrecinct = await createPrecinct({
            code: row.CodigoRecinto,
            name: row.NombreRecinto,
            localityId: localityId || '',
            location: {latitude: -21.534731229266253,longitude: -64.74335840121152}
          });
          precinctId = newPrecinct.id!;
          cache.precincts.set(recintoKey, precinctId || '');
          result.precincts++;
          console.log(`✅ Recinto creado: ${row.NombreRecinto} (${recintoKey})`);
        }

        // 7. MESA con código de acta del Excel
       // const actCode = row.Codigo || generateActCode(row.CodigoRecinto, row.NumeroMesa);
        const actCode = row.CodigoMesa;
        await createPollingTable({
          number: row.NumeroMesa,
          inscribedCount: row.InscritosHabilitados || 0,
          actCode: actCode,
          precinctId: precinctId || ''
        });
        
        result.tables++;

        if ((i + 1) % 10 === 0) {
          console.log(`📊 Procesadas ${i + 1}/${rows.length} filas`);
        }

      } catch (error: any) {
        result.errors.push({
          row: i + 2,
          message: error.message || 'Error desconocido'
        });
        console.error(`❌ Error en fila ${i + 2}:`, error);
      }
    }

    console.log('✅ Importación completada:', result);
    return result;

  } catch (error: any) {
    console.error('💥 Error en importación:', error);
    throw new Error(`Error procesando archivo: ${error.message}`);
  }
}

export function generateActCode(
  codigoRecinto: number,
  numeroMesa: number,
  prefijo: string = 'ACT'
): number {
  const recintoStr = codigoRecinto;
  const mesaStr = numeroMesa;
  return recintoStr+mesaStr;
}