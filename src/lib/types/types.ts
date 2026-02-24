export type ElectoralProcess = { id?: string; name: string; year: number; type: 'Nacional' | 'Departamental' | 'Municipal'; state: string };
export type Country = { id?: string; code: number; name: string };
export type GeoPointData = {
  latitude: number;
  longitude: number;
};
export type PolygonData = [number, number][];
export type Departament = {
  id?: string;
  code: number;
  name: string;
  country?: Country;
  location?: GeoPointData;
  area?: PolygonData;
};
export type Province = {
  id?: string;
  code: number;
  name: string;
  departament?: Departament;
  location?: GeoPointData;
  area?: PolygonData;
};
export type Municipality = {
  id?: string;
  code: number;
  name: string;
  province: Province;
  location?: GeoPointData;
  area?: PolygonData;
}
export type Locality = {
  id?: string;
  code: number;
  name: string;
  municipality: Municipality;
  location?: GeoPointData;
};
export type Precinct = {
  id?: string;
  code: number;
  name: string;
  locality: Locality;
  location?: GeoPointData;
}
export type PolygonObject = {
  coordinates: [number, number][];
};

// En $lib/types/types.ts - actualizar:


export type PoliticalOrganization = {
  id?: string;
  sigla: string;
  name: string;
  color: string;
  electoralProcess: ElectoralProcess;
}

export type ElectoralPosition = {
  id?: string;
  name: string;
  scope: 'DEPARTAMENTAL' | 'PROVINCIAL' | 'MUNICIPAL';
  order: number;
  electoralProcess: ElectoralProcess;
};




export type PartyParticipation = {
  id?: string;

  // Relaciones principales
  politicalOrganization: PoliticalOrganization;
  electoralPosition: ElectoralPosition;
  electoralProcess: ElectoralProcess;

  // Alcance territorial (solo uno según el cargo)
  department?: Departament;
  province?: Province;
  municipality?: Municipality;

  // Configuración para el acta
  order: number;        // Orden del partido en el acta
  enabled: boolean;     // Habilitado / deshabilitado
};

// Actualizar en $lib/types/types.ts

export type PollingTable = {
  id?: string;
  number: number;
  inscribedCount?: number;
  actCode?: number;  // Código de la mesa
  precinct?: Precinct;
};

export type Acta = {
  id?: string;

  // Información básica
  code: string;
  
  // Relaciones principales
  pollingTable: PollingTable;
  electoralProcess: ElectoralProcess;
  
  // Estado del acta
  status: 'BORRADOR' | 'CON_FOTO' | 'CERRADA' | 'VALIDADA';
  
  // Campos opcionales para el flujo
  imageUrl?: string;           // Base64 de la imagen del acta
  electoralPosition?: ElectoralPosition; // Opcional, usado en algunos contextos
  transcribedBy?: any;         // Usuario que transcribió
  validatedBy?: any;           // Usuario que validó
  observations?: string;       // Observaciones durante validación
};

export type ActaDetail = {
  id?: string;

  // Relaciones
  acta: Acta | { id: string; code: string };
  electoralPosition: ElectoralPosition;
  politicalOrganization: PoliticalOrganization;

  // Votos
  votes: number;
};

// Tipo auxiliar para la estructura de franjas
export type ActaFranja = {
  position: ElectoralPosition;
  parties: PartyParticipation[];
};

export type ActaStructure = {
  table: PollingTable;
  code: string;
  franjas: ActaFranja[];
};