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

export class GestorAcademicoDB extends Dexie {
  periodos!: Table<Periodo, number>;
  asignaturas!: Table<Asignatura, number>;
  estudiantes!: Table<Estudiante, number>;
  cortes!: Table<Corte, number>;
  actividades!: Table<Actividad, number>;
  notas!: Table<Nota, number>;
  socializaciones!: Table<Socializacion, number>;

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
  }
}

export const db = new GestorAcademicoDB();
