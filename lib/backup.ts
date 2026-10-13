import {
  db,
  type Periodo,
  type Asignatura,
  type Estudiante,
  type Corte,
  type Actividad,
  type Nota,
  type Socializacion,
  type ProgramaAcademico,
  type ResultadoAprendizaje,
  type ConfiguracionDocente,
} from "./db";

export interface BackupMetadata {
  app: "GestorNotasDocente";
  version: number;
  fechaExportacion: string;
  totalTablas: number;
  resumenRegistros: Record<string, number>;
}

export interface BackupPayload {
  metadata: BackupMetadata;
  data: {
    periodos: Periodo[];
    asignaturas: Asignatura[];
    cortes: Corte[];
    actividades: Actividad[];
    estudiantes: Estudiante[];
    notas: Nota[];
    socializaciones: Socializacion[];
    programas?: ProgramaAcademico[];
    resultados_aprendizaje?: ResultadoAprendizaje[];
    configuracion?: ConfiguracionDocente[];
    [tableName: string]: unknown[] | undefined;
  };
}

export interface ValidacionResultado {
  valido: boolean;
  error?: string;
  payload?: BackupPayload;
}

/**
 * Genera el string JSON conteniendo el respaldo completo de todas las tablas de Dexie.js
 */
export async function generarBackupJSON(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  const resumenRegistros: Record<string, number> = {};

  for (const table of db.tables) {
    const registros = await table.toArray();
    data[table.name] = registros;
    resumenRegistros[table.name] = registros.length;
  }

  const payload: BackupPayload = {
    metadata: {
      app: "GestorNotasDocente",
      version: db.verno,
      fechaExportacion: new Date().toISOString(),
      totalTablas: db.tables.length,
      resumenRegistros,
    },
    data: data as BackupPayload["data"],
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Valida un JSON en 4 etapas críticas antes de permitir la restauración:
 * 1. Parseo sintáctico.
 * 2. Firma institucional de la aplicación.
 * 3. Existencia de todas las tablas requeridas.
 * 4. Sanity check de estructura en las entidades.
 */
export function validarBackupJSON(rawJson: string): ValidacionResultado {
  // 1. Parseo seguro
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      valido: false,
      error: "El archivo no contiene un JSON válido o se encuentra corrupto.",
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      valido: false,
      error: "El archivo de respaldo tiene un formato no reconocido.",
    };
  }

  const payload = parsed as Partial<BackupPayload>;

  // 2. Validación de Firma de la aplicación
  if (payload.metadata?.app !== "GestorNotasDocente") {
    return {
      valido: false,
      error: 'El archivo no corresponde a un respaldo generado por "GestorNotasDocente".',
    };
  }

  if (!payload.data || typeof payload.data !== "object") {
    return {
      valido: false,
      error: "El archivo de respaldo no contiene la sección de datos requerida.",
    };
  }

  // 3. Validación de Tablas Críticas
  const tablasRequeridas = [
    "periodos",
    "asignaturas",
    "cortes",
    "actividades",
    "estudiantes",
    "notas",
    "socializaciones",
  ];

  for (const tabla of tablasRequeridas) {
    if (!Array.isArray(payload.data[tabla])) {
      return {
        valido: false,
        error: `El archivo está incompleto: falta la tabla obligatoria "${tabla}".`,
      };
    }
  }

  // 4. Sanity Check de Integridad Estructural
  for (const p of payload.data.periodos) {
    if (typeof p !== "object" || !p || typeof (p as Periodo).nombre !== "string") {
      return {
        valido: false,
        error: "Estructura inválida detectada en los registros de la tabla 'periodos'.",
      };
    }
  }

  for (const a of payload.data.asignaturas) {
    if (
      typeof a !== "object" ||
      !a ||
      typeof (a as Asignatura).nombre !== "string" ||
      typeof (a as Asignatura).periodoId !== "number"
    ) {
      return {
        valido: false,
        error: "Estructura inválida detectada en los registros de la tabla 'asignaturas'.",
      };
    }
  }

  for (const e of payload.data.estudiantes) {
    if (
      typeof e !== "object" ||
      !e ||
      typeof (e as Estudiante).identificacion !== "string" ||
      typeof (e as Estudiante).nombreCompleto !== "string"
    ) {
      return {
        valido: false,
        error: "Estructura inválida detectada en los registros de la tabla 'estudiantes'.",
      };
    }
  }

  for (const n of payload.data.notas) {
    if (
      typeof n !== "object" ||
      !n ||
      typeof (n as Nota).estudianteId !== "number" ||
      typeof (n as Nota).actividadId !== "number" ||
      typeof (n as Nota).valor !== "number"
    ) {
      return {
        valido: false,
        error: "Estructura inválida detectada en los registros de la tabla 'notas'.",
      };
    }
  }

  return {
    valido: true,
    payload: payload as BackupPayload,
  };
}

/**
 * Restaura de forma atómica e irreversible el respaldo en Dexie.
 * Ejecuta clear() y bulkAdd() dentro de db.transaction("rw", db.tables, ...).
 */
export async function restaurarBackupJSON(payload: BackupPayload): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    // 1. Limpieza segura de todas las tablas existentes
    for (const table of db.tables) {
      await table.clear();
    }

    // 2. Inserción de los datos nuevos
    for (const table of db.tables) {
      const registros = payload.data[table.name];
      if (Array.isArray(registros) && registros.length > 0) {
        await table.bulkAdd(registros);
      }
    }
  });
}
