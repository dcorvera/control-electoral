export type ElectoralProcess = { id?: string; name: string; year: number;  type: 'Nacional' | 'Departamental' | 'Municipal'; state: string };
export type Country = {id?:string;code:number;name:string};
export type GeoPointData = {
  latitude: number;
  longitude: number;
};
export type PolygonData = [number, number][];
export type Departament = {
  id?: string;
  code: number;
  name:string;
  country?:Country;
  location?: GeoPointData;
  area?: PolygonData;
};
export type Province = {
  id?: string;
  code: number;
  name:string;
  departament?: Departament;
  location?: GeoPointData;
  area?: PolygonData;
};
export type Municipality ={
  id?: string;
  code: number;
  name:string;
  province: Province;
  location?: GeoPointData;
  area?: PolygonData;
}
export type Locality = {
  id?: string;
  code: number;
  name:string;
  municipality: Municipality;
  location?: GeoPointData;
};
export type Precinct = {
  id?: string;
  code: number;
  name:string;
  locality: Locality;
  location?: GeoPointData; 
}
export type PolygonObject = {
  coordinates: [number, number][];
};

// En $lib/types/types.ts - actualizar:

export type PollingTable = {
  id?: string;
  number: number;
  inscribedCount?: number; // Cantidad de inscritos
  actCode?: number; // Código del acta
  precinct?: Precinct;
};

export type PoliticalOrganization = {
  id?: string;
  sigla: string;
  name:string;
  color:string;
  electoralProcess: ElectoralProcess;
}