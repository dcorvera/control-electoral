// $lib/services/actaGenerationService.ts

import { getPollingTables } from './pollingTableService';
import { getElectoralPositions } from './electoralPositionService';
import { getPartyParticipations } from './partyParticipationService';
import { createActa } from './actaService';
import type { ElectoralProcess, PollingTable, ElectoralPosition, PartyParticipation } from '$lib/types/types';

/**
 * Genera actas para todas las mesas de un proceso electoral
 * Cada acta tendrá múltiples franjas (cargos) según el alcance geográfico
 * IMPORTANTE: Solo genera franjas para cargos que tienen partidos asignados
 */
export async function generateActasForProcess(
  processId: string,
  departmentId?: string,
  provinceId?: string,
  municipalityId?: string
) {
  const Parse = (await import('$lib/parseClient')).default;
  
  // 1. Obtener todos los cargos del proceso
  const allPositions = await getElectoralPositions();
  const processPositions = allPositions.filter(p => p.electoralProcess.id === processId);
  
  // 2. Obtener todas las participaciones de partidos
  const allParticipations = await getPartyParticipations();
  
  // 3. Obtener todas las mesas (filtrar por alcance geográfico si es necesario)
  let tables = await getPollingTables();
  
  // Filtrar mesas según alcance geográfico
  // TODO: Implementar filtro según precinto/localidad/municipio
  
  console.log(`📋 Generando actas para ${tables.length} mesas...`);
  console.log(`📊 Partidos disponibles: ${allParticipations.length}`);
  
  const results: {
    created: number;
    errors: number;
    skipped: number;
    details: Array<{
      mesa: number;
      code: string;
      franjas: number;
      status: 'created' | 'skipped' | 'exists' | 'error';
      reason?: string;
    }>;
  } = {
    created: 0,
    errors: 0,
    skipped: 0,
    details: []
  };
  
  // 4. Para cada mesa, crear UN ACTA con todas las franjas
  for (const table of tables) {
    try {
      // Determinar qué franjas (cargos) aplican a esta mesa según su ubicación geográfica
      const applicableFranjas = getApplicableFranjas(
        processPositions,
        allParticipations,
        table,
        departmentId,
        provinceId,
        municipalityId
      );
      
      // Si no hay franjas aplicables, OMITIR esta mesa
      if (applicableFranjas.length === 0) {
        console.warn(`⚠️ Mesa ${table.number}: Sin partidos asignados - OMITIDA`);
        results.skipped++;
        results.details.push({
          mesa: table.number,
          code: `MESA-${table.number}`,
          franjas: 0,
          status: 'skipped',
          reason: 'Sin partidos asignados para ningún cargo'
        });
        continue;
      }
      
      // Crear código único del acta
      const actaCode = generateActaCode(table, processId);
      
      // Verificar si ya existe
      const ActaClass = Parse.Object.extend('Acta');
      const existingQuery = new Parse.Query(ActaClass);
      existingQuery.equalTo('code', actaCode);
      const existing = await existingQuery.first();
      
      if (existing) {
        console.log(`ℹ️ Mesa ${table.number}: Acta ya existe (${actaCode})`);
        results.details.push({
          mesa: table.number,
          code: actaCode,
          franjas: applicableFranjas.length,
          status: 'exists',
          reason: 'Acta ya generada previamente'
        });
        continue;
      }
      
      // Crear el acta
      await createActa({
        code: actaCode,
        pollingTableId: table.id!,
        electoralProcessId: processId,
        status: 'BORRADOR'
      });
      
      results.created++;
      results.details.push({
        mesa: table.number,
        code: actaCode,
        franjas: applicableFranjas.length,
        status: 'created'
      });
      
      console.log(`✅ Mesa ${table.number}: Acta creada con ${applicableFranjas.length} franjas (${applicableFranjas.map(f => f.position.name).join(', ')})`);
      
    } catch (error) {
      console.error(`❌ Error en mesa ${table.number}:`, error);
      results.errors++;
      results.details.push({
        mesa: table.number,
        code: `MESA-${table.number}`,
        franjas: 0,
        status: 'error',
        reason: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
  
  console.log(`
📊 RESUMEN DE GENERACIÓN:
✅ Creadas: ${results.created}
⏭️  Omitidas: ${results.skipped} (sin partidos asignados)
ℹ️  Ya existían: ${results.details.filter(d => d.status === 'exists').length}
❌ Errores: ${results.errors}
📋 Total procesadas: ${tables.length}
  `);
  
  return results;
}

/**
 * Determina qué franjas (cargos) aplican a una mesa específica
 */

// Reemplazar la función getApplicableFranjas en tu actaGenerationService.ts

/**
 * Determina qué franjas (cargos) aplican a una mesa específica
 * Usa la ubicación geográfica REAL de la mesa (desde precinct → locality → municipality → province → departament)
 */
function getApplicableFranjas(
  positions: ElectoralPosition[],
  participations: PartyParticipation[],
  table: PollingTable,
  departmentId?: string,
  provinceId?: string,
  municipalityId?: string
) {
  const franjas: {
    position: ElectoralPosition;
    parties: PartyParticipation[];
  }[] = [];
  
  // Obtener la ubicación geográfica REAL de la mesa desde su cadena de relaciones
  const tableDepartmentId = table.precinct?.locality?.municipality?.province?.departament?.id;
  const tableProvinceId = table.precinct?.locality?.municipality?.province?.id;
  const tableMunicipalityId = table.precinct?.locality?.municipality?.id;
  
  // Log para debug
  if (tableDepartmentId || tableProvinceId || tableMunicipalityId) {
    console.log(`📍 Mesa ${table.number}: Depto=${tableDepartmentId?.substring(0,8)}, Prov=${tableProvinceId?.substring(0,8)}, Mun=${tableMunicipalityId?.substring(0,8)}`);
  } else {
    console.warn(`⚠️ Mesa ${table.number}: Sin información geográfica`);
  }
  
  for (const position of positions) {
    // Filtrar partidos que participan en este cargo
    let partiesForPosition = participations.filter(p => 
      p.electoralPosition.id === position.id &&
      p.enabled
    );
    
    // Aplicar filtro geográfico según el alcance del cargo Y la ubicación REAL de la mesa
    if (position.scope === 'DEPARTAMENTAL') {
      // Para cargos departamentales, filtrar por el departamento de la mesa
      if (tableDepartmentId) {
        partiesForPosition = partiesForPosition.filter(p => 
          p.department?.id === tableDepartmentId
        );
      } else {
        // Si la mesa no tiene departamento, no incluir esta franja
        partiesForPosition = [];
      }
    } else if (position.scope === 'PROVINCIAL') {
      // Para cargos provinciales, filtrar por la provincia de la mesa
      if (tableProvinceId) {
        partiesForPosition = partiesForPosition.filter(p => 
          p.province?.id === tableProvinceId
        );
      } else {
        // Si la mesa no tiene provincia, no incluir esta franja
        partiesForPosition = [];
      }
    } else if (position.scope === 'MUNICIPAL') {
      // Para cargos municipales, filtrar por el municipio de la mesa
      if (tableMunicipalityId) {
        partiesForPosition = partiesForPosition.filter(p => 
          p.municipality?.id === tableMunicipalityId
        );
      } else {
        // Si la mesa no tiene municipio, no incluir esta franja
        partiesForPosition = [];
      }
    }
    
    // Si hay partidos para este cargo, agregar la franja
    if (partiesForPosition.length > 0) {
      franjas.push({
        position,
        parties: partiesForPosition.sort((a, b) => a.order - b.order)
      });
      console.log(`  ✓ Franja: ${position.name} (${partiesForPosition.length} partidos)`);
    }
  }
  
  // Ordenar franjas por orden del cargo
  return franjas.sort((a, b) => (a.position.order || 0) - (b.position.order || 0));
}

/**
 * Genera un código único para el acta
 */
function generateActaCode(table: PollingTable, processId: string): string {
  // Formato: PROCESO-MESA-CODIGO
  const processShort = processId.substring(0, 8);
  const tableNumber = String(table.number).padStart(4, '0');
  const actCode = table.actCode || 'XXXX';
  
  return `${processShort}-M${tableNumber}-${actCode}`;
}

/**
 * Obtiene la estructura completa de un acta (todas sus franjas y partidos)
 */
export async function getActaStructure(
  processId: string,
  tableId: string,
  departmentId?: string,
  provinceId?: string,
  municipalityId?: string
) {
  // 1. Obtener la mesa
  const tables = await getPollingTables();
  const table = tables.find(t => t.id === tableId);
  
  if (!table) {
    throw new Error('Mesa no encontrada');
  }
  
  // 2. Obtener cargos del proceso
  const allPositions = await getElectoralPositions();
  const processPositions = allPositions.filter(p => p.electoralProcess.id === processId);
  
  // 3. Obtener participaciones
  const allParticipations = await getPartyParticipations();
  
  // 4. Determinar franjas aplicables
  const franjas = getApplicableFranjas(
    processPositions,
    allParticipations,
    table,
    departmentId,
    provinceId,
    municipalityId
  );
  
  return {
    table,
    code: generateActaCode(table, processId),
    franjas
  };
}

/**
 * Regenera actas en estado BORRADOR
 * Elimina actas existentes en BORRADOR y las vuelve a crear con la configuración actual
 */
export async function regenerateActas(
  processId: string,
  departmentId?: string,
  provinceId?: string,
  municipalityId?: string
) {
  const Parse = (await import('$lib/parseClient')).default;
  
  console.log(`🔄 Iniciando regeneración de actas en BORRADOR...`);
  
  let deleted = 0;
  
  try {
    // 1. Buscar actas existentes en BORRADOR
    const ActaClass = Parse.Object.extend('Acta');
    const query = new Parse.Query(ActaClass);
    
    const ElectoralProcess = Parse.Object.extend('ElectoralProcess');
    const processPointer = ElectoralProcess.createWithoutData(processId);
    query.equalTo('electoralProcess', processPointer);
    query.equalTo('status', 'BORRADOR');
    
    const borradorActas = await query.find();
    
    console.log(`📋 Encontradas ${borradorActas.length} actas en BORRADOR`);
    
    // 2. Eliminar actas en BORRADOR
    for (const acta of borradorActas) {
      try {
        await acta.destroy();
        deleted++;
      } catch (error) {
        console.error(`Error eliminando acta ${acta.id}:`, error);
      }
    }
    
    console.log(`🗑️ Eliminadas ${deleted} actas en BORRADOR`);
  } catch (error: any) {
    // Si la clase Acta no existe, simplemente continuar con la generación
    if (error.message?.includes('non-existent class')) {
      console.log('ℹ️ No hay actas previas (clase Acta no existe)');
    } else {
      throw error;
    }
  }
  
  // 3. Generar nuevamente
  const result = await generateActasForProcess(
    processId,
    departmentId,
    provinceId,
    municipalityId
  );
  
  return {
    ...result,
    deleted,
    message: deleted > 0 
      ? `Se eliminaron ${deleted} actas en BORRADOR y se generaron ${result.created} nuevas actas`
      : `Se generaron ${result.created} nuevas actas`
  };
}

/**
 * Verifica si hay actas con votos (que no se pueden regenerar)
 */
export async function checkActasWithVotes(processId: string) {
  const Parse = (await import('$lib/parseClient')).default;
  
  try {
    const ActaClass = Parse.Object.extend('Acta');
    const query = new Parse.Query(ActaClass);
    
    const ElectoralProcess = Parse.Object.extend('ElectoralProcess');
    const processPointer = ElectoralProcess.createWithoutData(processId);
    query.equalTo('electoralProcess', processPointer);
    
    const allActas = await query.find();
    
    const byStatus: Record<string, number> = {
      BORRADOR: 0,
      CON_FOTO: 0,
      CERRADA: 0,
      VALIDADA: 0
    };
    
    allActas.forEach((acta:any) => {
      const status = acta.get('status') as string;
      if (status in byStatus) {
        byStatus[status]++;
      }
    });
    
    const canRegenerate = allActas.length === byStatus.BORRADOR;
    const withVotes = byStatus.CON_FOTO + byStatus.CERRADA + byStatus.VALIDADA;
    
    return {
      total: allActas.length,
      byStatus,
      canRegenerate,
      withVotes,
      safeToRegenerate: withVotes === 0
    };
  } catch (error: any) {
    // Si la clase Acta no existe, retornar estado vacío
    if (error.message?.includes('non-existent class')) {
      console.warn('⚠️ Clase Acta no existe aún');
      return {
        total: 0,
        byStatus: {
          BORRADOR: 0,
          CON_FOTO: 0,
          CERRADA: 0,
          VALIDADA: 0
        },
        canRegenerate: true,
        withVotes: 0,
        safeToRegenerate: true
      };
    }
    throw error;
  }
}
export async function previewActaGeneration(
  processId: string,
  departmentId?: string,
  provinceId?: string,
  municipalityId?: string
) {
  const allPositions = await getElectoralPositions();
  const processPositions = allPositions.filter(p => p.electoralProcess.id === processId);
  
  const allParticipations = await getPartyParticipations();
  const tables = await getPollingTables();
  
  // Calcular estadísticas detalladas
  let totalActas = 0;
  let mesasOmitidas = 0;
  const franjasCount: { [key: string]: number } = {};
  const mesasPorCargo: { [key: string]: number } = {};
  const warnings: string[] = [];
  
  for (const table of tables) {
    const franjas = getApplicableFranjas(
      processPositions,
      allParticipations,
      table,
      departmentId,
      provinceId,
      municipalityId
    );
    
    if (franjas.length > 0) {
      totalActas++;
      franjas.forEach(f => {
        const key = f.position.name;
        franjasCount[key] = (franjasCount[key] || 0) + 1;
        mesasPorCargo[key] = (mesasPorCargo[key] || 0) + 1;
      });
    } else {
      mesasOmitidas++;
    }
  }
  
  // Detectar cargos sin asignaciones
  processPositions.forEach(position => {
    const partiesForPosition = allParticipations.filter(p => 
      p.electoralPosition.id === position.id &&
      p.enabled
    );
    
    if (partiesForPosition.length === 0) {
      warnings.push(`⚠️ ${position.name}: NO tiene partidos asignados (0 partidos)`);
    } else {
      const mesasConEstaFranja = mesasPorCargo[position.name] || 0;
      if (mesasConEstaFranja === 0) {
        warnings.push(`⚠️ ${position.name}: Tiene ${partiesForPosition.length} partidos, pero no aplica a ninguna mesa del alcance seleccionado`);
      }
    }
  });
  
  return {
    totalMesas: tables.length,
    totalActas,
    mesasOmitidas,
    porcentajeCobertura: tables.length > 0 ? ((totalActas / tables.length) * 100).toFixed(1) : '0',
    franjasSummary: Object.entries(franjasCount).map(([name, count]) => ({
      cargo: name,
      actas: count,
      partidos: allParticipations.filter(p => 
        p.electoralPosition.name === name && 
        p.enabled
      ).length
    })),
    warnings,
    alcance: {
      departamento: departmentId ? 'Seleccionado' : 'Nacional',
      provincia: provinceId ? 'Seleccionada' : 'Todas',
      municipio: municipalityId ? 'Seleccionado' : 'Todos'
    }
  };
}