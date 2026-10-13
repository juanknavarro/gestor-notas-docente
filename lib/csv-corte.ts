import { db, type Actividad, type Estudiante } from "./db";

export interface ResultadoImportacionCSV {
  exito: boolean;
  mensaje?: string;
  notasProcesadas: number;
  estudiantesActualizados: number;
  advertencias: string[];
}

/**
 * Genera el contenido del archivo CSV para la plantilla del corte actual.
 * Incluye UTF-8 BOM (\uFEFF) para compatibilidad nativa con Microsoft Excel en español.
 * Delimitador: punto y coma (;).
 * Formato de columna de actividad: {nombre} ({peso}%) [ID:{id}]
 */
export function generarPlantillaCSVCorte(
  estudiantes: Estudiante[],
  actividades: Actividad[],
  notasMap: Map<string, number>,
  numeroCorte: number
): { csvString: string; filename: string } {
  // 1. Cabecera con BOM UTF-8
  const BOM = "\uFEFF";
  const headers = [
    "Identificación",
    "Nombre Completo",
    ...actividades.map((act) => {
      const pesoLabel = act.esBonificacion ? "Bono" : `${act.porcentaje}%`;
      return `"${act.nombre} (${pesoLabel}) [ID:${act.id}]"`;
    }),
  ];

  const lines: string[] = [headers.join(";")];

  // 2. Filas de estudiantes con notas actuales precargadas si existen
  for (const est of estudiantes) {
    const rowValues = [
      `"${est.identificacion}"`,
      `"${est.nombreCompleto.replace(/"/g, '""')}"`,
    ];

    for (const act of actividades) {
      const nota = notasMap.get(`${est.id}_${act.id}`);
      if (nota !== undefined && nota !== null) {
        rowValues.push(nota.toFixed(1));
      } else {
        rowValues.push("");
      }
    }

    lines.push(rowValues.join(";"));
  }

  const csvString = BOM + lines.join("\r\n");
  const filename = `plantilla-calificaciones-corte-${numeroCorte}.csv`;

  return { csvString, filename };
}

/**
 * Función auxiliar para parsear una línea CSV respetando celdas entre comillas.
 */
function parsearLineaCSV(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Lee, valida y persiste masivamente notas desde un CSV en el corte activo.
 * Soporta delimitador punto y coma (;) y coma (,).
 * Sanitiza valores decimales y descarta valores fuera del rango institucional (0.0 a 5.0).
 */
export async function procesarCSVNotas(
  csvText: string,
  corteId: number,
  asignaturaId: number
): Promise<ResultadoImportacionCSV> {
  // Limpieza inicial de BOM y división en líneas
  const cleanText = csvText.replace(/^\uFEFF/, "").trim();
  const rawLines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (rawLines.length < 2) {
    return {
      exito: false,
      mensaje: "El archivo CSV está vacío o no contiene filas de datos de estudiantes.",
      notasProcesadas: 0,
      estudiantesActualizados: 0,
      advertencias: ["El archivo debe incluir al menos una fila de cabecera y una fila de datos."],
    };
  }

  // 1. Detección flexible del delimitador (; o ,)
  const headerLine = rawLines[0];
  const countSemicolon = (headerLine.match(/;/g) || []).length;
  const countComma = (headerLine.match(/,/g) || []).length;
  const delimiter = countSemicolon >= countComma ? ";" : ",";

  const headers = parsearLineaCSV(headerLine, delimiter);

  // 2. Extraer actividades válidas del corte actual desde Dexie
  const actividadesCorte = await db.actividades.where("corteId").equals(corteId).toArray();
  const validActividadIds = new Set(actividadesCorte.map((a) => a.id));

  // Mapear qué columnas corresponden a qué actividadId
  const colToActividadId = new Map<number, number>();
  const idRegex = /\[ID:(\d+)\]/i;

  let colIdentificacionIndex = 0; // Por defecto columna 0
  const advertencias: string[] = [];

  for (let c = 0; c < headers.length; c++) {
    const headerText = headers[c];
    const match = headerText.match(idRegex);

    if (match) {
      const actId = Number(match[1]);
      if (validActividadIds.has(actId)) {
        colToActividadId.set(c, actId);
      } else {
        advertencias.push(
          `Columna "${headerText}" ignorada: su ID (${actId}) no pertenece a las actividades de este corte.`
        );
      }
    } else {
      // Si la cabecera indica documento o identificación
      const norm = headerText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (norm.includes("identificacion") || norm.includes("documento") || norm === "id") {
        colIdentificacionIndex = c;
      }
    }
  }

  if (colToActividadId.size === 0) {
    return {
      exito: false,
      mensaje: "No se identificaron columnas válidas de actividades para este corte.",
      notasProcesadas: 0,
      estudiantesActualizados: 0,
      advertencias: [
        "Asegúrate de que las columnas tengan el identificador al final con el formato [ID:X], generado por la plantilla del corte.",
        ...advertencias,
      ],
    };
  }

  // 3. Mapeo de estudiantes de la asignatura en memoria
  const estudiantesAsignatura = await db.estudiantes
    .where("asignaturaId")
    .equals(asignaturaId)
    .toArray();

  const estMap = new Map<string, number>();
  for (const est of estudiantesAsignatura) {
    const idClean = est.identificacion.replace(/[-.\s]/g, "").toLowerCase();
    estMap.set(idClean, est.id!);
    estMap.set(est.identificacion.trim(), est.id!);
  }

  // 4. Procesamiento de filas
  interface NotaItem {
    estudianteId: number;
    actividadId: number;
    valor: number;
  }

  const notasAProcesar: NotaItem[] = [];
  const estudiantesProcesadosSet = new Set<number>();

  for (let i = 1; i < rawLines.length; i++) {
    const cols = parsearLineaCSV(rawLines[i], delimiter);
    if (cols.length === 0 || cols.every((c) => c === "")) continue;

    const rawId = cols[colIdentificacionIndex] || "";
    const cleanId = rawId.replace(/[-.\s]/g, "").toLowerCase();
    const estudianteId = estMap.get(cleanId) || estMap.get(rawId.trim());

    const nombreEstudiante = cols[colIdentificacionIndex === 0 ? 1 : 0] || `ID ${rawId}`;

    if (!estudianteId) {
      if (cleanId.length > 0) {
        advertencias.push(
          `Fila ${i + 1}: El estudiante con identificación "${rawId}" (${nombreEstudiante}) no pertenece a esta asignatura.`
        );
      }
      continue;
    }

    // Procesar cada columna de actividad
    for (const [colIndex, actividadId] of colToActividadId.entries()) {
      if (colIndex >= cols.length) continue;

      const cellText = cols[colIndex].trim();
      if (cellText === "") continue; // Celda vacía: se preserva o se ignora

      // Normalizar coma por punto
      const sanitizedNumStr = cellText.replace(/,/g, ".");
      const valorNum = parseFloat(sanitizedNumStr);

      if (isNaN(valorNum)) {
        advertencias.push(
          `Fila ${i + 1} (${nombreEstudiante}): Valor no numérico "${cellText}" ignorado.`
        );
        continue;
      }

      if (valorNum < 0 || valorNum > 5.0) {
        advertencias.push(
          `Fila ${i + 1} (${nombreEstudiante}): La calificación ${valorNum.toFixed(1)} está fuera del rango institucional (0.0 a 5.0) y fue omitida.`
        );
        continue;
      }

      notasAProcesar.push({
        estudianteId,
        actividadId,
        valor: Number(valorNum.toFixed(2)),
      });
      estudiantesProcesadosSet.add(estudianteId);
    }
  }

  if (notasAProcesar.length === 0) {
    return {
      exito: true,
      mensaje: "No se encontraron calificaciones nuevas o modificadas para guardar.",
      notasProcesadas: 0,
      estudiantesActualizados: 0,
      advertencias,
    };
  }

  // 5. Persistencia Atómica en Dexie
  await db.transaction("rw", db.notas, async () => {
    for (const item of notasAProcesar) {
      const notaExistente = await db.notas
        .where("estudianteId")
        .equals(item.estudianteId)
        .and((n) => n.actividadId === item.actividadId)
        .first();

      if (notaExistente?.id) {
        await db.notas.update(notaExistente.id, { valor: item.valor });
      } else {
        await db.notas.add({
          estudianteId: item.estudianteId,
          actividadId: item.actividadId,
          valor: item.valor,
        });
      }
    }
  });

  return {
    exito: true,
    notasProcesadas: notasAProcesar.length,
    estudiantesActualizados: estudiantesProcesadosSet.size,
    advertencias,
  };
}
