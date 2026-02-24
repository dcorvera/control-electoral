import type { ElectoralPosition } from '$lib/types/types';

// ================================
// GET ALL
// ================================
export async function getElectoralPositions(): Promise<ElectoralPosition[]> {
    const Parse = (await import('$lib/parseClient')).default;
    const ElectoralPosition = Parse.Object.extend('ElectoralPosition');
    const query = new Parse.Query(ElectoralPosition);

    query.include('electoralProcess');
    query.ascending('order');

    const results = await query.find();

    return results.map((item: any) => ({
        id: item.id,
        name: item.get('name'),
        scope: item.get('scope'),
        order: item.get('order'),
        electoralProcess: {
            id: item.get('electoralProcess')?.id,
            name: item.get('electoralProcess')?.get('name')
        }
    }));
}

// ================================
// CREATE
// ================================
export async function createElectoralPosition(data: {
    name: string;
    scope: 'DEPARTMENTAL' | 'PROVINCIAL' | 'MUNICIPAL';
    order: number;
    electoralProcessId: string;
}) {
    console.log(data);
    const Parse = (await import('$lib/parseClient')).default;
    const ElectoralPosition = Parse.Object.extend('ElectoralPosition');
    const obj = new ElectoralPosition();

    const processPointer = new Parse.Object('ElectoralProcess');
    processPointer.id = data.electoralProcessId;

    obj.set('name', data.name);
    obj.set('scope', data.scope);
    obj.set('order', data.order);
    obj.set('electoralProcess', processPointer);

    await obj.save();
}

// ================================
// UPDATE
// ================================
export async function updateElectoralPosition(id: string, data: {
    name: string;
    scope: 'DEPARTMENTAL' | 'PROVINCIAL' | 'MUNICIPAL';
    order: number;
    electoralProcessId: string;
}) {
    const Parse = (await import('$lib/parseClient')).default;
    const ElectoralPosition = Parse.Object.extend('ElectoralPosition');
    const obj = await new Parse.Query(ElectoralPosition).get(id);

    const processPointer = new Parse.Object('ElectoralProcess');
    processPointer.id = data.electoralProcessId;

    obj.set('name', data.name);
    obj.set('scope', data.scope);
    obj.set('order', data.order);
    obj.set('electoralProcess', processPointer);

    await obj.save();
}

// ================================
// DELETE
// ================================
export async function deleteElectoralPosition(id: string) {
    const Parse = (await import('$lib/parseClient')).default;
    const ElectoralPosition = Parse.Object.extend('ElectoralPosition');
    const query = new Parse.Query(ElectoralPosition);

    const obj = await query.get(id);
    await obj.destroy();
}
