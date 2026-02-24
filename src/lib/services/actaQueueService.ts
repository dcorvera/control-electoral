// $lib/services/actaQueueService.ts

/**
 * Sistema de Cola de Actas para Transcripción
 * 
 * Funcionalidades:
 * - Asignación equitativa de actas entre transcriptores
 * - Distribución aleatoria para evitar sesgos
 * - Admin ve todas las actas
 * - Transcriptores solo ven sus actas asignadas
 */

export async function getNextActaForTranscription(userId: string, isAdmin: boolean = false) {
  const Parse = (await import('$lib/parseClient')).default;
  const ActaClass = Parse.Object.extend('Acta');
  
  if (isAdmin) {
    // Admin: obtener cualquier acta CON_FOTO no asignada
    const query = new Parse.Query(ActaClass);
    query.equalTo('status', 'CON_FOTO');
    query.doesNotExist('assignedTo');
    query.include([
      'pollingTable',
      'pollingTable.precinct',
      'pollingTable.precinct.locality',
      'pollingTable.precinct.locality.municipality',
      'pollingTable.precinct.locality.municipality.province',
      'electoralProcess'
    ]);
    query.ascending('createdAt'); // Más antiguas primero
    query.limit(1);
    
    const result = await query.first();
    return result ? parseActa(result) : null;
  } else {
    // Transcriptor: primero buscar si ya tiene una asignada
    const assignedQuery = new Parse.Query(ActaClass);
    const User = Parse.Object.extend('_User');
    const userPointer = User.createWithoutData(userId);
    
    assignedQuery.equalTo('status', 'CON_FOTO');
    assignedQuery.equalTo('assignedTo', userPointer);
    assignedQuery.include([
      'pollingTable',
      'pollingTable.precinct',
      'pollingTable.precinct.locality',
      'pollingTable.precinct.locality.municipality',
      'pollingTable.precinct.locality.municipality.province',
      'electoralProcess'
    ]);
    assignedQuery.limit(1);
    
    let result = await assignedQuery.first();
    
    // Si ya tiene una, devolverla
    if (result) {
      return parseActa(result);
    }
    
    // Si no tiene, asignar una nueva de manera equitativa
    const newActa = await assignNextActaToUser(userId);
    return newActa;
  }
}

async function assignNextActaToUser(userId: string) {
  const Parse = (await import('$lib/parseClient')).default;
  const ActaClass = Parse.Object.extend('Acta');
  
  // Obtener todas las actas disponibles (CON_FOTO y sin asignar)
  const availableQuery = new Parse.Query(ActaClass);
  availableQuery.equalTo('status', 'CON_FOTO');
  availableQuery.doesNotExist('assignedTo');
  availableQuery.include([
    'pollingTable',
    'pollingTable.precinct',
    'pollingTable.precinct.locality',
    'pollingTable.precinct.locality.municipality',
    'pollingTable.precinct.locality.municipality.province',
    'electoralProcess'
  ]);
  availableQuery.limit(100); // Obtener las primeras 100 disponibles
  
  const availableActas = await availableQuery.find();
  
  if (availableActas.length === 0) {
    return null; // No hay actas disponibles
  }
  
  // Seleccionar una aleatoria de las disponibles
  const randomIndex = Math.floor(Math.random() * availableActas.length);
  const selectedActa = availableActas[randomIndex];
  
  // Asignar al usuario
  const User = Parse.Object.extend('_User');
  const userPointer = User.createWithoutData(userId);
  
  selectedActa.set('assignedTo', userPointer);
  selectedActa.set('assignedAt', new Date());
  await selectedActa.save();
  
  return parseActa(selectedActa);
}

export async function getMyAssignedActas(userId: string) {
  const Parse = (await import('$lib/parseClient')).default;
  const ActaClass = Parse.Object.extend('Acta');
  
  const User = Parse.Object.extend('_User');
  const userPointer = User.createWithoutData(userId);
  
  const query = new Parse.Query(ActaClass);
  query.equalTo('assignedTo', userPointer);
  query.equalTo('status', 'CON_FOTO');
  query.include([
    'pollingTable',
    'pollingTable.precinct',
    'pollingTable.precinct.locality',
    'pollingTable.precinct.locality.municipality',
    'pollingTable.precinct.locality.municipality.province',
    'electoralProcess'
  ]);
  query.descending('assignedAt');
  query.limit(10);
  
  const results = await query.find();
  return results.map(parseActa);
}

export async function getAllPendingActas() {
  const Parse = (await import('$lib/parseClient')).default;
  const ActaClass = Parse.Object.extend('Acta');
  
  const query = new Parse.Query(ActaClass);
  query.equalTo('status', 'CON_FOTO');
  query.include([
    'pollingTable',
    'pollingTable.precinct',
    'pollingTable.precinct.locality',
    'pollingTable.precinct.locality.municipality',
    'pollingTable.precinct.locality.municipality.province',
    'electoralProcess',
    'assignedTo'
  ]);
  query.descending('createdAt');
  query.limit(1000);
  
  const results = await query.find();
  return results.map((item: any) => {
    const acta = parseActa(item);
    return {
      ...acta,
      assignedTo: item.get('assignedTo') ? {
        id: item.get('assignedTo').id,
        username: item.get('assignedTo').get('username')
      } : null,
      assignedAt: item.get('assignedAt')
    };
  });
}

export async function releaseActa(actaId: string) {
  const Parse = (await import('$lib/parseClient')).default;
  const ActaClass = Parse.Object.extend('Acta');
  
  const query = new Parse.Query(ActaClass);
  const acta = await query.get(actaId);
  
  acta.unset('assignedTo');
  acta.unset('assignedAt');
  await acta.save();
}

export async function getQueueStatistics() {
  const Parse = (await import('$lib/parseClient')).default;
  const ActaClass = Parse.Object.extend('Acta');
  
  // Total pendientes
  const totalQuery = new Parse.Query(ActaClass);
  totalQuery.equalTo('status', 'CON_FOTO');
  const total = await totalQuery.count();
  
  // Asignadas
  const assignedQuery = new Parse.Query(ActaClass);
  assignedQuery.equalTo('status', 'CON_FOTO');
  assignedQuery.exists('assignedTo');
  const assigned = await assignedQuery.count();
  
  // Disponibles
  const available = total - assigned;
  
  // Por usuario (solo si es admin)
  const byUserQuery = new Parse.Query(ActaClass);
  byUserQuery.equalTo('status', 'CON_FOTO');
  byUserQuery.exists('assignedTo');
  byUserQuery.include('assignedTo');
  byUserQuery.limit(1000);
  
  const assignedActas = await byUserQuery.find();
  
  const byUser: Record<string, number> = {};
  assignedActas.forEach((acta: any) => {
    const user = acta.get('assignedTo');
    if (user) {
      const username = user.get('username');
      byUser[username] = (byUser[username] || 0) + 1;
    }
  });
  
  return {
    total,
    assigned,
    available,
    byUser
  };
}

function parseActa(item: any) {
  const pollingTableObj = item.get('pollingTable');
  const precinctObj = pollingTableObj?.get('precinct');
  const localityObj = precinctObj?.get('locality');
  const municipalityObj = localityObj?.get('municipality');
  const provinceObj = municipalityObj?.get('province');
  
  return {
    id: item.id,
    code: item.get('code'),
    status: item.get('status'),
    imageUrl: item.get('imageUrl'),
    pollingTable: {
      id: pollingTableObj?.id,
      number: pollingTableObj?.get('number'),
      inscribedCount: pollingTableObj?.get('inscribedCount'),
      actCode: pollingTableObj?.get('actCode'),
      precinct: precinctObj ? {
        id: precinctObj.id,
        code: precinctObj.get('code'),
        name: precinctObj.get('name'),
        locality: localityObj ? {
          id: localityObj.id,
          municipality: municipalityObj ? {
            id: municipalityObj.id,
            province: provinceObj ? {
              id: provinceObj.id,
              name: provinceObj.get('name')
            } : undefined
          } : undefined
        } : undefined
      } : undefined
    },
    electoralProcess: {
      id: item.get('electoralProcess')?.id,
      name: item.get('electoralProcess')?.get('name'),
      year: item.get('electoralProcess')?.get('year')
    }
  };
}