import ExcelJS from "exceljs";
import type { DatosInformeCorte } from "./reportes";

/**
 * Genera y descarga el archivo Excel "Formato de Mortalidad Académica Parcial"
 * siguiendo la estructura institucional y el mapeo exacto de celdas.
 */
export async function generarExcelMortalidad(datos: DatosInformeCorte): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = datos.docenteNombre;
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Hoja1", {
    views: [{ showGridLines: true }],
  });

  // Configurar anchos de columna para visualización óptima
  worksheet.columns = [
    { key: "colA", width: 8 },   // A: N°
    { key: "colB", width: 14 },  // B
    { key: "colC", width: 12 },  // C
    { key: "colD", width: 12 },  // D
    { key: "colE", width: 10 },  // E
    { key: "colF", width: 10 },  // F
    { key: "colG", width: 12 },  // G
    { key: "colH", width: 9 },   // H
    { key: "colI", width: 9 },   // I
    { key: "colJ", width: 12 },  // J
    { key: "colK", width: 16 },  // K
    { key: "colL", width: 14 },  // L
  ];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF9CA3AF" } },
    bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
    left: { style: "thin", color: { argb: "FF9CA3AF" } },
    right: { style: "thin", color: { argb: "FF9CA3AF" } },
  };

  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3F4F6" }, // Zinc / Gray 100
  };

  const bannerRedFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC00000" }, // Rojo oscuro institucional
  };

  const bannerFont: Partial<ExcelJS.Font> = {
    name: "Arial",
    size: 10.5,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  // ----------------------------------------------------
  // Fila 1: Título Principal Institucional (A1 a L1 combinadas)
  // ----------------------------------------------------
  worksheet.mergeCells("A1:L1");
  const cellTitulo = worksheet.getCell("A1");
  cellTitulo.value = "FORMATO DE MORTALIDAD ACADEMICA PARCIAL";
  cellTitulo.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF111827" } };
  cellTitulo.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 30;

  // ----------------------------------------------------
  // Fila 2 a 4: Espaciador o Subtítulo
  // ----------------------------------------------------
  worksheet.mergeCells("A3:L3");
  const cellSub = worksheet.getCell("A3");
  cellSub.value = `CORTE EVALUATIVO ${datos.corte.numeroCorte} (${datos.corte.porcentaje}%) - PERIODO ${datos.asignatura.periodoNombre}`;
  cellSub.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF4B5563" } };
  cellSub.alignment = { vertical: "middle", horizontal: "center" };

  // ----------------------------------------------------
  // Fila 5: Metadatos del Curso
  // A5 = "Nombre del Curso", D5 = datos.asignatura.nombre, K5 = "N° Catalogo: 396CBASM"
  // ----------------------------------------------------
  worksheet.mergeCells("A5:C5");
  const cellA5 = worksheet.getCell("A5");
  cellA5.value = "Nombre del Curso:";
  cellA5.font = { name: "Arial", size: 10, bold: true };
  cellA5.alignment = { vertical: "middle", horizontal: "left" };

  worksheet.mergeCells("D5:J5");
  const cellD5 = worksheet.getCell("D5");
  cellD5.value = datos.asignatura.nombre;
  cellD5.font = { name: "Arial", size: 10, bold: true };
  cellD5.alignment = { vertical: "middle", horizontal: "left" };

  worksheet.mergeCells("K5:L5");
  const cellK5 = worksheet.getCell("K5");
  cellK5.value = `N° Catalogo: ${datos.asignatura.numeroCatalogo || "Sin Asignar"}`;
  cellK5.font = { name: "Arial", size: 10, bold: true };
  cellK5.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(5).height = 22;

  // ----------------------------------------------------
  // Fila 6: Docente y Número de Clase
  // A6 = "Docente:", D6 = datos.docenteNombre, K6 = "N° Clase: " + numeroClase
  // ----------------------------------------------------
  worksheet.mergeCells("A6:C6");
  const cellA6 = worksheet.getCell("A6");
  cellA6.value = "Docente:";
  cellA6.font = { name: "Arial", size: 10, bold: true };
  cellA6.alignment = { vertical: "middle", horizontal: "left" };

  worksheet.mergeCells("D6:J6");
  const cellD6 = worksheet.getCell("D6");
  cellD6.value = datos.docenteNombre;
  cellD6.font = { name: "Arial", size: 10 };
  cellD6.alignment = { vertical: "middle", horizontal: "left" };

  worksheet.mergeCells("K6:L6");
  const cellK6 = worksheet.getCell("K6");
  cellK6.value = `N° Clase: ${datos.asignatura.numeroClase || "Sin Asignar"}`;
  cellK6.font = { name: "Arial", size: 10, bold: true };
  cellK6.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(6).height = 22;

  // Fila 7: Programa Académico
  worksheet.mergeCells("A7:C7");
  const cellA7 = worksheet.getCell("A7");
  cellA7.value = "Programa:";
  cellA7.font = { name: "Arial", size: 10, bold: true };
  cellA7.alignment = { vertical: "middle", horizontal: "left" };

  worksheet.mergeCells("D7:L7");
  const cellD7 = worksheet.getCell("D7");
  cellD7.value = datos.asignatura.programa;
  cellD7.font = { name: "Arial", size: 10 };
  cellD7.alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getRow(7).height = 20;

  // ----------------------------------------------------
  // Funciones Auxiliares para Estructurar Tablas y Secciones
  // ----------------------------------------------------
  const allCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  const renderizarCabeceraSeccion = (rowNum: number, titulo: string) => {
    worksheet.mergeCells(`A${rowNum}:L${rowNum}`);
    allCols.forEach((col) => {
      const cell = worksheet.getCell(`${col}${rowNum}`);
      cell.fill = bannerRedFill;
      cell.border = thinBorder;
    });
    const cellA = worksheet.getCell(`A${rowNum}`);
    cellA.value = titulo;
    cellA.font = bannerFont;
    cellA.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    worksheet.getRow(rowNum).height = 26;
  };

  const renderizarColumnasTabla = (rowNum: number) => {
    allCols.forEach((col) => {
      const cell = worksheet.getCell(`${col}${rowNum}`);
      cell.fill = headerFill;
      cell.border = thinBorder;
    });

    const cellA = worksheet.getCell(`A${rowNum}`);
    cellA.value = "N°";
    cellA.font = { name: "Arial", size: 10, bold: true };
    cellA.alignment = { vertical: "middle", horizontal: "center" };

    worksheet.mergeCells(`B${rowNum}:G${rowNum}`);
    const cellB = worksheet.getCell(`B${rowNum}`);
    cellB.value = "Nombre del Estudiante";
    cellB.font = { name: "Arial", size: 10, bold: true };
    cellB.alignment = { vertical: "middle", horizontal: "left" };

    worksheet.mergeCells(`H${rowNum}:I${rowNum}`);
    const cellH = worksheet.getCell(`H${rowNum}`);
    cellH.value = "Calificación";
    cellH.font = { name: "Arial", size: 10, bold: true };
    cellH.alignment = { vertical: "middle", horizontal: "center" };

    worksheet.mergeCells(`J${rowNum}:L${rowNum}`);
    const cellJ = worksheet.getCell(`J${rowNum}`);
    cellJ.value = "Comentarios";
    cellJ.font = { name: "Arial", size: 10, bold: true };
    cellJ.alignment = { vertical: "middle", horizontal: "center" };

    worksheet.getRow(rowNum).height = 24;
  };

  // ----------------------------------------------------
  // Fila 10: Barra Roja Institucional - Encabezado de Métricas
  // ----------------------------------------------------
  const c1 = datos.corte.numeroCorte === 1 ? "[X]" : "[ ]";
  const c2 = datos.corte.numeroCorte === 2 ? "[X]" : "[ ]";
  const c3 = datos.corte.numeroCorte === 3 ? "[X]" : "[ ]";
  const textoBarraMetricas = `Informe general y porcentaje de estudiantes que ganan y pierde el   ${c1} 1er Corte 35%   ${c2} 2do Corte 35%   ${c3} 3er Corte 30%`;

  renderizarCabeceraSeccion(10, textoBarraMetricas);

  // ----------------------------------------------------
  // Fila 11: Encabezados de Métricas de Mortalidad
  // ----------------------------------------------------
  worksheet.mergeCells("A11:C11");
  const cellHMat = worksheet.getCell("A11");
  cellHMat.value = "Total Matriculados";
  cellHMat.font = { name: "Arial", size: 9, bold: true };
  cellHMat.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cellHMat.fill = headerFill;

  worksheet.mergeCells("D11:F11");
  const cellHApr = worksheet.getCell("D11");
  cellHApr.value = "Total Aprobados";
  cellHApr.font = { name: "Arial", size: 9, bold: true };
  cellHApr.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cellHApr.fill = headerFill;

  worksheet.mergeCells("G11:H11");
  const cellHRep = worksheet.getCell("G11");
  cellHRep.value = "Total Reprobados";
  cellHRep.font = { name: "Arial", size: 9, bold: true };
  cellHRep.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cellHRep.fill = headerFill;

  worksheet.mergeCells("I11:J11");
  const cellHInf2 = worksheet.getCell("I11");
  cellHInf2.value = "Inferior a 2.0";
  cellHInf2.font = { name: "Arial", size: 9, bold: true };
  cellHInf2.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cellHInf2.fill = headerFill;

  const cellHEnt2 = worksheet.getCell("K11");
  cellHEnt2.value = "Entre 2.0 y 2.9";
  cellHEnt2.font = { name: "Arial", size: 9, bold: true };
  cellHEnt2.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cellHEnt2.fill = headerFill;

  const cellHProm = worksheet.getCell("L11");
  cellHProm.value = "Promedio Corte";
  cellHProm.font = { name: "Arial", size: 9, bold: true };
  cellHProm.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cellHProm.fill = headerFill;

  worksheet.getRow(11).height = 24;

  // Bordes fila 11
  ["A11", "B11", "C11", "D11", "E11", "F11", "G11", "H11", "I11", "J11", "K11", "L11"].forEach((ref) => {
    worksheet.getCell(ref).border = thinBorder;
  });

  // ----------------------------------------------------
  // Fila 12: Valores de Métricas Calculadas
  // A12: Matriculados, D12: Aprobados, G12: Reprobados,
  // I12: Inferior a 2.0, K12: Entre 2.0 y 2.9, L12: Promedio
  // ----------------------------------------------------
  worksheet.mergeCells("A12:C12");
  const cellA12 = worksheet.getCell("A12");
  cellA12.value = datos.metricas.totalMatriculados;
  cellA12.font = { name: "Arial", size: 11, bold: true };
  cellA12.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.mergeCells("D12:F12");
  const cellD12 = worksheet.getCell("D12");
  cellD12.value = datos.metricas.totalAprobados;
  cellD12.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF047857" } }; // Verde
  cellD12.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.mergeCells("G12:H12");
  const cellG12 = worksheet.getCell("G12");
  cellG12.value = datos.metricas.totalReprobados;
  cellG12.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFB91C1C" } }; // Rojo
  cellG12.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.mergeCells("I12:J12");
  const cellI12 = worksheet.getCell("I12");
  cellI12.value = datos.metricas.inferiorA2;
  cellI12.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFB91C1C" } };
  cellI12.alignment = { vertical: "middle", horizontal: "center" };

  const cellK12 = worksheet.getCell("K12");
  cellK12.value = datos.metricas.entre2y29;
  cellK12.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFD97706" } }; // Ámbar
  cellK12.alignment = { vertical: "middle", horizontal: "center" };

  const cellL12 = worksheet.getCell("L12");
  cellL12.value = datos.metricas.promedioCorte;
  cellL12.font = { name: "Arial", size: 11, bold: true };
  cellL12.alignment = { vertical: "middle", horizontal: "center" };
  cellL12.numFmt = "0.00";

  worksheet.getRow(12).height = 24;

  ["A12", "B12", "C12", "D12", "E12", "F12", "G12", "H12", "I12", "J12", "K12", "L12"].forEach((ref) => {
    worksheet.getCell(ref).border = thinBorder;
  });

  // Fila 13: Sub-etiqueta con Formato Oficial (ej. "Mortalidad: 19 DE 43, 44%")
  worksheet.mergeCells("A13:L13");
  const cellMortalidadInfo = worksheet.getCell("A13");
  cellMortalidadInfo.value = `Índice de Mortalidad: ${datos.metricas.textoMortalidad} (Aprobación: ${Math.round(
    datos.metricas.porcentajeAprobados
  )}%)`;
  cellMortalidadInfo.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF4B5563" } };
  cellMortalidadInfo.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(13).height = 18;

  // ----------------------------------------------------
  // Paso 2: Tabla de Estudiantes Sobresalientes (definitivaNumero >= 4.6)
  // ----------------------------------------------------
  const sobresalientes = datos.estudiantes.filter((e) => e.definitivaNumero >= 4.6);

  let currentRow = 15;

  // Encabezado con fondo rojo oscuro y texto blanco
  renderizarCabeceraSeccion(
    currentRow,
    "Estudiantes sobresalientes en el grupo de acuerdo con su nota y/o comportamiento"
  );
  currentRow++;

  // Cabeceras de columnas
  renderizarColumnasTabla(currentRow);
  currentRow++;

  // Filas de datos sobresalientes
  if (sobresalientes.length === 0) {
    const cellA = worksheet.getCell(`A${currentRow}`);
    cellA.value = "-";
    cellA.alignment = { vertical: "middle", horizontal: "center" };
    cellA.font = { name: "Arial", size: 10 };

    worksheet.mergeCells(`B${currentRow}:G${currentRow}`);
    const cellB = worksheet.getCell(`B${currentRow}`);
    cellB.value = "No se registraron estudiantes con calificación superior o igual a 4.6";
    cellB.alignment = { vertical: "middle", horizontal: "left" };
    cellB.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF6B7280" } };

    worksheet.mergeCells(`H${currentRow}:I${currentRow}`);
    const cellH = worksheet.getCell(`H${currentRow}`);
    cellH.value = "-";
    cellH.alignment = { vertical: "middle", horizontal: "center" };
    cellH.font = { name: "Arial", size: 10 };

    worksheet.mergeCells(`J${currentRow}:L${currentRow}`);
    const cellJ = worksheet.getCell(`J${currentRow}`);
    cellJ.value = "Sin observaciones";
    cellJ.alignment = { vertical: "middle", horizontal: "left" };
    cellJ.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF6B7280" } };

    allCols.forEach((col) => {
      worksheet.getCell(`${col}${currentRow}`).border = thinBorder;
    });
    worksheet.getRow(currentRow).height = 22;
    currentRow++;
  } else {
    for (let i = 0; i < sobresalientes.length; i++) {
      const est = sobresalientes[i];

      // Col A: Consecutivo
      const cellNum = worksheet.getCell(`A${currentRow}`);
      cellNum.value = i + 1;
      cellNum.alignment = { vertical: "middle", horizontal: "center" };
      cellNum.font = { name: "Arial", size: 10 };

      // Col B a G: Nombre del Estudiante
      worksheet.mergeCells(`B${currentRow}:G${currentRow}`);
      const cellNombre = worksheet.getCell(`B${currentRow}`);
      cellNombre.value = est.nombreCompleto;
      cellNombre.alignment = { vertical: "middle", horizontal: "left" };
      cellNombre.font = { name: "Arial", size: 10 };

      // Col H a I: Calificación
      worksheet.mergeCells(`H${currentRow}:I${currentRow}`);
      const cellNota = worksheet.getCell(`H${currentRow}`);
      cellNota.value = est.definitivaNumero;
      cellNota.numFmt = "0.0";
      cellNota.alignment = { vertical: "middle", horizontal: "center" };
      cellNota.font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: { argb: "FF047857" }, // Verde institucional
      };

      // Col J a L: Comentarios
      worksheet.mergeCells(`J${currentRow}:L${currentRow}`);
      const cellComentario = worksheet.getCell(`J${currentRow}`);
      cellComentario.value = "Estudiante muy comprometido, nunca falta a clase, proactivo";
      cellComentario.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      cellComentario.font = { name: "Arial", size: 9 };

      worksheet.getRow(currentRow).height = 24;

      allCols.forEach((col) => {
        worksheet.getCell(`${col}${currentRow}`).border = thinBorder;
      });

      currentRow++;
    }
  }

  // ----------------------------------------------------
  // Paso 3: Separación y Tabla de Estudiantes Deficientes (definitivaNumero <= 2.9)
  // ----------------------------------------------------
  // Dejar un par de filas en blanco de separación
  currentRow += 2;

  const deficientes = datos.estudiantes.filter((e) => e.definitivaNumero <= 2.9);

  // Encabezado con fondo rojo oscuro y texto blanco
  renderizarCabeceraSeccion(
    currentRow,
    "Estudiantes deficientes en el grupo de acuerdo con su nota y/o comportamiento"
  );
  currentRow++;

  // Cabeceras de columnas
  renderizarColumnasTabla(currentRow);
  currentRow++;

  // Filas de datos deficientes
  if (deficientes.length === 0) {
    const cellA = worksheet.getCell(`A${currentRow}`);
    cellA.value = "-";
    cellA.alignment = { vertical: "middle", horizontal: "center" };
    cellA.font = { name: "Arial", size: 10 };

    worksheet.mergeCells(`B${currentRow}:G${currentRow}`);
    const cellB = worksheet.getCell(`B${currentRow}`);
    cellB.value = "No se registraron estudiantes con calificación inferior o igual a 2.9";
    cellB.alignment = { vertical: "middle", horizontal: "left" };
    cellB.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF6B7280" } };

    worksheet.mergeCells(`H${currentRow}:I${currentRow}`);
    const cellH = worksheet.getCell(`H${currentRow}`);
    cellH.value = "-";
    cellH.alignment = { vertical: "middle", horizontal: "center" };
    cellH.font = { name: "Arial", size: 10 };

    worksheet.mergeCells(`J${currentRow}:L${currentRow}`);
    const cellJ = worksheet.getCell(`J${currentRow}`);
    cellJ.value = "Sin observaciones";
    cellJ.alignment = { vertical: "middle", horizontal: "left" };
    cellJ.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF6B7280" } };

    allCols.forEach((col) => {
      worksheet.getCell(`${col}${currentRow}`).border = thinBorder;
    });
    worksheet.getRow(currentRow).height = 22;
    currentRow++;
  } else {
    for (let i = 0; i < deficientes.length; i++) {
      const est = deficientes[i];

      // Col A: Consecutivo
      const cellNum = worksheet.getCell(`A${currentRow}`);
      cellNum.value = i + 1;
      cellNum.alignment = { vertical: "middle", horizontal: "center" };
      cellNum.font = { name: "Arial", size: 10 };

      // Col B a G: Nombre del Estudiante
      worksheet.mergeCells(`B${currentRow}:G${currentRow}`);
      const cellNombre = worksheet.getCell(`B${currentRow}`);
      cellNombre.value = est.nombreCompleto;
      cellNombre.alignment = { vertical: "middle", horizontal: "left" };
      cellNombre.font = { name: "Arial", size: 10 };

      // Col H a I: Calificación
      worksheet.mergeCells(`H${currentRow}:I${currentRow}`);
      const cellNota = worksheet.getCell(`H${currentRow}`);
      cellNota.value = est.definitivaNumero;
      cellNota.numFmt = "0.0";
      cellNota.alignment = { vertical: "middle", horizontal: "center" };
      cellNota.font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: { argb: "FFB91C1C" }, // Rojo institucional
      };

      // Col J a L: Comentarios
      worksheet.mergeCells(`J${currentRow}:L${currentRow}`);
      const cellComentario = worksheet.getCell(`J${currentRow}`);
      cellComentario.value =
        "El estudiante debe reforzar sus conocimientos básicos, ser más participativo en clases y asistir a tutorías";
      cellComentario.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      cellComentario.font = { name: "Arial", size: 9 };

      worksheet.getRow(currentRow).height = 24;

      allCols.forEach((col) => {
        worksheet.getCell(`${col}${currentRow}`).border = thinBorder;
      });

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
  const filename = `Formato_Mortalidad_Corte${datos.corte.numeroCorte}.xlsx`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
