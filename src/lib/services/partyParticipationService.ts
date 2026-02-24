import type { PartyParticipation } from '$lib/types/types';

// ================================
// GET ALL
// ================================
export async function getPartyParticipations(): Promise<PartyParticipation[]> {
    const Parse = (await import('$lib/parseClient')).default;
    const PartyParticipation = Parse.Object.extend('PartyParticipation');
    const query = new Parse.Query(PartyParticipation);

    query.include([
        'politicalOrganization',
        'electoralPosition',
        'electoralProcess',
        'department',
        'province',
        'municipality'
    ]);

    query.ascending('order');

    const results = await query.find();

    return results.map((item: any) => ({
        id: item.id,

        politicalOrganization: {
            id: item.get('politicalOrganization')?.id,
            name: item.get('politicalOrganization')?.get('name'),
            sigla: item.get('politicalOrganization')?.get('sigla'),
            color: item.get('politicalOrganization')?.get('color')
        },

        electoralPosition: {
            id: item.get('electoralPosition')?.id,
            name: item.get('electoralPosition')?.get('name'),
            scope: item.get('electoralPosition')?.get('scope'),
            order: item.get('electoralPosition')?.get('order')
        },

        electoralProcess: {
            id: item.get('electoralProcess')?.id,
            name: item.get('electoralProcess')?.get('name'),
            year: item.get('electoralProcess')?.get('year'),
            type: item.get('electoralProcess')?.get('type'),
            state: item.get('electoralProcess')?.get('state')
        },

        department: item.get('department')
            ? {
                id: item.get('department').id,
                name: item.get('department').get('name'),
                code: item.get('department').get('code')
            }
            : undefined,

        province: item.get('province')
            ? {
                id: item.get('province').id,
                name: item.get('province').get('name'),
                code: item.get('province').get('code')
            }
            : undefined,

        municipality: item.get('municipality')
            ? {
                id: item.get('municipality').id,
                name: item.get('municipality').get('name'),
                code: item.get('municipality').get('code')
            }
            : undefined,

        order: item.get('order'),
        enabled: item.get('enabled')
    }));
}

export async function createPartyParticipation(data: {
    politicalOrganizationId: string;
    electoralPositionId: string;
    electoralProcessId: string;

    departmentId?: string;
    provinceId?: string;
    municipalityId?: string;

    order: number;
    enabled: boolean;
}) {
    const Parse = (await import('$lib/parseClient')).default;
    const PartyParticipation = Parse.Object.extend('PartyParticipation');
    const obj = new PartyParticipation();

    // CORRECCIÓN: Usar "PoliticalOrganization" con mayúscula
    const politicalOrganizationPointer = new Parse.Object('PoliticalOrganization');
    politicalOrganizationPointer.id = data.politicalOrganizationId;
    obj.set('politicalOrganization', politicalOrganizationPointer);

    // ElectoralPosition ya está correcto
    const electoralPositionPointer = new Parse.Object('ElectoralPosition');
    electoralPositionPointer.id = data.electoralPositionId;
    obj.set('electoralPosition', electoralPositionPointer);

    // ElectoralProcess ya está correcto
    const electoralProcessPointer = new Parse.Object('ElectoralProcess');
    electoralProcessPointer.id = data.electoralProcessId;
    obj.set('electoralProcess', electoralProcessPointer);

    // CORRECCIÓN: Usar "Departament" (sin 't' al final)
    if (data.departmentId) {
        const departmentPointer = new Parse.Object('Departament');
        departmentPointer.id = data.departmentId;
        obj.set('department', departmentPointer);
    }

    // Province ya está correcto
    if (data.provinceId) {
        const provincePointer = new Parse.Object('Province');
        provincePointer.id = data.provinceId;
        obj.set('province', provincePointer);
    }

    // Municipality ya está correcto
    if (data.municipalityId) {
        const municipalityPointer = new Parse.Object('Municipality');
        municipalityPointer.id = data.municipalityId;
        obj.set('municipality', municipalityPointer);
    }

    obj.set('order', data.order);
    obj.set('enabled', data.enabled);

    await obj.save();
}

export async function updatePartyParticipation(
    id: string,
    data: {
        politicalOrganizationId: string;
        electoralPositionId: string;
        electoralProcessId: string;

        departmentId?: string;
        provinceId?: string;
        municipalityId?: string;

        order: number;
        enabled: boolean;
    }
) {
    const Parse = (await import('$lib/parseClient')).default;
    const PartyParticipation = Parse.Object.extend('PartyParticipation');
    const query = new Parse.Query(PartyParticipation);

    const obj = await query.get(id);

    // CORRECCIÓN: Usar "PoliticalOrganization" con mayúscula
    const politicalOrganizationPointer = new Parse.Object('PoliticalOrganization');
    politicalOrganizationPointer.id = data.politicalOrganizationId;
    obj.set('politicalOrganization', politicalOrganizationPointer);

    const electoralPositionPointer = new Parse.Object('ElectoralPosition');
    electoralPositionPointer.id = data.electoralPositionId;
    obj.set('electoralPosition', electoralPositionPointer);

    const electoralProcessPointer = new Parse.Object('ElectoralProcess');
    electoralProcessPointer.id = data.electoralProcessId;
    obj.set('electoralProcess', electoralProcessPointer);

    // Limpiar territorio previo
    obj.unset('department');
    obj.unset('province');
    obj.unset('municipality');

    // CORRECCIÓN: Usar "Departament" (sin 't' al final)
    if (data.departmentId) {
        const departmentPointer = new Parse.Object('Departament');
        departmentPointer.id = data.departmentId;
        obj.set('department', departmentPointer);
    }

    if (data.provinceId) {
        const provincePointer = new Parse.Object('Province');
        provincePointer.id = data.provinceId;
        obj.set('province', provincePointer);
    }

    if (data.municipalityId) {
        const municipalityPointer = new Parse.Object('Municipality');
        municipalityPointer.id = data.municipalityId;
        obj.set('municipality', municipalityPointer);
    }

    obj.set('order', data.order);
    obj.set('enabled', data.enabled);

    await obj.save();
}

export async function deletePartyParticipation(id: string) {
    const Parse = (await import('$lib/parseClient')).default;
    const PartyParticipation = Parse.Object.extend('PartyParticipation');
    const query = new Parse.Query(PartyParticipation);

    const obj = await query.get(id);
    await obj.destroy();
}