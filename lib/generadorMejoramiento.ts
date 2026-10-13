import ExcelJS from "exceljs";
import type { DatosPlanMejoramiento } from "./reportes";

/**
 * Genera y descarga el archivo Excel "Plan de Mejoramiento del Desempeño Académico"
 * consolidando todas las asignaturas de un periodo evaluadas en un corte específico.
 */
export async function generarExcelMejoramiento(
  datos: DatosPlanMejoramiento
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = datos.docenteNombre;
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Plan de Mejoramiento", {
    views: [{ showGridLines: true }],
  });

  // Configurar anchos de columna para visualización óptima
  worksheet.columns = [
    { key: "colA", width: 22 }, // A: PROGRAMA/DPTO
    { key: "colB", width: 30 }, // B: ASIGNATURA
    { key: "colC", width: 24 }, // C: PROFESOR
    { key: "colD", width: 16 }, // D: INFORMACION GENERAL
    { key: "colE", width: 24 }, // E: HALLAZGOS
    { key: "colF", width: 24 }, // F: CAUSAS
    { key: "colG", width: 24 }, // G: Objetivo
    { key: "colH", width: 26 }, // H: Accion a Implementar
    { key: "colI", width: 18 }, // I: Responsable
    { key: "colJ", width: 15 }, // J: Fecha de Inicio
    { key: "colK", width: 16 }, // K: Fecha de Cumplimiento
    { key: "colL", width: 22 }, // L: Observaciones
    { key: "colM", width: 20 }, // M: Evidencias
  ];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF9CA3AF" } },
    bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
    left: { style: "thin", color: { argb: "FF9CA3AF" } },
    right: { style: "thin", color: { argb: "FF9CA3AF" } },
  };

  const bannerRedFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC00000" }, // Rojo institucional
  };

  const headerFontWhite: Partial<ExcelJS.Font> = {
    name: "Arial",
    size: 10,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  const allCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

  // ----------------------------------------------------
  // Fila 1: Título Principal (A1:M1)
  // ----------------------------------------------------
  worksheet.mergeCells("A1:M1");
  const cellTitulo = worksheet.getCell("A1");
  cellTitulo.value = "PLAN DE MEJORAMIENTO DEL DESEMPEÑO ACADEMICO";
  cellTitulo.font = { name: "Arial", size: 13, bold: true, color: { argb: "FF111827" } };
  cellTitulo.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 28;
  allCols.forEach((col) => {
    worksheet.getCell(`${col}1`).border = thinBorder;
  });

  // ----------------------------------------------------
  // Fila 2: Código, Fecha, Versión
  // ----------------------------------------------------
  worksheet.mergeCells("A2:E2");
  const cellCod = worksheet.getCell("A2");
  cellCod.value = "Código: FOR-AP-01";
  cellCod.font = { name: "Arial", size: 9, bold: true };
  cellCod.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.mergeCells("F2:J2");
  const cellFec = worksheet.getCell("F2");
  cellFec.value = `Periodo: ${datos.periodo.nombre} — Corte: ${datos.numeroCorte} (${datos.pesoCorte}%)`;
  cellFec.font = { name: "Arial", size: 9, bold: true };
  cellFec.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.mergeCells("K2:M2");
  const cellVer = worksheet.getCell("K2");
  cellVer.value = "Versión: 01";
  cellVer.font = { name: "Arial", size: 9, bold: true };
  cellVer.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.getRow(2).height = 20;
  allCols.forEach((col) => {
    worksheet.getCell(`${col}2`).border = thinBorder;
  });

  // ----------------------------------------------------
  // Fila 3: Realizó, Revisó, Aprobó
  // ----------------------------------------------------
  worksheet.mergeCells("A3:E3");
  const cellRealizo = worksheet.getCell("A3");
  cellRealizo.value = `Realizó: ${datos.docenteNombre}`;
  cellRealizo.font = { name: "Arial", size: 9 };
  cellRealizo.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.mergeCells("F3:J3");
  const cellReviso = worksheet.getCell("F3");
  cellReviso.value = "Revisó: Dirección de Programa / Coordinación";
  cellReviso.font = { name: "Arial", size: 9 };
  cellReviso.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.mergeCells("K3:M3");
  const cellAprobo = worksheet.getCell("K3");
  cellAprobo.value = "Aprobó: Decanatura de Facultad";
  cellAprobo.font = { name: "Arial", size: 9 };
  cellAprobo.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.getRow(3).height = 20;
  allCols.forEach((col) => {
    worksheet.getCell(`${col}3`).border = thinBorder;
  });

  // ----------------------------------------------------
  // Fila 4: PROCESO APROPIACIÓN DEL CONOCIMIENTO (A4:M4)
  // ----------------------------------------------------
  worksheet.mergeCells("A4:M4");
  allCols.forEach((col) => {
    const c = worksheet.getCell(`${col}4`);
    c.fill = bannerRedFill;
    c.border = thinBorder;
  });
  const cellProceso = worksheet.getCell("A4");
  cellProceso.value = "PROCESO APROPIACIÓN DEL CONOCIMIENTO";
  cellProceso.font = { name: "Arial", size: 10.5, bold: true, color: { argb: "FFFFFFFF" } };
  cellProceso.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(4).height = 24;

  // ----------------------------------------------------
  // Fila 5: Cabeceras de Columnas
  // ----------------------------------------------------
  const cabeceras = [
    { col: "A", titulo: "PROGRAMA/DPTO" },
    { col: "B", titulo: "ASIGNATURA" },
    { col: "C", titulo: "PROFESOR" },
    { col: "D", titulo: "INFORMACION GENERAL" },
    { col: "E", titulo: "HALLAZGOS" },
    { col: "F", titulo: "CAUSAS" },
    { col: "G", titulo: "Objetivo" },
    { col: "H", titulo: "Accion a Implementar" },
    { col: "I", titulo: "Responsable" },
    { col: "J", titulo: "Fecha de Inicio" },
    { col: "K", titulo: "Fecha de Cumplimiento" },
    { col: "L", titulo: "Observaciones" },
    { col: "M", titulo: "Evidencias" },
  ];

  cabeceras.forEach(({ col, titulo }) => {
    const c = worksheet.getCell(`${col}5`);
    c.value = titulo;
    c.fill = bannerRedFill;
    c.font = headerFontWhite;
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = thinBorder;
  });
  worksheet.getRow(5).height = 30;

  // ----------------------------------------------------
  // Filas Dinámicas (A partir de la Fila 6)
  // ----------------------------------------------------
  let currentRow = 6;

  if (datos.filas.length === 0) {
    worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
    const cellVacio = worksheet.getCell(`A${currentRow}`);
    cellVacio.value = "No se encontraron asignaturas registradas en este periodo académico.";
    cellVacio.font = { name: "Arial", size: 10, italic: true };
    cellVacio.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(currentRow).height = 28;
    allCols.forEach((col) => {
      worksheet.getCell(`${col}${currentRow}`).border = thinBorder;
    });
    currentRow++;
  } else {
    for (const fila of datos.filas) {
      // Col A: PROGRAMA / DPTO
      const cellA = worksheet.getCell(`A${currentRow}`);
      cellA.value = fila.programa;
      cellA.font = { name: "Arial", size: 9.5 };
      cellA.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

      // Col B: ASIGNATURA (Nombre + Catálogo)
      const cellB = worksheet.getCell(`B${currentRow}`);
      const textoCatalogo = fila.numeroCatalogo
        ? `\nCatálogo: ${fila.numeroCatalogo}`
        : "";
      cellB.value = `${fila.asignaturaNombre}${textoCatalogo}`;
      cellB.font = { name: "Arial", size: 9.5, bold: true };
      cellB.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

      // Col C: PROFESOR
      const cellC = worksheet.getCell(`C${currentRow}`);
      cellC.value = fila.docenteNombre;
      cellC.font = { name: "Arial", size: 9.5 };
      cellC.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

      // Col D: INFORMACION GENERAL ("X DE Y \n Z%")
      const cellD = worksheet.getCell(`D${currentRow}`);
      cellD.value = fila.textoInformacionGeneral;
      cellD.font = { name: "Arial", size: 10, bold: true };
      cellD.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

      // Col E: HALLAZGOS
      const cellE = worksheet.getCell(`E${currentRow}`);
      cellE.value = "";
      cellE.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

      // Col F: CAUSAS
      const cellF = worksheet.getCell(`F${currentRow}`);
      cellF.value = "";
      cellF.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

      // Col G: Objetivo
      const cellG = worksheet.getCell(`G${currentRow}`);
      cellG.value = "";
      cellG.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

      // Col H: Accion a Implementar
      const cellH = worksheet.getCell(`H${currentRow}`);
      cellH.value = "";
      cellH.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

      // Col I: Responsable
      const cellI = worksheet.getCell(`I${currentRow}`);
      cellI.value = "Docente / Estudiantes";
      cellI.font = { name: "Arial", size: 9 };
      cellI.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

      // Col J: Fecha de Inicio
      const cellJ = worksheet.getCell(`J${currentRow}`);
      cellJ.value = "";
      cellJ.alignment = { vertical: "middle", horizontal: "center" };

      // Col K: Fecha de Cumplimiento
      const cellK = worksheet.getCell(`K${currentRow}`);
      cellK.value = "";
      cellK.alignment = { vertical: "middle", horizontal: "center" };

      // Col L: Observaciones
      const cellL = worksheet.getCell(`L${currentRow}`);
      cellL.value = "";
      cellL.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

      // Col M: Evidencias
      const cellM = worksheet.getCell(`M${currentRow}`);
      cellM.value = "";
      cellM.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

      // Aplicar bordes finos a todas las celdas de la fila
      allCols.forEach((col) => {
        worksheet.getCell(`${col}${currentRow}`).border = thinBorder;
      });

      worksheet.getRow(currentRow).height = 42;
      currentRow++;
    }
  }

  // ----------------------------------------------------
  // Descarga automática en el navegador
  // ----------------------------------------------------
  const rawBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([rawBuffer as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const filename = `Plan_Mejoramiento_Corte${datos.numeroCorte}_${datos.periodo.nombre.replace(/[/\\?%*:|"<>]/g, "-")}.xlsx`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
