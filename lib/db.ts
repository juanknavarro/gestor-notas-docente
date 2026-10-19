import Dexie, { type Table } from "dexie";

export interface Periodo {
  id?: number;
  nombre: string; // ej. "2026-1", "2026-2", "2027-1"
}

export interface Asignatura {
  id?: number;
  periodoId: number;
  nombre: string; // ej. "Programación de Computadores"
  programa: string; // ej. "Ingeniería de Sistemas"
  numeroClase?: string; // ej. "3688"
  numeroCatalogo?: string; // ej. "396CBASM"
}

export interface Estudiante {
  id?: number;
  asignaturaId: number;
  identificacion: string;
  nombreCompleto: string;
  estadoMatricula?: "oficial" | "asistente";
  fechaCambioEstado?: string;
}

export interface Corte {
  id?: number;
  asignaturaId: number;
  numeroCorte: number; // 1, 2, 3
  porcentaje: number; // 35, 35, 30
  rasEvaluados?: number[]; // IDs de Resultados de Aprendizaje evaluados en este corte
  bloqueado?: boolean; // Indica si el corte está bloqueado para edición de notas y actividades
}

export interface Actividad {
  id?: number;
  corteId: number;
  nombre: string; // ej. "Taller 1", "Parcial"
  porcentaje: number; // porcentaje dentro del corte
  esBonificacion?: boolean; // indica si es una bonificación directa a la definitiva
}

export interface Nota {
  id?: number;
  estudianteId: number;
  actividadId: number;
  valor: number;
}

export interface Socializacion {
  id?: number;
  estudianteId: number;
  corteId: number;
  estado: "pendiente" | "socializado" | "con_observaciones";
  anotacion?: string;
  fechaActualizacion?: string;
}

export interface ProgramaAcademico {
  id?: number;
  nombre: string; // ej. "Ingeniería de Sistemas"
}

export interface ResultadoAprendizaje {
  id?: number;
  asignaturaId: number;
  codigo: string; // ej. "RA1", "RA2"
  descripcion: string; // Redacción detallada de la competencia
}

export interface EscalaCalificaciones {
  bajoMax: number; // Defecto: 2.9 (Rango Bajo: 0.0 a bajoMax)
  aceptableMin: number; // Defecto: 3.0
  aceptableMax: number; // Defecto: 3.9 (Rango Aceptable: aceptableMin a aceptableMax)
  competenteMin: number; // Defecto: 4.0
  competenteMax: number; // Defecto: 4.5 (Rango Competente: competenteMin a competenteMax)
  excelenteMin: number; // Defecto: 4.6
  excelenteMax: number; // Fijo: 5.0 (Rango Excelente: excelenteMin a 5.0)
  umbralSobresaliente: number; // Defecto: 4.6 (Para el formato de Mortalidad Académica)
}

export const ESCALA_DEFAULT: EscalaCalificaciones = {
  bajoMax: 2.9,
  aceptableMin: 3.0,
  aceptableMax: 3.9,
  competenteMin: 4.0,
  competenteMax: 4.5,
  excelenteMin: 4.6,
  excelenteMax: 5.0,
  umbralSobresaliente: 4.6,
};

export interface ConfiguracionDocente {
  id: number; // 1 (registro singleton)
  nombreDocente: string;
  escala?: EscalaCalificaciones;
}

export class GestorAcademicoDB extends Dexie {
  periodos!: Table<Periodo, number>;
  asignaturas!: Table<Asignatura, number>;
  estudiantes!: Table<Estudiante, number>;
  cortes!: Table<Corte, number>;
  actividades!: Table<Actividad, number>;
  notas!: Table<Nota, number>;
  socializaciones!: Table<Socializacion, number>;
  programas!: Table<ProgramaAcademico, number>;
  resultados_aprendizaje!: Table<ResultadoAprendizaje, number>;
  configuracion!: Table<ConfiguracionDocente, number>;

  constructor() {
    super("GestorAcademicoDB");

    this.version(1).stores({
      periodos: "++id, nombre",
      asignaturas: "++id, periodoId, nombre, programa",
      estudiantes: "++id, asignaturaId, identificacion, nombreCompleto",
    });

    this.version(2).stores({
      periodos: "++id, nombre",
      asignaturas: "++id, periodoId, nombre, programa",
      estudiantes: "++id, asignaturaId, identificacion, nombreCompleto",
      cortes: "++id, asignaturaId, numeroCorte, porcentaje",
      actividades: "++id, corteId, nombre, porcentaje",
      notas: "++id, estudianteId, actividadId, valor",
    });

    this.version(3).stores({
      periodos: "++id, nombre",
      asignaturas: "++id, periodoId, nombre, programa",
      estudiantes: "++id, asignaturaId, identificacion, nombreCompleto",
      cortes: "++id, asignaturaId, numeroCorte, porcentaje",
      actividades: "++id, corteId, nombre, porcentaje",
      notas: "++id, estudianteId, actividadId, valor",
      socializaciones: "++id, estudianteId, corteId, [estudianteId+corteId], estado",
    });

    this.version(4).stores({
      periodos: "++id, nombre",
      asignaturas: "++id, periodoId, nombre, programa",
      estudiantes: "++id, asignaturaId, identificacion, nombreCompleto",
      cortes: "++id, asignaturaId, numeroCorte, porcentaje",
      actividades: "++id, corteId, nombre, porcentaje",
      notas: "++id, estudianteId, actividadId, valor",
      socializaciones: "++id, estudianteId, corteId, [estudianteId+corteId], estado",
      programas: "++id, &nombre",
    });

    this.version(5).stores({
      periodos: "++id, nombre",
      asignaturas: "++id, periodoId, nombre, programa",
      estudiantes: "++id, asignaturaId, identificacion, nombreCompleto",
      cortes: "++id, asignaturaId, numeroCorte, porcentaje",
      actividades: "++id, corteId, nombre, porcentaje",
      notas: "++id, estudianteId, actividadId, valor",
      socializaciones: "++id, estudianteId, corteId, [estudianteId+corteId], estado",
      programas: "++id, &nombre",
      resultados_aprendizaje: "++id, asignaturaId, codigo",
    });

    this.version(6).stores({
      periodos: "++id, nombre",
      asignaturas: "++id, periodoId, nombre, programa",
      estudiantes: "++id, asignaturaId, identificacion, nombreCompleto",
      cortes: "++id, asignaturaId, numeroCorte, porcentaje",
      actividades: "++id, corteId, nombre, porcentaje",
      notas: "++id, estudianteId, actividadId, valor",
      socializaciones: "++id, estudianteId, corteId, [estudianteId+corteId], estado",
      programas: "++id, &nombre",
      resultados_aprendizaje: "++id, asignaturaId, codigo",
      configuracion: "id",
    });
  }
}

export const db = new GestorAcademicoDB();

/**
 * Realiza una limpieza profunda y atómica de todos los datos locales almacenados
 * en IndexedDB, localStorage y sessionStorage.
 * Diseñado para restablecer la aplicación en equipos públicos o compartidos sin romper
 * la reactividad de los componentes de React.
 */
export async function limpiarBaseDeDatosLocal(): Promise<void> {
  // 1. Transacción atómica de lectura/escritura para vaciar todas las tablas registradas en Dexie
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  // 2. Limpieza de almacenamiento web (preferencias, flags, cachés)
  if (typeof window !== "undefined") {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("No se pudo vaciar el almacenamiento web del navegador:", e);
    }
  }
}
