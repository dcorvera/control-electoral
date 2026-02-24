import type { Acta, ActaDetail } from '$lib/types/types';

// ================================
// GET ACTAS
// ================================
export async function getActasByProcess(processId: string): Promise<Acta[]> {
    const Parse = (await import('$lib/parseClient')).default;
    const ActaClass = Parse.Object.extend('Acta');
    const query = new Parse.Query(ActaClass);

    // Crear pointer al proceso electoral
    const ElectoralProcess = Parse.Object.extend('ElectoralProcess');
    const processPointer = ElectoralProcess.createWithoutData(processId);
    query.equalTo('electoralProcess', processPointer);

    // CRÍTICO: Incluir TODA la cadena geográfica
    query.include([
        'pollingTable',
        'pollingTable.precinct',
        'pollingTable.precinct.locality',
        'pollingTable.precinct.locality.municipality',
        'pollingTable.precinct.locality.municipality.province',
        'pollingTable.precinct.locality.municipality.province.departament',
        'electoralProcess'
    ]);
    query.descending('createdAt');
    query.limit(10000);

    const results = await query.find();

    return results.map((item: any) => {
        const pollingTableObj = item.get('pollingTable');
        const precinctObj = pollingTableObj?.get('precinct');
        const localityObj = precinctObj?.get('locality');
        const municipalityObj = localityObj?.get('municipality');
        const provinceObj = municipalityObj?.get('province');
        const departamentObj = provinceObj?.get('departament');

        return {
            id: item.id,
            code: item.get('code'),
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
                        code: localityObj.get('code'),
                        name: localityObj.get('name'),
                        municipality: municipalityObj ? {
                            id: municipalityObj.id,
                            code: municipalityObj.get('code'),
                            name: municipalityObj.get('name'),
                            province: provinceObj ? {
                                id: provinceObj.id,
                                code: provinceObj.get('code'),
                                name: provinceObj.get('name'),
                                departament: departamentObj ? {
                                    id: departamentObj.id,
                                    code: departamentObj.get('code'),
                                    name: departamentObj.get('name')
                                } : undefined
                            } : undefined
                        } : undefined
                    } : undefined
                } : undefined
            },
            electoralProcess: {
                id: item.get('electoralProcess')?.id,
                name: item.get('electoralProcess')?.get('name'),
                year: item.get('electoralProcess')?.get('year'),
                type: item.get('electoralProcess')?.get('type'),
                state: item.get('electoralProcess')?.get('state')
            },
            status: item.get('status')
        };
    });
}

export async function getAllActas(): Promise<Acta[]> {
    const Parse = (await import('$lib/parseClient')).default;
    const ActaClass = Parse.Object.extend('Acta');
    const query = new Parse.Query(ActaClass);

    query.include(['pollingTable', 'pollingTable.precinct', 'electoralProcess']);
    query.descending('createdAt');
    query.limit(1000);

    const results = await query.find();

    return results.map((item: any) => ({
        id: item.id,
        code: item.get('code'),
        pollingTable: {
            id: item.get('pollingTable')?.id,
            number: item.get('pollingTable')?.get('number'),
            inscribedCount: item.get('pollingTable')?.get('inscribedCount'),
            precinct: item.get('pollingTable')?.get('precinct')
        },
        electoralProcess: {
            id: item.get('electoralProcess')?.id,
            name: item.get('electoralProcess')?.get('name'),
            year: item.get('electoralProcess')?.get('year'),
            type: item.get('electoralProcess')?.get('type'),
            state: item.get('electoralProcess')?.get('state')
        },
        status: item.get('status')
    }));
}

// ================================
// GET ACTA BY ID
// ================================
export async function getActaById(id: string): Promise<Acta> {
    const Parse = (await import('$lib/parseClient')).default;
    const ActaClass = Parse.Object.extend('Acta');
    const query = new Parse.Query(ActaClass);

    query.include([
        'pollingTable',
        'pollingTable.precinct',
        'electoralProcess',
        'electoralPosition'
    ]);

    const item = await query.get(id);

    return {
        id: item.id,
        code: item.get('code'),
        pollingTable: {
            id: item.get('pollingTable')?.id,
            number: item.get('pollingTable')?.get('number'),
            inscribedCount: item.get('pollingTable')?.get('inscribedCount'),
            actCode: item.get('pollingTable')?.get('actCode'),
            precinct: item.get('pollingTable')?.get('precinct')
        },
        electoralProcess: {
            id: item.get('electoralProcess')?.id,
            name: item.get('electoralProcess')?.get('name'),
            year: item.get('electoralProcess')?.get('year'),
            type: item.get('electoralProcess')?.get('type'),
            state: item.get('electoralProcess')?.get('state')
        },
        electoralPosition: item.get('electoralPosition') ? {
            id: item.get('electoralPosition').id,
            name: item.get('electoralPosition').get('name'),
            scope: item.get('electoralPosition').get('scope'),
            order: item.get('electoralPosition').get('order'),
            electoralProcess: {
                id: item.get('electoralProcess')?.id,
                name: item.get('electoralProcess')?.get('name'),
                year: item.get('electoralProcess')?.get('year'),
                type: item.get('electoralProcess')?.get('type'),
                state: item.get('electoralProcess')?.get('state')
            }
        } : undefined,
        status: item.get('status'),
        imageUrl: item.get('imageUrl'),
        observations: item.get('observations')
    };
}

// ================================
// CREATE ACTA
// ================================
export async function createActa(data: {
    code: string;
    pollingTableId: string;
    electoralProcessId: string;
    status: 'BORRADOR' | 'CERRADA' | 'VALIDADA';
}) {
    const Parse = (await import('$lib/parseClient')).default;
    const ActaClass = Parse.Object.extend('Acta');
    const obj = new ActaClass();

    obj.set('code', data.code);

    // Polling Table pointer
    const PollingTable = Parse.Object.extend('PollingTable');
    const tablePointer = PollingTable.createWithoutData(data.pollingTableId);
    obj.set('pollingTable', tablePointer);

    // Electoral Process pointer
    const ElectoralProcess = Parse.Object.extend('ElectoralProcess');
    const processPointer = ElectoralProcess.createWithoutData(data.electoralProcessId);
    obj.set('electoralProcess', processPointer);

    obj.set('status', data.status);

    await obj.save();

    return {
        id: obj.id,
        code: obj.get('code'),
        status: obj.get('status')
    };
}

// ================================
// UPDATE ACTA
// ================================
// Actualización para actaService.ts - Función updateActa mejorada

export async function updateActa(
  id: string,
  data: {
    code?: string;
    pollingTableId?: string;
    electoralProcessId?: string;
    status?: 'BORRADOR' | 'CON_FOTO' | 'CERRADA' | 'VALIDADA';
    imageUrl?: string;
    observations?: string;
    transcribedById?: string;  // ID del usuario que transcribió
    validatedById?: string;    // ID del usuario que validó
  }
) {
  if (typeof window === 'undefined') throw new Error("Cannot update in SSR");

  const Parse = (await import('$lib/parseClient')).default;
  const ActaClass = Parse.Object.extend('Acta');

  const query = new Parse.Query(ActaClass);
  const obj = await query.get(id);

  if (data.code !== undefined) obj.set('code', data.code);
  if (data.status !== undefined) obj.set('status', data.status);
  if (data.imageUrl !== undefined) obj.set('imageUrl', data.imageUrl);
  if (data.observations !== undefined) obj.set('observations', data.observations);

  if (data.pollingTableId) {
    const PollingTable = Parse.Object.extend('PollingTable');
    const table = new PollingTable();
    table.id = data.pollingTableId;
    obj.set('pollingTable', table);
  }

  if (data.electoralProcessId) {
    const ElectoralProcess = Parse.Object.extend('ElectoralProcess');
    const process = new ElectoralProcess();
    process.id = data.electoralProcessId;
    obj.set('electoralProcess', process);
  }

  // Agregar soporte para transcribedBy y validatedBy
  if (data.transcribedById) {
    const User = Parse.Object.extend('_User');
    const user = new User();
    user.id = data.transcribedById;
    obj.set('transcribedBy', user);
  }

  if (data.validatedById) {
    const User = Parse.Object.extend('_User');
    const user = new User();
    user.id = data.validatedById;
    obj.set('validatedBy', user);
  }

  await obj.save();

  return {
    id: obj.id,
    code: obj.get('code'),
    status: obj.get('status')
  };
}

// ================================
// DELETE ACTA
// ================================
export async function deleteActa(id: string) {
    const Parse = (await import('$lib/parseClient')).default;
    const ActaClass = Parse.Object.extend('Acta');
    const query = new Parse.Query(ActaClass);

    const obj = await query.get(id);
    await obj.destroy();
}

// ================================
// ACTA DETAILS (Votos por partido)
// ================================
export async function getActaDetails(actaId: string): Promise<ActaDetail[]> {
    const Parse = (await import('$lib/parseClient')).default;
    const ActaDetailClass = Parse.Object.extend('ActaDetail');
    const query = new Parse.Query(ActaDetailClass);

    // Crear pointer al acta
    const Acta = Parse.Object.extend('Acta');
    const actaPointer = Acta.createWithoutData(actaId);
    query.equalTo('acta', actaPointer);

    query.include([
        'acta',
        'electoralPosition',
        'politicalOrganization'
    ]);

    const results = await query.find();

    return results.map((item: any) => ({
        id: item.id,
        acta: {
            id: item.get('acta')?.id,
            code: item.get('acta')?.get('code')
        },
        electoralPosition: {
            id: item.get('electoralPosition')?.id,
            name: item.get('electoralPosition')?.get('name'),
            scope: item.get('electoralPosition')?.get('scope'),
            order: item.get('electoralPosition')?.get('order')
        },
        politicalOrganization: {
            id: item.get('politicalOrganization')?.id,
            sigla: item.get('politicalOrganization')?.get('sigla'),
            name: item.get('politicalOrganization')?.get('name'),
            color: item.get('politicalOrganization')?.get('color')
        },
        votes: item.get('votes')
    }));
}


export async function updateActaDetail(
    id: string,
    votes: number
) {
    const Parse = (await import('$lib/parseClient')).default;
    const ActaDetailClass = Parse.Object.extend('ActaDetail');
    const query = new Parse.Query(ActaDetailClass);

    const obj = await query.get(id);
    obj.set('votes', votes);

    await obj.save();

    return {
        id: obj.id,
        votes: obj.get('votes')
    };
}

// Agregar estas funciones a tu actaService.ts

// ================================
// ACTA DETAIL (Votos)
// ================================

export async function createActaDetail(data: {
    actaId: string;
    electoralPositionId: string;
    politicalOrganizationId: string;
    votes: number;
}) {
    if (typeof window === 'undefined') throw new Error("Cannot create in SSR");

    const Parse = (await import('$lib/parseClient')).default;
    const ActaDetailClass = Parse.Object.extend('ActaDetail');

    const obj = new ActaDetailClass();

    // Crear pointers
    const Acta = Parse.Object.extend('Acta');
    const acta = new Acta();
    acta.id = data.actaId;
    obj.set('acta', acta);

    const ElectoralPosition = Parse.Object.extend('ElectoralPosition');
    const position = new ElectoralPosition();
    position.id = data.electoralPositionId;
    obj.set('electoralPosition', position);

    const PoliticalOrganization = Parse.Object.extend('PoliticalOrganization');
    const org = new PoliticalOrganization();
    org.id = data.politicalOrganizationId;
    obj.set('politicalOrganization', org);

    obj.set('votes', data.votes);

    await obj.save();

    return {
        id: obj.id,
        votes: obj.get('votes')
    };
}

export async function getActaDetailsByActa(actaId: string): Promise<ActaDetail[]> {
    const Parse = (await import('$lib/parseClient')).default;
    const ActaDetailClass = Parse.Object.extend('ActaDetail');
    const query = new Parse.Query(ActaDetailClass);

    const Acta = Parse.Object.extend('Acta');
    const actaPointer = Acta.createWithoutData(actaId);
    query.equalTo('acta', actaPointer);

    query.include(['electoralPosition', 'politicalOrganization']);

    try {
        const results = await query.find();

        return results.map((item: any) => ({
            id: item.id,
            electoralPosition: item.get('electoralPosition') ? {
                id: item.get('electoralPosition').id,
                name: item.get('electoralPosition').get('name'),
                scope: item.get('electoralPosition').get('scope'),
                order: item.get('electoralPosition').get('order')
            } : undefined,
            politicalOrganization: item.get('politicalOrganization') ? {
                id: item.get('politicalOrganization').id,
                sigla: item.get('politicalOrganization').get('sigla'),
                name: item.get('politicalOrganization').get('name'),
                color: item.get('politicalOrganization').get('color')
            } : undefined,
            votes: item.get('votes')
        }));
    } catch (error: any) {
        if (error.message?.includes('non-existent class')) {
            return [];
        }
        throw error;
    }
}

export async function deleteActaDetailsByActa(actaId: string) {
    if (typeof window === 'undefined') throw new Error("Cannot delete in SSR");

    const Parse = (await import('$lib/parseClient')).default;
    const ActaDetailClass = Parse.Object.extend('ActaDetail');
    const query = new Parse.Query(ActaDetailClass);

    const Acta = Parse.Object.extend('Acta');
    const actaPointer = Acta.createWithoutData(actaId);
    query.equalTo('acta', actaPointer);

    try {
        const results = await query.find();
        
        for (const detail of results) {
            await detail.destroy();
        }
        
        return results.length;
    } catch (error: any) {
        if (error.message?.includes('non-existent class')) {
            return 0;
        }
        throw error;
    }
}