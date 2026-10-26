import ExcelJS from "exceljs";
import { db, type Actividad, type Estudiante } from "./db";
import { calcularDefinitivaCorte } from "./calculos";

export interface ResultadoImportacionExcel {
  exito: boolean;
  mensaje?: string;
  notasProcesadas: number;
  estudiantesActualizados: number;
  advertencias: string[];
}

/**
 * Exporta la cuadrícula de calificaciones del corte actual a un archivo Excel (.xlsx).
 * - Identificación y Nombre de cada estudiante.
 * - Columnas por actividad en formato: {nombre} ({peso}%) [ID:{id}].
 * - Inyección de notas existentes desde notasMap.
 * - Columna "Definitiva (Informativa)" calculada al final.
 * - Formato compatible con re-importación masiva (el parser ignora columnas sin [ID:X]).
 */
export async function exportarCuadriculaExcel(
  estudiantes: Estudiante[],
  actividades: Actividad[],
  notasMap: Map<string, number>,
  numeroCorte: number,
  pesoCorte: number = 35
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gestor Académico Docente";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`Corte ${numeroCorte}`, {
    views: [{ showGridLines: true }],
  });

  // 1. Configurar columnas y anchos ajustados
  const columns: Partial<ExcelJS.Column>[] = [
    { header: "Identificación", key: "identificacion", width: 18 },
    { header: "Estudiante", key: "nombre", width: 35 },
  ];

  for (const act of actividades) {
    const pesoLabel = act.esBonificacion ? "Bono" : `${act.porcentaje}%`;
    columns.push({
      header: `${act.nombre} (${pesoLabel}) [ID:${act.id}]`,
      key: `act_${act.id}`,
      width: 22,
    });
  }

  // Columna final informativa de Definitiva (sin identificador [ID:X], ignorada por el importador)
  columns.push({
    header: "Definitiva (Informativa)",
    key: "definitiva",
    width: 22,
  });

  worksheet.columns = columns;

  // 2. Aplicar estilos institucionales a la Cabecera (Fila 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 26;

  headerRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF18181B" }, // Zinc 900 institucional
    };
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" }, // Blanco
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: colNumber === 2 ? "left" : "center",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF3F3F46" } },
      bottom: { style: "medium", color: { argb: "FF3F3F46" } },
      left: { style: "thin", color: { argb: "FF3F3F46" } },
      right: { style: "thin", color: { argb: "FF3F3F46" } },
    };
  });

  // 3. Poblar filas de estudiantes con notas actuales y definitiva
  for (const est of estudiantes) {
    const rowData: Record<string, string | number> = {
      identificacion: est.identificacion,
      nombre: est.nombreCompleto,
    };

    for (const act of actividades) {
      const nota = notasMap.get(`${est.id}_${act.id}`);
      if (nota !== undefined && nota !== null) {
        rowData[`act_${act.id}`] = Number(nota.toFixed(1));
      }
    }

    if (est.id) {
      const def = calcularDefinitivaCorte(
        est.id,
        actividades,
        notasMap,
        pesoCorte
      );
      if (def !== null) {
        rowData["definitiva"] = Number(def.toFixed(1));
      }
    }

    const row = worksheet.addRow(rowData);
    row.height = 20;

    row.eachCell((cell, colNumber) => {
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 2 ? "left" : "center",
      };
      cell.font = {
        name: "Calibri",
        size: 10,
        color: { argb: "FF09090B" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE4E4E7" } },
        bottom: { style: "thin", color: { argb: "FFE4E4E7" } },
        left: { style: "thin", color: { argb: "FFE4E4E7" } },
        right: { style: "thin", color: { argb: "FFE4E4E7" } },
      };

      if (colNumber > 2 && typeof cell.value === "number") {
        cell.numFmt = "0.0";
      }
    });
  }

  const rawBuffer = await workbook.xlsx.writeBuffer();
  // Normalizar a ArrayBuffer puro para el Blob del navegador
  const buffer =
    rawBuffer instanceof ArrayBuffer
      ? rawBuffer
      : (rawBuffer as unknown as Uint8Array).buffer;
  const filename = `cuadricula-calificaciones-corte-${numeroCorte}.xlsx`;

  return { buffer: buffer as ArrayBuffer, filename };
}

/**
 * Lee, valida y persiste calificaciones desde un archivo Excel (.xlsx) entrante.
 * Extrae la primera hoja, detecta [ID:x] en la Fila 1, e ingresa notas desde la Fila 2.
 * Columnas como "Definitiva (Informativa)" que no posean [ID:x] son ignoradas automáticamente.
 */
export async function procesarExcelNotas(
  arrayBuffer: ArrayBuffer,
  corteId: number,
  asignaturaId: number
): Promise<ResultadoImportacionExcel> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(arrayBuffer);
  } catch (err) {
    console.error("Error al cargar workbook Excel:", err);
    return {
      exito: false,
      mensaje: "No se pudo interpretar el archivo como una hoja de cálculo Excel válida.",
      notasProcesadas: 0,
      estudiantesActualizados: 0,
      advertencias: ["Asegúrate de subir un archivo con formato .xlsx generado o compatible."],
    };
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    return {
      exito: false,
      mensaje: "El archivo Excel no contiene suficientes datos o filas de estudiantes.",
      notasProcesadas: 0,
      estudiantesActualizados: 0,
      advertencias: ["El archivo debe incluir al menos una fila de cabecera y una fila de calificaciones."],
    };
  }

  // 1. Actividades vigentes del corte desde Dexie
  const actividadesCorte = await db.actividades.where("corteId").equals(corteId).toArray();
  const validActividadIds = new Set(actividadesCorte.map((a) => a.id));

  // 2. Mapear columnas según los identificadores [ID:x] en la Fila 1
  const headerRow = worksheet.getRow(1);
  const colToActividadId = new Map<number, number>();
  const idRegex = /\[ID:(\d+)\]/i;
  let colIdentificacionIndex = 1; // Por defecto columna 1
  const advertencias: string[] = [];

  headerRow.eachCell((cell, colNumber) => {
    const headerText = cell.text?.trim() || String(cell.value ?? "").trim();
    const match = headerText.match(idRegex);

    if (match) {
      const actId = Number(match[1]);
      if (validActividadIds.has(actId)) {
        colToActividadId.set(colNumber, actId);
      } else {
        advertencias.push(
          `Columna "${headerText}" ignorada: su ID (${actId}) no pertenece a las actividades de este corte.`
        );
      }
    } else {
      const norm = headerText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (norm.includes("identificacion") || norm.includes("documento") || norm === "id") {
        colIdentificacionIndex = colNumber;
      }
    }
  });

  if (colToActividadId.size === 0) {
    return {
      exito: false,
      mensaje: "No se identificaron columnas válidas de actividades para este corte en la plantilla.",
      notasProcesadas: 0,
      estudiantesActualizados: 0,
      advertencias: [
        "Asegúrate de que los encabezados incluyan el identificador al final con el formato [ID:X].",
        ...advertencias,
      ],
    };
  }

  // 3. Estudiantes de la asignatura registrados en Dexie
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

  // 4. Mapeo e iteración de calificaciones fila a fila (desde Fila 2)
  interface NotaItem {
    estudianteId: number;
    actividadId: number;
    valor: number;
  }

  const notasAProcesar: NotaItem[] = [];
  const estudiantesProcesadosSet = new Set<number>();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Omitir cabecera

    const idCell = row.getCell(colIdentificacionIndex);
    const rawId = idCell.text?.trim() || String(idCell.value ?? "").trim();
    if (!rawId) return; // Fila vacía

    const cleanId = rawId.replace(/[-.\s]/g, "").toLowerCase();
    const estudianteId = estMap.get(cleanId) || estMap.get(rawId);

    // Obtener nombre del estudiante para los mensajes de advertencia
    const nombreCell = row.getCell(colIdentificacionIndex === 1 ? 2 : 1);
    const nombreEstudiante = nombreCell.text?.trim() || `ID ${rawId}`;

    if (!estudianteId) {
      advertencias.push(
        `Fila ${rowNumber}: El estudiante con identificación "${rawId}" (${nombreEstudiante}) no pertenece a esta asignatura.`
      );
      return;
    }

    // Iterar cada columna de actividad mapeada
    for (const [colNumber, actividadId] of colToActividadId.entries()) {
      const cell = row.getCell(colNumber);
      let cellValue: unknown = cell.value;

      if (cellValue === null || cellValue === undefined || cellValue === "") {
        continue; // Celda vacía, ignorar
      }

      // Si es un objeto de fórmula de Excel, ej. { formula: '...', result: 4.5 }
      if (typeof cellValue === "object" && cellValue !== null && "result" in cellValue) {
        cellValue = (cellValue as { result: unknown }).result;
      }

      let numVal: number;
      if (typeof cellValue === "number") {
        numVal = cellValue;
      } else {
        const strVal = String(cellValue).trim().replace(/,/g, ".");
        if (strVal === "") continue;
        numVal = parseFloat(strVal);
      }

      if (isNaN(numVal)) {
        advertencias.push(
          `Fila ${rowNumber} (${nombreEstudiante}): Valor no numérico "${String(cell.value)}" ignorado.`
        );
        continue;
      }

      if (numVal < 0 || numVal > 5.0) {
        advertencias.push(
          `Fila ${rowNumber} (${nombreEstudiante}): La calificación ${numVal.toFixed(1)} está fuera del rango institucional (0.0 a 5.0) y fue omitida.`
        );
        continue;
      }

      notasAProcesar.push({
        estudianteId,
        actividadId,
        valor: Number(numVal.toFixed(2)),
      });
      estudiantesProcesadosSet.add(estudianteId);
    }
  });

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
