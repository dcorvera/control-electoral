// $lib/services/politicalOrganization.ts

import type { PoliticalOrganization } from '$lib/types/types';


export async function getPoliticalOrganization(): Promise<PoliticalOrganization[]> {
    if (typeof window === 'undefined') return []; // no correr en SSR

    const Parse = (await import('$lib/parseClient')).default;
    const PoliticalOrganization = Parse.Object.extend("PoliticalOrganization");
    const query = new Parse.Query(PoliticalOrganization);
    query.include("electoralProcess");
    query.limit(1000);
    try {
        const results = await query.find();
        return results.map((obj: any): PoliticalOrganization => {
            const electoralProcessObj = obj.get("electoralProcess");
            return {
                id: obj.id,
                sigla: obj.get("sigla"),
                name: obj.get("name"),
                color: obj.get("color"),
                electoralProcess: {id:electoralProcessObj.id,name: electoralProcessObj.get("name"),year:electoralProcessObj.get("year"),type:electoralProcessObj.get("type"),state:electoralProcessObj.get("state")}}
    });
    } catch (error) {
        console.error("Error fetching politicalOrganization:", error);
        return [];
    }
}

export async function createPoliticalOrganization(data: { sigla: string; name: string;color:string,electoralProcessId:string }) {
    if (typeof window === 'undefined') throw new Error("Cannot create in SSR");

    const Parse = (await import('$lib/parseClient')).default;
    const PoliticalOrganization = Parse.Object.extend("PoliticalOrganization");

    const obj = new PoliticalOrganization();
    obj.set("sigla", data.sigla);
    obj.set("name", data.name);
    obj.set("color", data.color);
    const ElectoralProcess = Parse.Object.extend("ElectoralProcess");
    const electoralProcess = new ElectoralProcess();
    electoralProcess.id = data.electoralProcessId;
    obj.set("electoralProcess", electoralProcess);
    await obj.save();
    return {
        id: obj.id,
        sigla: obj.get("sigla"),
        name: obj.get("name"),
        color:obj.get("color")
    };
}

export async function updatePoliticalOrganization(id: string, data: { sigla: string; name: string;color:string,electoralProcessId:string }) {
    if (typeof window === 'undefined') throw new Error("Cannot update in SSR");

    const Parse = (await import('$lib/parseClient')).default;
    const PoliticalOrganization = Parse.Object.extend("PoliticalOrganization");
    const query = new Parse.Query(PoliticalOrganization);
    const obj = await query.get(id);
    obj.set("sigla", data.sigla);
    obj.set("name", data.name);
    obj.set("color", data.color);
    const ElectoralProcess = Parse.Object.extend("ElectoralProcess");
    const electoralProcess = new ElectoralProcess();
    electoralProcess.id = data.electoralProcessId;
    obj.set("electoralProcess", electoralProcess);
    return {
        id: obj.id,
        sigla: obj.get("sigla"),
        name: obj.get("name"),
        color:obj.get("color")
    };
}

export async function deletePoliticalOrganization(id: string) {
    if (typeof window === 'undefined') throw new Error("Cannot delete in SSR");

    const Parse = (await import('$lib/parseClient')).default;
    const PoliticalOrganization = Parse.Object.extend("PoliticalOrganization");
    const query = new Parse.Query(PoliticalOrganization);
    const obj = await query.get(id);
    await obj.destroy();
}
